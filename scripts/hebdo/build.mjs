// Usage : node scripts/hebdo/build.mjs 2026-W47           → brouillon
//         node scripts/hebdo/build.mjs 2026-W47 --publier → statut "publie"
import fs from 'node:fs'
import path from 'node:path'

const [semaine, flag] = process.argv.slice(2)
if (!/^\d{4}-W\d{2}$/.test(semaine || '')) { console.error('Semaine attendue au format 2026-W47'); process.exit(1) }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const out = path.join(root, 'src/data/hebdo', `${semaine}.json`)

if (flag === '--publier') {
  const h = JSON.parse(fs.readFileSync(out, 'utf8'))
  h.statut = 'publie'; h.publie_le = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(out, JSON.stringify(h, null, 1)); console.log('Publié :', out); process.exit(0)
}

const THEMES = JSON.parse(fs.readFileSync(path.join(root, 'src/data/themes.json'), 'utf8')).themes.map((t) => t.id)
const raw = JSON.parse(fs.readFileSync(path.join(root, 'scripts/hebdo/raw', `${semaine}.json`), 'utf8'))
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Lundi et dimanche de la semaine ISO
function bornes(s) {
  const [y, w] = s.split('-W').map(Number)
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const lundi = new Date(jan4); lundi.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7)
  const dim = new Date(lundi); dim.setUTCDate(lundi.getUTCDate() + 6)
  return [lundi, dim].map((d) => d.toISOString().slice(0, 10))
}
const [du, au] = bornes(semaine)
const erreurs = []
const candidats = {}

for (const [id, c] of Object.entries(raw.candidats)) {
  // seules comptent les vidéos qui contiennent au moins un passage politique (avec thème)
  const videos = (c.videos || []).filter((v) => (v.segments || []).length)
  if (!videos.length) continue
  const poids = Object.fromEntries(THEMES.map((t) => [t, 0]))
  let total = 0
  for (const v of videos) for (const s of v.segments || []) {
    if (!THEMES.includes(s.theme)) { erreurs.push(`${id} : thème inconnu « ${s.theme} »`); continue }
    poids[s.theme] += s.poids; total += s.poids
  }
  const themes = Object.fromEntries(THEMES.map((t) => [t, total ? Math.round((poids[t] / total) * 1000) / 10 : 0]))
  const transcripts = Object.fromEntries(videos.map((v) => [v.url, norm(v.transcription || '')]))
  const citations = (c.citations || []).slice(0, 5)
  for (const q of citations) {
    if (!transcripts[q.url]?.includes(norm(q.texte))) erreurs.push(`${id} : citation introuvable mot pour mot → « ${q.texte} »`)
    const n = q.texte.split(/\s+/).length
    if (n < 6 || n > 35) erreurs.push(`${id} : citation de ${n} mots (attendu 8–30)`)
  }
  if (citations.length < 5) erreurs.push(`${id} : seulement ${citations.length} citation(s)`)
  candidats[id] = { nb_videos: videos.length, themes, citations }
}

if (erreurs.some((e) => e.includes('introuvable') || e.includes('inconnu'))) {
  console.error('Brouillon refusé :\n- ' + erreurs.join('\n- ')); process.exit(1)
}
fs.mkdirSync(path.dirname(out), { recursive: true })
const COMPTES = JSON.parse(fs.readFileSync(path.join(root, 'src/data/comptes.json'), 'utf8')).comptes
const suivis = Object.keys(COMPTES).filter((k) => COMPTES[k].some((a) => a.valide && a.oriane_id))
fs.writeFileSync(out, JSON.stringify({ semaine, du, au, statut: 'brouillon', suivis, genere_le: new Date().toISOString(), candidats }, null, 1))
console.log(`Brouillon écrit : ${out} (${Object.keys(candidats).length} candidats)`)
if (erreurs.length) console.log('Avertissements :\n- ' + erreurs.join('\n- '))
