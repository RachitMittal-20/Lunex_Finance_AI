import { fetchJson, finnhubApiKey } from './_utils.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    if (!finnhubApiKey) {
      res.status(400).json({ message: 'Finnhub is not configured. Add FINNHUB_API_KEY.' })
      return
    }

    const symbols = String(req.query?.symbols || 'AAPL,MSFT,NVDA,TSLA')
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

    res.status(200).json({
      source: 'finnhub',
      updatedAt: new Date().toISOString(),
      partial: stocks.length !== symbols.length,
      stocks,
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to load stock monitoring data.', error: String(error) })
  }
}
