// Logique partagée des fonctions /api (préfixe « _ » : pas une route Vercel).
// Toutes les clés sont préfixées « b27: ».
import { Redis } from '@upstash/redis'

let client
export function redis() {
  if (!client) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    client = new Redis({ url, token })
  }
  return client
}

export const K = {
  total: 'b27:parties',
  joueurs: 'b27:joueurs',
  joueursJour: (d) => `b27:joueurs:${d}`,
  visiteurs: 'b27:visiteurs',
  visiteursJour: (d) => `b27:visiteurs:${d}`,
  partie: (n, j) => `b27:p:${n}:${j}`,
  distrib: (n) => `b27:d:${n}`,
  user: (j) => `b27:u:${j}`,
  lb: 'b27:classement',
  jour: (n) => `b27:jour:${n}`,  // score = clues (7 = raté) × 1e13 + horodatage : à égalité, le plus rapide devant
  moy: 'b27:moyenne',
  num: (n) => `b27:num:${n}`,
  pseudo: (cle) => `b27:pseudo:${cle}`, // pseudo normalisé → joueur (unicité)
  migr: 'b27:migration:2',     // numéro public aléatoire (5 chiffres) des joueurs sans pseudo            // moyenne d'indices, minimum 5 parties
  code: (c) => `b27:code:${c}`,
}

export const jourParis = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
export const ID_RE = /^[a-f0-9-]{36}$/

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body
  try { return JSON.parse(req.body || '{}') } catch { return {} }
}
export function json(res, status, data, cacheSeconds = 0) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', cacheSeconds ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 5}` : 'no-store')
  res.end(JSON.stringify(data))
}

/* ---------- Pseudos ---------- */
const INTERDITS = ['con', 'conne', 'connard', 'connasse', 'pute', 'salope', 'encule', 'enculé', 'merde', 'nazi', 'hitler', 'pd', 'negre', 'nègre', 'bougnoule', 'youpin', 'fdp', 'ntm', 'tafiole', 'admin', 'boussole', 'movo', 'moderateur', 'modérateur']
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
export function pseudoValide(p) {
  if (typeof p !== 'string') return null
  const s = p.trim().replace(/\s+/g, ' ')
  if (s.length < 2 || s.length > 15) return null
  if (!/^[\p{L}\p{N} _.-]+$/u.test(s)) return null
  if (/^joueur[\s_.-]*\d+$/i.test(norm(s))) return null // réservé aux joueurs sans pseudo
  const mots = norm(s).split(/[\s_.-]+/)
  const colle = norm(s).replace(/[\s_.-]+/g, '')
  if (INTERDITS.some((w) => mots.includes(norm(w)) || (norm(w).length > 4 && colle.includes(norm(w))))) return null
  return s
}

/* ---------- Statistiques publiques ---------- */
// Numéro public aléatoire à 5 chiffres : il n'indique pas combien de joueurs il y a.
export async function numeroPublic(r, joueur, u) {
  if (u?.num) return u.num
  for (let t = 0; t < 10; t++) {
    const n = String(10000 + Math.floor(Math.random() * 90000))
    if (await r.set(K.num(n), joueur, { nx: true })) { await r.hset(K.user(joueur), { num: n }); return n }
  }
  return null
}
const nomPublic = (u) => u.pseudo || (u.num ? `Joueur ${u.num}` : null)

async function avecPseudos(r, raw, champs = []) {
  const ids = []; for (let i = 0; i < raw.length; i += 2) ids.push([raw[i], Number(raw[i + 1])])
  if (!ids.length) return []
  const q = r.pipeline(); ids.forEach(([id]) => q.hmget(K.user(id), 'pseudo', 'num', ...champs))
  const users = await q.exec()
  // un pseudo n'est affiché que pour le joueur qui le détient ; les doublons d'avant l'unicité redeviennent « Joueur N »
  const q2 = r.pipeline(); users.forEach((u) => q2.get(K.pseudo(u?.pseudo ? clePseudo(u.pseudo) : '-')))
  const proprios = await q2.exec()
  const out = []
  for (let i = 0; i < ids.length; i++) {
    const u = { ...(users[i] || {}) }
    if (u.pseudo && proprios[i] && proprios[i] !== ids[i][0]) u.pseudo = null
    if (!u.pseudo && !u.num) u.num = await numeroPublic(r, ids[i][0], u) // joueurs d'avant les numéros
    out.push({ ...u, nom: nomPublic(u), score: ids[i][1] })
  }
  return out.filter((u) => u.nom)
}

