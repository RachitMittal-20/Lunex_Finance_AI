import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'
import { initialDashboardState } from '../src/data.js'
import {
  advisorSystemInstruction,
  buildAdvisorContext,
  buildAdvisorUserPrompt,
  fallbackAdvisorCards,
  normalizeAdvisorResponse,
} from '../src/advisor-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dataDir = path.join(__dirname, 'data')
const dbPath = path.join(dataDir, 'dashboard.json')
const distDir = path.join(rootDir, 'dist')

const app = express()
app.use(cors())
app.use(express.json())
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null
const geminiModels = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite,gemini-2.5-flash')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const twelveDataApiKey = process.env.TWELVE_DATA_API_KEY || 'demo'
const finnhubApiKey = process.env.FINNHUB_API_KEY
const geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 40000)
const advisorCache = new Map()
const advisorModelCooldowns = new Map()

async function fetchJson(url, { timeoutMs = 9000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    const payload = await response.json()
    return { response, payload }
  } finally {
    clearTimeout(timeout)
  }
}

function createSyntheticSeries(currentPrice, previousClose) {
  const start = previousClose || currentPrice || 0
  const end = currentPrice || previousClose || 0
  const today = new Date()

  return Array.from({ length: 20 }, (_, index) => {
    const ratio = index / 19
    const close = start + (end - start) * ratio
    const date = new Date(today)
    date.setDate(today.getDate() - (19 - index))

    return {
      datetime: date.toISOString().slice(0, 10),
      close,
      high: close,
      low: close,
      open: close,
      volume: null,
    }
  })
}

async function fetchFinnhubQuote(symbol) {
  if (!finnhubApiKey) return null

  const quoteUrl = new URL('https://finnhub.io/api/v1/quote')
  quoteUrl.searchParams.set('symbol', symbol)
  quoteUrl.searchParams.set('token', finnhubApiKey)

  const profileUrl = new URL('https://finnhub.io/api/v1/stock/profile2')
  profileUrl.searchParams.set('symbol', symbol)
  profileUrl.searchParams.set('token', finnhubApiKey)

  const [{ payload: quote }, { payload: profile }] = await Promise.all([
    fetchJson(quoteUrl, { timeoutMs: 7000 }),
    fetchJson(profileUrl, { timeoutMs: 7000 }),
  ])

  return {
    symbol,
    name: profile.name || symbol,
    currency: profile.currency || 'USD',
    price: Number(quote.c || 0),
    change: Number(quote.d || 0),
    percentChange: Number(quote.dp || 0),
    exchange: profile.exchange || '',
    type: profile.finnhubIndustry || '',
    series: createSyntheticSeries(Number(quote.c || 0), Number(quote.pc || 0)),
  }
}

async function ensureDb() {
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(dbPath, 'utf8')
  } catch {
    await writeFile(dbPath, JSON.stringify(initialDashboardState, null, 2))
  }
}

async function readDb() {
  await ensureDb()
  const raw = await readFile(dbPath, 'utf8')
  return JSON.parse(raw)
}

async function writeDb(payload) {
  await ensureDb()
  await writeFile(dbPath, JSON.stringify(payload, null, 2))
}

async function updateDb(mutator) {
  const current = await readDb()
  const next = mutator(current)
  await writeDb(next)
  return next
}

function getAdvisorCacheKey(context, question) {
  return JSON.stringify({
    question,
    goal: context.goal,
    income: context.income,
    expenses: context.expenses,
    balance: context.balance,
    savingsRate: context.savingsRate,
    categorySpend: context.categorySpend,
    monthlySnapshot: context.monthlySnapshot,
  })
}

function getCachedAdvisorResponse(cacheKey) {
  const entry = advisorCache.get(cacheKey)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    advisorCache.delete(cacheKey)
    return null
  }
  return entry.value
}

function setCachedAdvisorResponse(cacheKey, value) {
  advisorCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + 1000 * 60 * 10,
  })
}

