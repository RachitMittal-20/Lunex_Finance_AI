async function parseApiResponse(response, fallbackMessage) {
  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(payload?.message || fallbackMessage)
  }

  return payload
}

export async function fetchDashboardState(signal) {
  const response = await fetch('/api/state', { signal })
  return parseApiResponse(response, 'Failed to load dashboard state')
}

export async function saveDashboardState(payload, signal) {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  return parseApiResponse(response, 'Failed to save dashboard state')
}

export async function fetchAdvisor(payload, signal) {
  const response = await fetch('/api/advisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  return parseApiResponse(response, 'Failed to load advisor')
}

export async function fetchMarket(symbol, signal) {
  const url = new URL('/api/market', window.location.origin)
  url.searchParams.set('symbol', symbol)
  const response = await fetch(url, { signal })

  return parseApiResponse(response, 'Failed to load market data')
}

export async function fetchStocks(symbols, signal) {
  const url = new URL('/api/stocks', window.location.origin)
  url.searchParams.set('symbols', symbols.join(','))
  const response = await fetch(url, { signal })

  return parseApiResponse(response, 'Failed to load stock data')
}
