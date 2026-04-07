import { getDashboardState, readJsonBody, saveDashboardState } from './_utils.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const state = await getDashboardState()
    res.status(200).json(state)
    return
  }

  if (req.method === 'PUT') {
    const current = await getDashboardState()
    const body = readJsonBody(req) || {}
    const next = {
      ...current,
      ...body,
    }
    await saveDashboardState(next)
    res.status(200).json(next)
    return
  }

  res.status(405).json({ message: 'Method not allowed' })
}
