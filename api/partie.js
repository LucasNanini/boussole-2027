import { redis, enregistrer, kikadi, body, json } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { erreur: 'methode' })
  try { const b = await body(req); const r = b.jeu === 'kikadi' ? await kikadi(redis(), b) : await enregistrer(redis(), b); json(res, r.erreur ? 400 : 200, r) }
  catch (e) { json(res, 500, { erreur: 'serveur' }) }
}
