import { Redis } from '@upstash/redis'
import { GoogleGenAI } from '@google/genai'
import { initialDashboardState } from '../src/data.js'
import {
  advisorSystemInstruction,
  buildAdvisorContext,
  buildAdvisorUserPrompt,
  fallbackAdvisorCards,
  normalizeAdvisorResponse,
} from '../src/advisor-utils.js'

const redis = Redis.fromEnv()
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null
const geminiModels = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite,gemini-2.5-flash')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 40000)
export const geminiEnabled = Boolean(gemini)
export const twelveDataApiKey = process.env.TWELVE_DATA_API_KEY || 'demo'
export const finnhubApiKey = process.env.FINNHUB_API_KEY

const advisorCache = new Map()
const advisorModelCooldowns = new Map()

function normalizeRedisPayload(payload) {
  if (!payload) return null
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
  }
  return payload
}

export async function getDashboardState() {
  const cached = normalizeRedisPayload(await redis.get('dashboard:state'))
  if (cached) return cached
  await redis.set('dashboard:state', JSON.stringify(initialDashboardState))
  return initialDashboardState
}

export async function saveDashboardState(payload) {
  await redis.set('dashboard:state', JSON.stringify(payload))
  return payload
}

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }
  return null
}

export async function fetchJson(url, { timeoutMs = 9000 } = {}) {
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

export function createSyntheticSeries(currentPrice, previousClose) {
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

export async function fetchFinnhubQuote(symbol) {
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

export function getAdvisorCacheKey(context, question) {
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

export function getCachedAdvisorResponse(cacheKey) {
  const entry = advisorCache.get(cacheKey)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    advisorCache.delete(cacheKey)
    return null
  }
  return entry.value
}

export function setCachedAdvisorResponse(cacheKey, value) {
  advisorCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + 1000 * 60 * 10,
  })
}

export async function generateAdvisorWithGemini(context, question) {
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
        markModelCooldown(model, parseRetryDelayMs(error) ?? 60000)
      }
    }
  }

  throw lastError ?? new Error('No Gemini models are currently available.')
}

export function buildFallbackAdvisorResponse(context) {
  const fallback = fallbackAdvisorCards(context)
  return {
    source: 'fallback',
    model: null,
    ...fallback,
    answer: fallback.overview,
  }
}

export { buildAdvisorContext }
