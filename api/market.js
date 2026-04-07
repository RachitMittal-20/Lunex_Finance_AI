import {
  createSyntheticSeries,
  fetchFinnhubQuote,
  fetchJson,
  twelveDataApiKey,
} from './_utils.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    const symbol = String(req.query?.symbol || 'AAPL')
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

    res.status(200).json({
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
      const symbol = String(req.query?.symbol || 'AAPL')
      const fallback = await fetchFinnhubQuote(symbol)
      if (fallback) {
        res.status(200).json({
          source: 'finnhub-fallback',
          ...fallback,
          series: fallback.series || createSyntheticSeries(fallback.price, fallback.price - fallback.change),
        })
        return
      }
    } catch {
      // ignore fallback failure
    }

    res.status(500).json({ message: 'Failed to load market data.', error: String(error) })
  }
}