export function numeroServeur(date = new Date()) {
  const [y, m, d] = jourParis(date).split('-').map(Number)
  return Math.max(1, Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 10, 14)) / 86400000) + 1)
}
// Migration unique : remet dans les classements les parties jouées avant leur création,
// donne un numéro aux joueurs anonymes et réserve les pseudos déjà pris.
async function migrer(r) {
  if (await r.get(K.migr)) return
  if (!(await r.set(K.migr + ':verrou', 1, { nx: true, ex: 120 }))) return
  const auj = jourParis(), n = numeroServeur()
  let curseur = '0'
  do {
    const [suivant, cles] = await r.scan(curseur, { match: 'b27:u:*', count: 500 })
    curseur = String(suivant)
    for (const k of cles) {
      const joueur = k.slice('b27:u:'.length)
      const u = (await r.hgetall(k)) || {}
      if (!Number(u.joues)) continue
      if (!u.num) u.num = await numeroPublic(r, joueur, u)
      if (u.pseudo) await r.set(K.pseudo(clePseudo(u.pseudo)), joueur, { nx: true })
      await r.zadd(K.lb, { score: Number(u.serie) || 0, member: joueur })
      if (u.jour === auj) {
        const e = Number(u.dernier) === n && Number(u.meilleur) ? Number(u.meilleur) : 7
        await r.zadd(K.jour(n), { score: e * 1e13 + Date.now(), member: joueur })
      }
    }
  } while (curseur !== '0')
  await r.set(K.migr, Date.now())
}

export async function stats(r, numero) {
  try { await migrer(r) } catch { /* sans gravité : réessayé à la prochaine lecture, après 2 min */ }
  const d = jourParis()
  const p = r.pipeline()
  p.get(K.total); p.pfcount(K.joueursJour(d)); p.pfcount(K.joueurs); p.pfcount(K.visiteurs)
  p.hgetall(K.distrib(numero || 0))
  p.zrange(K.lb, 0, 59, { rev: true, withScores: true })
  p.zrange(K.jour(numero || 0), 0, 59, { withScores: true })
  p.zrange(K.moy, 0, 59, { withScores: true })
  const [parties, joueursJour, joueurs, visiteurs, distribRaw, lbRaw, jourRaw, moyRaw] = await p.exec()
  const hier = jourParis(new Date(Date.now() - 86400000))
  // séries : seulement celles encore actives (jouées hier ou aujourd'hui)
  const classement = (await avecPseudos(r, lbRaw || [], ['jour']))
    .filter((u) => u.score > 0 && (u.jour === d || u.jour === hier))
    .slice(0, 20).map((u) => ({ pseudo: u.nom, serie: u.score }))
  const classementJour = numero ? (await avecPseudos(r, jourRaw || []))
    .slice(0, 20).map((u) => { const e = Math.floor(u.score / 1e13); return { pseudo: u.nom, essais: e === 7 ? null : e } }) : []
  const classementMoyenne = (await avecPseudos(r, moyRaw || [], ['nb']))
    .slice(0, 20).map((u) => ({ pseudo: u.nom, moyenne: Math.round(u.score * 10) / 10, parties: Number(u.nb) || 0 }))
  return {
    parties: Number(parties) || 0, joueursJour: joueursJour || 0, joueurs: joueurs || 0, visiteurs: visiteurs || 0,
    distrib: numero ? distribRaw || {} : null, classement, classementJour, classementMoyenne,
  }
}

/* ---------- Enregistrer une partie terminée ---------- */
export async function enregistrer(r, { joueur, numero, essais, gagne }) {
  const n = Number(numero), e = Number(essais)
  if (!ID_RE.test(joueur || '') || !Number.isInteger(n) || n < 1 || n > 2000 || !Number.isInteger(e) || e < 1 || e > 6) return { erreur: 'invalide' }
  const nouveau = await r.set(K.partie(n, joueur), 1, { nx: true, ex: 60 * 60 * 24 * 400 })
  const u = (await r.hgetall(K.user(joueur))) || {}
  if (!nouveau) return { deja: true, user: publicUser(u) }
  u.num = await numeroPublic(r, joueur, u)
  const d = jourParis()
  const dernier = Number(u.dernier) || 0
  const serie = gagne ? (dernier === n - 1 ? (Number(u.serie) || 0) + 1 : 1) : 0
  const next = {
    serie, dernier: gagne ? n : dernier, jour: d,
    joues: (Number(u.joues) || 0) + 1, gagnes: (Number(u.gagnes) || 0) + (gagne ? 1 : 0),
    meilleur: gagne ? Math.min(Number(u.meilleur) || 7, e) : Number(u.meilleur) || 0,
    record: Math.max(Number(u.record) || 0, serie),
    somme: (Number(u.somme) || 0) + (gagne ? e : 7), // un raté compte 7 indices
    nb: (Number(u.nb) || 0) + 1, // parties comptées dans la moyenne (depuis son lancement)
  }
  const p = r.pipeline()
  p.incr(K.total)
  p.hincrby(K.distrib(n), gagne ? String(e) : 'X', 1)
  p.pfadd(K.joueursJour(d), joueur); p.expire(K.joueursJour(d), 60 * 60 * 24 * 8)
  p.pfadd(K.joueurs, joueur)
  p.hset(K.user(joueur), next)
  p.zadd(K.lb, { score: serie, member: joueur })
  p.zadd(K.jour(n), { score: (gagne ? e : 7) * 1e13 + Date.now(), member: joueur }); p.expire(K.jour(n), 60 * 60 * 24 * 40)
  if (next.nb >= 5) p.zadd(K.moy, { score: next.somme / next.nb, member: joueur })
  await p.exec()
  return { ok: true, user: publicUser({ ...u, ...next }) }
}

