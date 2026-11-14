import { redis, enregistrer, body, json } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { erreur: 'methode' })
  try { const r = await enregistrer(redis(), await body(req)); json(res, r.erreur ? 400 : 200, r) }
  catch (e) { json(res, 500, { erreur: 'serveur' }) }
}
