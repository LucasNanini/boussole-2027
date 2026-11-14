// POST { action: 'code' | 'recuperer' | 'pseudo' | 'visite', joueur, code, pseudo }
import { redis, codePour, recuperer, choisirPseudo, visite, publicUser, K, ID_RE, body, json } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { erreur: 'methode' })
  try {
    const b = await body(req), r = redis()
    let out
    if (b.action === 'code') out = await codePour(r, b.joueur)
    else if (b.action === 'recuperer') out = await recuperer(r, b.code)
    else if (b.action === 'pseudo') out = await choisirPseudo(r, b.joueur, b.pseudo)
    else if (b.action === 'visite') out = await visite(r, b.joueur)
    else if (b.action === 'moi') out = ID_RE.test(b.joueur || '') ? { user: publicUser((await r.hgetall(K.user(b.joueur))) || {}) } : { erreur: 'invalide' }
    else out = { erreur: 'action' }
    json(res, out.erreur ? 400 : 200, out)
  } catch (e) { json(res, 500, { erreur: 'serveur' }) }
}