export const publicUser = (u) => ({
  pseudo: u.pseudo || null, num: u.num || null, nom: u.pseudo || (u.num ? `Joueur ${u.num}` : null), serie: Number(u.serie) || 0, dernier: Number(u.dernier) || 0,
  joues: Number(u.joues) || 0, gagnes: Number(u.gagnes) || 0, meilleur: Number(u.meilleur) || null,
  record: Number(u.record) || 0, code: u.code || null,
})

/* ---------- Code de sauvegarde ---------- */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans 0/O ni 1/I
export async function codePour(r, joueur) {
  if (!ID_RE.test(joueur || '')) return { erreur: 'invalide' }
  const u = (await r.hgetall(K.user(joueur))) || {}
  if (u.code) return { code: u.code }
  for (let t = 0; t < 5; t++) {
    const c = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')
    if (await r.set(K.code(c), joueur, { nx: true })) { await r.hset(K.user(joueur), { code: c }); return { code: c } }
  }
  return { erreur: 'reessayer' }
}
export async function recuperer(r, code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (c.length !== 6) return { erreur: 'code' }
  const joueur = await r.get(K.code(c))
  if (!joueur) return { erreur: 'code' }
  const u = (await r.hgetall(K.user(joueur))) || {}
  return { joueur, user: publicUser(u) }
}
export async function choisirPseudo(r, joueur, pseudo) {
  if (!ID_RE.test(joueur || '')) return { erreur: 'invalide' }
  const p = pseudoValide(pseudo)
  if (!p) return { erreur: 'pseudo' }
  const u = (await r.hgetall(K.user(joueur))) || {}
  const cle = clePseudo(p)
  if (u.pseudo && clePseudo(u.pseudo) === cle) {
    await r.hset(K.user(joueur), { pseudo: p }) // même pseudo, autre casse
    return { ok: true, pseudo: p }
  }
  const pris = await r.set(K.pseudo(cle), joueur, { nx: true })
  if (!pris && (await r.get(K.pseudo(cle))) !== joueur) return { erreur: 'pris' }
  if (u.pseudo) await r.del(K.pseudo(clePseudo(u.pseudo))) // libère l'ancien
  await r.hset(K.user(joueur), { pseudo: p })
  await r.zadd(K.lb, { score: Number(u.serie) || 0, member: joueur })
  return { ok: true, pseudo: p }
}
export const clePseudo = (p) => norm(p).replace(/[\s_.-]+/g, '')
export async function visite(r, id) {
  if (!ID_RE.test(id || '')) return { erreur: 'invalide' }
  const d = jourParis()
  const p = r.pipeline()
  p.pfadd(K.visiteurs, id); p.pfadd(K.visiteursJour(d), id); p.expire(K.visiteursJour(d), 60 * 60 * 24 * 8)
  await p.exec()
  return { ok: true }
}

// Kikadi : 5 citations par jour, score sur 5. Une partie comptée par joueur et par jour.
export async function kikadi(r, { joueur, numero, score }) {
  const n = Number(numero), sc = Number(score)
  if (!ID_RE.test(joueur || '') || !Number.isInteger(n) || n < 1 || n > 2000) return { erreur: 'invalide' }
  const cle = `b27:kkd:${n}`
  if (Number.isInteger(sc) && sc >= 0 && sc <= 5) {
    const nouveau = await r.set(`b27:kk:${n}:${joueur}`, 1, { nx: true, ex: 60 * 60 * 24 * 60 })
    if (nouveau) {
      const d = jourParis()
      const p = r.pipeline()
      p.incr(K.total); p.hincrby(cle, String(sc), 1); p.expire(cle, 60 * 60 * 24 * 60)
      p.pfadd(K.joueursJour(d), joueur); p.expire(K.joueursJour(d), 60 * 60 * 24 * 8)
      p.pfadd(K.joueurs, joueur)
      await p.exec()
    }
  }
  return { ok: true, distrib: (await r.hgetall(cle)) || {} }
}

// Swipe : on compte seulement les parties, jamais les réponses (ce sont des opinions politiques).
export async function swipe(r, { joueur }) {
  if (!ID_RE.test(joueur || '')) return { erreur: 'invalide' }
  const d = jourParis()
  const p = r.pipeline()
  p.incr(K.total); p.pfadd(K.joueursJour(d), joueur); p.expire(K.joueursJour(d), 60 * 60 * 24 * 8); p.pfadd(K.joueurs, joueur)
  await p.exec()
  return { ok: true }
}
