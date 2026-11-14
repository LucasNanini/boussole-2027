import DATA from './data/candidats.json'

export const SOURCES = DATA.sources
export const META = DATA._meta
export const CANDIDATS = DATA.candidats

export const FAMILLES = {
  exg: { label: 'Extrême gauche', bloc: 'gauche' },
  g: { label: 'Gauche', bloc: 'gauche' },
  eco: { label: 'Écologiste', bloc: 'ecologiste' },
  c: { label: 'Centre', bloc: 'centre' },
  div: { label: 'Divers / sans étiquette', bloc: 'centre' },
  d: { label: 'Droite', bloc: 'droite' },
  exd: { label: 'Extrême droite', bloc: 'droite' },
}

export const BLOCS = {
  gauche: { label: 'Gauche', color: '#C8102E' },
  ecologiste: { label: 'Écologistes', color: '#146B3A' },
  centre: { label: 'Centre & divers', color: '#5E6272' },
  droite: { label: 'Droite', color: '#1F4BB8' },
}

export const blocOf = (c) => BLOCS[FAMILLES[c.famille].bloc]
export const blocId = (c) => FAMILLES[c.famille].bloc

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export function dateFr(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}`
}

export function initiales(nom) {
  return nom.split(/[\s-]+/).filter((w) => /^[A-ZÉÈÀ]/.test(w)).map((w) => w[0]).slice(0, 2).join('')
}

/* ---------- Mystère du jour ---------- */
export const LANCEMENT = '2026-11-16' // n°1
export const PREMIER_TOUR = '2027-04-18'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function shuffle(arr, seed) {
  const r = rng(seed)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DAY = 86400000
const parisDay = (date) => {
  const s = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  return Date.UTC(...s.split('-').map((n, i) => (i === 1 ? n - 1 : +n)))
}
export function numeroDuJour(date = new Date()) {
  const start = Date.UTC(2026, 10, 16)
  return Math.max(1, Math.floor((parisDay(date) - start) / DAY) + 1)
}
export function joursAvant(iso, date = new Date()) {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.max(0, Math.round((Date.UTC(y, m - 1, d) - parisDay(date)) / DAY))
}

// Pool : candidats avec une « ligne » sourcée. 2 principaux pour 1 autre.
export const POOL = CANDIDATS.filter((c) => c.ligne)
const SEQUENCE = (() => {
  const p = shuffle(POOL.filter((c) => c.principal), 2027)
  const o = shuffle(POOL.filter((c) => !c.principal), 1958)
  const seq = []
  let i = 0, j = 0
  while (i < p.length || j < o.length) {
    if (i < p.length) seq.push(p[i++])
    if (i < p.length) seq.push(p[i++])
    if (j < o.length) seq.push(o[j++])
  }
  return seq
})()

export function mystere(numero) {
  const cycle = Math.floor((numero - 1) / SEQUENCE.length)
  const seq = cycle === 0 ? SEQUENCE : shuffle(SEQUENCE, 7 + cycle)
  return seq[(numero - 1) % seq.length]
}

export function plateau(numero, reponse) {
  const autres = shuffle(CANDIDATS.filter((c) => c.id !== reponse.id), 99 + numero).slice(0, 11)
  return [...autres, reponse].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

export function indices(c) {
  const exp = c.candidatures.length
    ? `Déjà candidat·e à la présidentielle en ${c.candidatures.join(', ').replace(/, (\d+)$/, ' et $1')}.`
    : 'Jamais candidat·e à une présidentielle jusqu\'ici.'
  return [
    { type: 'Date clé', texte: c.annonce ? `Candidature annoncée le ${dateFr(c.annonce)}.` : `${c.annonce_texte[0].toUpperCase()}${c.annonce_texte.slice(1)}.` },
    { type: 'Expérience', texte: exp },
    { type: 'Ligne', texte: c.ligne },
    { type: 'Famille politique', texte: FAMILLES[c.famille].label, bloc: blocOf(c) },
    { type: 'Fonction', texte: c.fonction },
    { type: 'Parti', texte: c.parti },
  ]
}

/* ---------- Stockage local (best effort) ---------- */
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* privé */ } },
}
