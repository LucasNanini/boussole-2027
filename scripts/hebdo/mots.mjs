// Nuage de mots : les termes qu'un·e candidat·e emploie nettement plus que les autres cette semaine.
// Entrée : pour chaque candidat, les passages POLITIQUES (texte verbatim) de ses vidéos.
// Sortie : jusqu'à 30 termes { mot, n, score, extraits: [{ texte, url, date, plateforme }] }.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const EXCLUS = JSON.parse(fs.readFileSync(path.join(root, 'src/data/mots-exclus.json'), 'utf8'))
const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const VIDES = new Set([...EXCLUS.outils, ...EXCLUS.generiques].map((m) => sansAccent(m.toLowerCase())))

// expressions figées gardées en un seul terme (« pouvoir d'achat »…)
const EXPR = (EXCLUS.expressions || []).map((e) => {
  const cle = sansAccent(e.toLowerCase()).replace(/[^a-z0-9]+/g, '_')
  const re = new RegExp(e.toLowerCase().replace(/[’']/g, "[’']").replace(/ /g, '\\s+'), 'g')
  return { e, cle, re }
})
const AFFICHE_EXPR = new Map(EXPR.map((x) => [x.cle, x.e]))
function tokens(texte) {
  let t = texte.toLowerCase()
  for (const x of EXPR) t = t.replace(x.re, ' ' + x.cle + ' ')
  return t.replace(/[’']/g, ' ').split(/[^a-zà-öø-ÿœæç0-9_-]+/i)
    .map((w) => w.replace(/^-+|-+$/g, '')).filter(Boolean)
}
const garde = (t) => t.includes('_') || (t.length >= 4 && !/^\d+$/.test(t) && !VIDES.has(sansAccent(t)))

// clé de regroupement : sans accents, pluriel et féminin ramenés au radical s'il existe aussi
function cles(compte) {
  const forme = new Map()
  const keys = [...compte.keys()]
  const ks = new Set(keys)
  for (const k of keys) {
    let base = k
    for (const suf of ['es', 's', 'x', 'e']) {
      if (base.endsWith(suf) && ks.has(base.slice(0, -suf.length))) { base = base.slice(0, -suf.length); break }
    }
    forme.set(k, base)
  }
  return forme
}

export function nuages(parCandidat, { max = 30, minN = 2, exclus = [] } = {}) {
  for (const m of exclus) VIDES.add(sansAccent(m.toLowerCase()))
  // 1. comptes bruts (mots et paires de mots) par candidat, avec la forme d'affichage la plus fréquente
  const brut = {}, affichage = new Map(), extraitsPar = {}
  for (const [id, passages] of Object.entries(parCandidat)) {
    const c = new Map(); extraitsPar[id] = passages
    for (const p of passages) {
      const ts = tokens(p.texte)
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i]
        if (garde(t)) {
          const k = sansAccent(t); c.set(k, (c.get(k) || 0) + 1)
          const af = affichage.get(k) || new Map(); af.set(t, (af.get(t) || 0) + 1); affichage.set(k, af)
        }
        const u = ts[i + 1]
        if (u && garde(t) && garde(u)) {
          const k = sansAccent(t + ' ' + u); c.set(k, (c.get(k) || 0) + 1)
          const af = affichage.get(k) || new Map(); af.set(t + ' ' + u, (af.get(t + ' ' + u) || 0) + 1); affichage.set(k, af)
        }
      }
    }
    brut[id] = c
  }
  // 2. regroupement pluriel/féminin sur l'ensemble du vocabulaire de la semaine
  const tout = new Map()
  for (const c of Object.values(brut)) for (const [k, n] of c) tout.set(k, (tout.get(k) || 0) + n)
  const base = cles(tout)
  const regroupe = (c) => { const r = new Map(); for (const [k, n] of c) { const b = base.get(k) || k; r.set(b, (r.get(b) || 0) + n) } return r }
  const parId = Object.fromEntries(Object.entries(brut).map(([id, c]) => [id, regroupe(c)]))
  const total = regroupe(tout)
  const N = [...total.values()].reduce((a, b) => a + b, 0) || 1
  const afficher = (b) => {
    let best = null, bn = -1
    for (const [k, b2] of base) if (b2 === b) for (const [f, n] of affichage.get(k) || []) if (n > bn) { best = f; bn = n }
    best = best || b
    return best.includes('_') ? (AFFICHE_EXPR.get(sansAccent(best)) || best.replace(/_/g, ' ')) : best
  }
  const extraits = (id, b, lim = 2) => {
    const out = []
    for (const p of extraitsPar[id]) {
      for (const phrase of p.texte.split(/(?<=[.!?…])\s+/)) {
        const cible = b.includes('_') ? b.replace(/_/g, ' ') : b.split(' ')[0].slice(0, Math.max(4, b.split(' ')[0].length - 1))
        if (sansAccent(phrase.toLowerCase()).replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').includes(cible)) {
          const mots = phrase.trim().split(/\s+/)
          out.push({ texte: mots.length > 32 ? mots.slice(0, 32).join(' ') + ' […]' : phrase.trim(), url: p.url, date: p.date, plateforme: p.plateforme })
          break
        }
      }
      if (out.length >= lim) break
    }
    return out
  }
  // 3. score de spécificité : log-ratio lissé entre la fréquence chez le candidat et chez les autres
  const res = {}
  for (const [id, c] of Object.entries(parId)) {
    const n = [...c.values()].reduce((a, b) => a + b, 0) || 1
    const autresN = Math.max(1, N - n)
    const termes = []
    for (const [b, k] of c) {
      if (k < minN) continue
      const autres = (total.get(b) || 0) - k
      const score = Math.log((k + 0.5) / n) - Math.log((autres + 0.5) / autresN)
      if (score > 0) termes.push({ b, mot: afficher(b), n: k, score: Math.round(score * 100) / 100 })
    }
    termes.sort((a, z) => z.score * Math.log(1 + z.n) - a.score * Math.log(1 + a.n))
    // une paire de mots remplace ses mots isolés quand elle est presque aussi fréquente
    const paires = termes.filter((t) => t.b.includes(' '))
    const garder = termes.filter((t) => !(!t.b.includes(' ') && paires.some((p) => p.b.split(' ').includes(t.b) && p.n >= t.n * 0.6))).slice(0, max)
    res[id] = garder.map((t) => ({ mot: t.mot, n: t.n, score: t.score, extraits: extraits(id, t.b) }))
  }
  // 4. nuage de toute la campagne : termes les plus employés, avec qui les emploie
  const campagne = [...total.entries()].filter(([, k]) => k >= 3)
    .map(([b, k]) => ({ b, k, qui: Object.entries(parId).map(([id, c]) => [id, c.get(b) || 0]).filter(([, x]) => x > 0).sort((a, z) => z[1] - a[1]) }))
    .filter((t) => t.qui.length >= 2)
    .sort((a, z) => z.k - a.k).slice(0, 40)
    .map((t) => ({ mot: afficher(t.b), n: t.k, qui: t.qui.slice(0, 5).map(([id, x]) => ({ id, n: x })) }))
  return { parCandidat: res, campagne }
}
