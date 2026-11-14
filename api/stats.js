import { redis, stats, json } from './_lib.js'
export default async function handler(req, res) {
  try {
    const n = Number(new URL(req.url, 'http://x').searchParams.get('n')) || null
    json(res, 200, await stats(redis(), n), 60)
  } catch (e) { json(res, 500, { erreur: 'serveur' }) }
}
