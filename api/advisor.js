import {
  buildAdvisorContext,
  buildFallbackAdvisorResponse,
  geminiEnabled,
  generateAdvisorWithGemini,
  getAdvisorCacheKey,
  getCachedAdvisorResponse,
  getDashboardState,
  readJsonBody,
  setCachedAdvisorResponse,
} from './_utils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    const state = await getDashboardState()
    const context = buildAdvisorContext(state)
    const body = readJsonBody(req) || {}
    const question = body?.question?.trim() || 'Give me the most useful financial guidance based on my current dashboard.'
    const cacheKey = getAdvisorCacheKey(context, question)
    const cached = getCachedAdvisorResponse(cacheKey)

    if (cached) {
      res.status(200).json(cached)
      return
    }

    if (!geminiEnabled) {
      res.status(200).json(buildFallbackAdvisorResponse(context))
      return
    }

    const result = await generateAdvisorWithGemini(context, question)
    const payload = {
      source: 'gemini',
      model: result.model,
      ...result.parsed,
    }

    setCachedAdvisorResponse(cacheKey, payload)
    res.status(200).json(payload)
  } catch (error) {
    const state = await getDashboardState()
    const context = buildAdvisorContext(state)
    const fallback = buildFallbackAdvisorResponse(context)
    res.status(200).json({
      ...fallback,
      error: String(error),
    })
  }
}