function markModelCooldown(model, ms) {
  advisorModelCooldowns.set(model, Date.now() + ms)
}

function isModelCoolingDown(model) {
  const until = advisorModelCooldowns.get(model)
  return Boolean(until && until > Date.now())
}

function parseRetryDelayMs(error) {
  const match = String(error).match(/retry in\s+([\d.]+)s/i)
  if (!match) return null
  return Math.ceil(Number(match[1]) * 1000)
}

async function generateAdvisorWithGemini(context, question) {
  let lastError = null

  for (const model of geminiModels) {
    if (isModelCoolingDown(model)) continue

    try {
      const response = await Promise.race([
        gemini.models.generateContent({
          model,
          contents: buildAdvisorUserPrompt(context, question),
          config: {
            systemInstruction: advisorSystemInstruction,
            responseMimeType: 'application/json',
          },
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Gemini model ${model} timed out.`)), geminiTimeoutMs)
        }),
      ])

      return {
        model,
        parsed: normalizeAdvisorResponse(JSON.parse(response.text), context),
      }
    } catch (error) {
      lastError = error
      const errorText = String(error)

      if (errorText.includes('429') || errorText.includes('RESOURCE_EXHAUSTED')) {
        markModelCooldown(model, parseRetryDelayMs(error) ?? 60_000)
      }
    }
  }

  throw lastError ?? new Error('No Gemini models are currently available.')
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() })
})

app.get('/api/state', async (_req, res) => {
  try {
    const state = await readDb()
    res.json(state)
  } catch (error) {
    res.status(500).json({ message: 'Failed to load dashboard state.', error: String(error) })
  }
})

app.put('/api/state', async (req, res) => {
  try {
    const current = await readDb()
    const next = {
      ...current,
      ...req.body,
    }
    await writeDb(next)
    res.json(next)
  } catch (error) {
    res.status(500).json({ message: 'Failed to save dashboard state.', error: String(error) })
  }
})

app.post('/api/advisor', async (req, res) => {
  try {
    const state = await readDb()
    const context = buildAdvisorContext(state)
    const question = req.body?.question?.trim() || 'Give me the most useful financial guidance based on my current dashboard.'
    const cacheKey = getAdvisorCacheKey(context, question)
    const cached = getCachedAdvisorResponse(cacheKey)

    if (cached) {
      res.json(cached)
      return
    }

    if (!gemini) {
      const fallback = fallbackAdvisorCards(context)
      res.json({
        source: 'fallback',
        model: null,
        ...fallback,
        answer: fallback.overview,
      })
      return
    }

    const result = await generateAdvisorWithGemini(context, question)
    const payload = {
      source: 'gemini',
      model: result.model,
      ...result.parsed,
    }

    setCachedAdvisorResponse(cacheKey, payload)
    res.json(payload)
  } catch (error) {
    const state = await readDb()
    const context = buildAdvisorContext(state)
    const fallback = fallbackAdvisorCards(context)
    res.json({
      source: 'fallback',
      model: null,
      ...fallback,
      answer: fallback.overview,
      error: String(error),
    })
  }
})

app.get('/api/market', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || 'AAPL')
    const quoteUrl = new URL('https://api.twelvedata.com/quote')
    quoteUrl.searchParams.set('symbol', symbol)
    quoteUrl.searchParams.set('apikey', twelveDataApiKey)

    const seriesUrl = new URL('https://api.twelvedata.com/time_series')
    seriesUrl.searchParams.set('symbol', symbol)
    seriesUrl.searchParams.set('interval', '1day')
    seriesUrl.searchParams.set('outputsize', '20')
    seriesUrl.searchParams.set('order', 'asc')
    seriesUrl.searchParams.set('apikey', twelveDataApiKey)

    const [{ payload: quote }, { payload: series }] = await Promise.all([
      fetchJson(quoteUrl, { timeoutMs: 8000 }),
      fetchJson(seriesUrl, { timeoutMs: 8000 }),
    ])

    if (quote.status === 'error' || series.status === 'error') {
      throw new Error(quote.message || series.message || 'Market data unavailable')
    }

    const points = (series.values || []).map((item) => ({
      datetime: item.datetime,
      close: Number(item.close),
      high: Number(item.high),
      low: Number(item.low),
      open: Number(item.open),
      volume: item.volume ? Number(item.volume) : null,
    }))

    res.json({
      source: twelveDataApiKey === 'demo' ? 'demo' : 'twelve-data',
      symbol,
      name: quote.name || quote.symbol || symbol,
      currency: quote.currency || series.meta?.currency || 'USD',
      price: Number(quote.close || quote.price || points.at(-1)?.close || 0),
      change: Number(quote.change || 0),
      percentChange: Number(String(quote.percent_change || '0').replace('%', '')),
      exchange: quote.exchange || series.meta?.exchange || '',
      type: quote.type || series.meta?.type || '',
      series: points,
    })
  } catch (error) {
    try {
      const symbol = String(req.query.symbol || 'AAPL')
      const fallback = await fetchFinnhubQuote(symbol)
      if (fallback) {
        res.json({
          source: 'finnhub-fallback',
          ...fallback,
        })
        return
      }
    } catch {
      // ignore fallback failure
    }

    res.status(500).json({ message: 'Failed to load market data.', error: String(error) })
  }
})

app.get('/api/stocks', async (req, res) => {
  try {
    if (!finnhubApiKey) {
      res.status(400).json({ message: 'Finnhub is not configured. Add FINNHUB_API_KEY.' })
      return
    }

    const symbols = String(req.query.symbols || 'AAPL,MSFT,NVDA,TSLA')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 10)

    const results = await Promise.allSettled(symbols.map(async (symbol) => {
      const quoteUrl = new URL('https://finnhub.io/api/v1/quote')
      quoteUrl.searchParams.set('symbol', symbol)
      quoteUrl.searchParams.set('token', finnhubApiKey)

      const profileUrl = new URL('https://finnhub.io/api/v1/stock/profile2')
      profileUrl.searchParams.set('symbol', symbol)
      profileUrl.searchParams.set('token', finnhubApiKey)

      const [{ payload: quote }, { payload: profile }] = await Promise.all([
        fetchJson(quoteUrl, { timeoutMs: 7000 }),
        fetchJson(profileUrl, { timeoutMs: 7000 }),
      ])

      const hasCompanyProfile = Boolean(profile.name || profile.weburl || profile.exchange)
      const hasQuoteData = [quote.c, quote.pc, quote.h, quote.l, quote.o].some((value) => Number(value || 0) !== 0)

      if (!hasCompanyProfile && !hasQuoteData) {
        throw new Error(`Symbol ${symbol} is not available from Finnhub.`)
      }

      return {
        symbol,
        name: profile.name || symbol,
        exchange: profile.exchange || 'Market',
        industry: profile.finnhubIndustry || 'Unclassified',
        country: profile.country || '',
        website: profile.weburl || '',
        currency: profile.currency || 'USD',
        marketCap: Number(profile.marketCapitalization || 0),
        price: Number(quote.c || 0),
        change: Number(quote.d || 0),
        percentChange: Number(quote.dp || 0),
        high: Number(quote.h || 0),
        low: Number(quote.l || 0),
        open: Number(quote.o || 0),
        previousClose: Number(quote.pc || 0),
        timestamp: Number(quote.t || 0),
      }
    }))

    const stocks = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)

    if (!stocks.length) {
      throw new Error('No stock symbols could be loaded from Finnhub.')
    }

    res.json({
      source: 'finnhub',
      updatedAt: new Date().toISOString(),
      partial: stocks.length !== symbols.length,
      stocks,
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to load stock monitoring data.', error: String(error) })
  }
})

if (existsSync(distDir)) {
  app.use(express.static(distDir))

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      next()
      return
    }
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const port = 3001
ensureDb().then(() => {
  app.listen(port, () => {
    console.log(`Lunex API running at http://localhost:${port}`)
  })
})
