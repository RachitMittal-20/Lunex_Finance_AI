export default function handler(_req, res) {
  res.status(200).json({ ok: true, date: new Date().toISOString() })
}
