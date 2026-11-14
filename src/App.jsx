import { useEffect, useMemo, useState } from 'react'
import {
  CANDIDATS, SOURCES, META, FAMILLES, BLOCS, blocOf, blocId, dateFr, initiales,
  numeroDuJour, joursAvant, PREMIER_TOUR, mystere, plateau, indices, shuffle, store,
  joueurId, api, syncStats, fmt,
} from './lib.js'
import THEMES from './data/themes.json'
import COMPTES from './data/comptes.json'
import RAW from './data/candidats.json'
const DATA_EXTRA = RAW.a_verifier_hors_liste

const EDITIONS = Object.values(import.meta.glob('./data/hebdo/*.json', { eager: true, import: 'default' }))
  .sort((a, b) => b.semaine.localeCompare(a.semaine))
const editions = () => EDITIONS.filter((h) => h.statut === 'publie' || window.location.hash.includes('apercu'))

/* ---------------- routing ---------------- */
// Adresse affichée dans les partages : celle où l'app est réellement servie.
const SITE = typeof location !== 'undefined' && location.host ? location.host : 'movo-2027.vercel.app'

function useRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'accueil')
  const [r, setR] = useState(get)
  useEffect(() => {
    const on = () => { setR(get()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
function useStats(n) {
  const [st, setSt] = useState(null)
  useEffect(() => { let on = true; api(`/api/stats${n ? `?n=${n}` : ''}`).then((j) => { if (on && j && !j.erreur) setSt(j) }); return () => { on = false } }, [n])
  return st
}
const go = (r) => { window.location.hash = r === 'accueil' ? '' : r }

/* ---------------- petits composants ---------------- */
const Tricolore = ({ vertical }) => (
  <div className={vertical ? 'tri tri-v' : 'tri'} aria-hidden="true"><span /><span /><span /></div>
)
const Icon = ({ d, size = 20, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>
)
const I = {
  back: <polyline points="15 18 9 12 15 6" />,
  next: <polyline points="9 18 15 12 9 6" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  compass: <><circle cx="12" cy="12" r="10" /><polygon points="16 8 13.5 13.5 8 16 10.5 10.5 16 8" /></>,
  share: <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
}

function Header({ back = 'accueil', title, right }) {
  return (
    <header className="bar">
      <button className="icon-btn" aria-label="Retour" onClick={() => go(back)}><Icon d={I.back} /></button>
      <span className="bar-title">{title}</span>
      <span className="bar-right">{right}</span>
    </header>
  )
}

function Portrait({ c, size = 72, radius = 16 }) {
  const [ok, setOk] = useState(true)
  const color = blocOf(c).color
  return (
    <div className="portrait" style={{ width: size, height: size, borderRadius: radius, background: color }}>
      {ok
        ? <img src={`${import.meta.env.BASE_URL}candidats/${c.id}.jpg`} alt="" onError={() => setOk(false)} />
        : <span style={{ fontSize: size * 0.36 }}>{initiales(c.nom)}</span>}
    </div>
  )
}

const BlocChip = ({ c }) => {
  const b = blocOf(c)
  return <span className="chip" style={{ background: b.color, color: '#fff' }}>{FAMILLES[c.famille].label.toUpperCase()}</span>
}

const SourceLinks = ({ ids }) => (
  <span className="sources">
    {ids.map((s, i) => (
      <a key={s} href={SOURCES[s].url} target="_blank" rel="noreferrer">{SOURCES[s].titre.split(' – ')[0]}{i < ids.length - 1 ? ', ' : ''}</a>
    ))}
  </span>
)

/* ---------------- Accueil ---------------- */
function Accueil() {
  const n = numeroDuJour()
  const etat = store.get(`qec-${n}`, null)
  const stats = store.get('qec-stats', { serie: 0 })
  const st = useStats()
  return (
    <main className="screen">
      <header className="home-head">
        <div className="brand-col"><div className="brand"><b className="logo">MO<span>V</span>O</b><span className="pill-dark">2027</span></div><span className="muted tiny b">Mais où va-t-on ?</span></div>
        <span className="muted small b">J-{joursAvant(PREMIER_TOUR)} avant le 1er tour</span>
      </header>
      {st && (st.visiteurs > 0 || st.parties > 0) && (
        <div className="counter" aria-label="Compteurs publics">
          {st.visiteurs > 0 && <span><b>{fmt(st.visiteurs)}</b> visiteurs</span>}
          {st.parties > 0 && <span><b>{fmt(st.parties)}</b> parties jouées</span>}
          {st.joueursJour > 0 && <span><b>{fmt(st.joueursJour)}</b> joueurs aujourd'hui</span>}
        </div>
      )}

      <section className="hero">
        <div className="hero-flag"><Tricolore vertical /></div>
        <div className="hero-body">
          <span className="eyebrow light">Le mystère du jour · #{n}</span>
          <h1>Qui est-ce ?</h1>
          <p>Un·e candidat·e mystère. 6 indices maximum. Moins vous en utilisez, plus vous marquez.</p>
          <span className="pill-ghost">Série : {stats.serie} jour{stats.serie > 1 ? 's' : ''}</span>
        </div>
        <button className="btn btn-light" onClick={() => go('jeu')}>
          {etat?.fini ? 'Voir mon résultat' : etat?.essais?.length ? 'Reprendre la partie' : 'Jouer au mystère du jour'}
        </button>
        <span className="small center light-muted">Nouveau mystère chaque jour à minuit</span>
      </section>

      <a className="lb-link" href="#classement">
        <span className="col"><b>Le classement des séries</b><span className="muted small">{st?.classement?.[0] ? `En tête : ${st.classement[0].pseudo}, ${st.classement[0].serie} jour${st.classement[0].serie > 1 ? 's' : ''} d'affilée` : 'Qui tiendra la plus longue série ?'}</span></span>
        <Icon d={I.next} />
      </a>

      <div className="row-between"><h2>Les modes</h2><span className="muted small">4 ouverts · 2 bientôt</span></div>
      <div className="grid2">
        <ModeCard on title="Qui est-ce ?" sub="Devinez à partir d'indices" to="jeu" />
        <ModeCard on title="Le Trombino" sub={`Les ${CANDIDATS.length} candidatures, carte par carte`} to="trombino" />
        <ModeCard on title="L'hebdo" sub="Leurs 5 phrases de la semaine" to="hebdo" />
        <ModeCard on title="De quoi parlent-ils ?" sub="Les thèmes, semaine après semaine" to="themes" />
        <ModeCard title="À l'aveugle" sub="Des idées sans les noms" to="aveugle" tag="JANVIER" />
        <ModeCard title="Mon cap" sub="Le comparateur, liste officielle" to="cap" tag="MARS 2027" />
      </div>

      <footer className="foot"><span>Neutre · sourcé · sans compte</span><a href="#methodo">Méthodologie</a></footer>
    </main>
  )
}
const ModeCard = ({ on, title, sub, to, tag }) => (
  <a className={on ? 'mode' : 'mode mode-soon'} href={`#${to}`}>
    <span className={on ? 'tag tag-on' : 'tag'}>{on ? 'EN LIGNE' : tag}</span>
    <b>{title}</b>
    <span className="muted small">{sub}</span>
  </a>
)

/* ---------------- Qui est-ce ? ---------------- */
// Mettre à true pour afficher les couleurs de parti dès le début (rend l'indice 4 inutile).
const COULEURS_TOUJOURS = false

function TileFace({ c }) {
  const [ok, setOk] = useState(true)
  return (
    <span className="tile-face">
      {ok ? <img src={`${import.meta.env.BASE_URL}candidats/${c.id}.jpg`} alt="" loading="lazy" onError={() => setOk(false)} />
        : <span>{initiales(c.nom)}</span>}
    </span>
  )
}
function Jeu() {
  const n = numeroDuJour()
  const rep = useMemo(() => mystere(n), [n])
  const board = useMemo(() => plateau(n, rep), [n, rep])
  const clues = useMemo(() => indices(rep), [rep])
  const key = `qec-${n}`
  const [etat, setEtat] = useState(() => store.get(key, { essais: [], fini: false, gagne: false }))
  const [saisie, setSaisie] = useState('')
  const [msg, setMsg] = useState('')
  const vus = Math.min(6, etat.essais.length + 1)
  const points = 100 - 15 * (vus - 1)
  const couleursVisibles = COULEURS_TOUJOURS || vus >= 4

  const proposer = (c) => {
    if (etat.fini || !c || etat.essais.includes(c.id)) return
    const essais = [...etat.essais, c.id]
    const gagne = c.id === rep.id
    const fini = gagne || essais.length >= 6
    const next = { essais, fini, gagne }
    setEtat(next); store.set(key, next); setSaisie('')
    setMsg(gagne ? '' : fini ? '' : `Non, ce n'est pas ${c.nom}. Nouvel indice !`)
    if (fini) finirPartie(n, next)
  }
  const valider = (e) => {
    e.preventDefault()
    const q = saisie.trim().toLowerCase()
    const c = CANDIDATS.find((x) => x.nom.toLowerCase() === q) || CANDIDATS.find((x) => x.nom.toLowerCase().includes(q) && q.length > 2)
    if (!c) { setMsg('Choisissez un nom dans la liste.'); return }
    proposer(c)
  }

  if (etat.fini) return <Resultat n={n} rep={rep} etat={etat} clues={clues} />

  return (
    <main className="screen">
      <Header title={`Qui est-ce ? #${n}`} right={<span className="pts">{points} pts</span>} />
      <div className="dots" aria-label={`${vus} indices sur 6`}>
        {clues.map((_, i) => <span key={i} className={i < vus ? 'on' : ''} />)}
      </div>
      <section className="stack8">
        {clues.map((c, i) => i < vus ? (
          <div key={i} className="clue">
            <span className="num">{i + 1}</span>
            <span className="col">
              <span className="eyebrow">{c.type}</span>
              <span>{c.bloc && <i className="dot" style={{ background: c.bloc.color }} />}{c.texte}</span>
            </span>
          </div>
        ) : (
          <div key={i} className="clue-hidden"><span>Indice {i + 1} · {c.type}</span><span>−15 pts</span></div>
        ))}
      </section>
      <p className="msg" role="status">{msg}</p>

      <div className="row-between"><b>Le plateau</b><span className="muted small">Touchez un visage pour proposer</span></div>
      <div className="board">
        {board.map((c) => {
          const out = etat.essais.includes(c.id)
          const color = couleursVisibles ? blocOf(c).color : '#C9CAD6'
          return (
            <button key={c.id} className={out ? 'tile out' : 'tile'} disabled={out} onClick={() => proposer(c)} aria-label={`Proposer ${c.nom}${out ? ' (déjà proposé)' : ''}`}>
              <TileFace c={c} />
              <span className="tile-name">{c.nom.split(' ').slice(-1)[0]}</span>
              <span className="tile-bar" style={{ background: color }} />
            </button>
          )
        })}
      </div>
      <span className="muted small">{couleursVisibles ? 'Couleurs des familles politiques débloquées (indice 4).' : 'Les couleurs des familles s\'affichent avec l\'indice 4.'}</span>

      <form className="guess" onSubmit={valider}>
        <label className="sr" htmlFor="g">Votre réponse</label>
        <input id="g" list="noms" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Ou tapez un nom…" autoComplete="off" />
        <datalist id="noms">{CANDIDATS.map((c) => <option key={c.id} value={c.nom} />)}</datalist>
        <button className="btn btn-dark" type="submit">Valider</button>
      </form>
    </main>
  )
}

// Compte une partie terminée, une seule fois en local et une seule fois côté serveur.
// Rejouable sans risque : rattrape une partie finie dont la série ou l'envoi n'ont pas été enregistrés.
function finirPartie(n, { essais, gagne }, apres) {
  const s = store.get('qec-stats', { serie: 0, dernier: 0, joues: 0, gagnes: 0, meilleur: null })
  const dejaCompte = s.fin === n || (gagne && s.dernier === n)
  if (!dejaCompte) {
    s.joues = (s.joues || 0) + 1
    if (gagne) {
      s.gagnes = (s.gagnes || 0) + 1
      s.serie = s.dernier === n - 1 ? (s.serie || 0) + 1 : 1
      s.dernier = n
      s.meilleur = s.meilleur ? Math.min(s.meilleur, essais.length) : essais.length
    } else s.serie = 0
  }
  s.fin = n
  store.set('qec-stats', s)
  if (store.get(`qec-envoye-${n}`, false)) return
  api('/api/partie', { joueur: joueurId(), numero: n, essais: essais.length, gagne }).then((j) => {
    if (j?.ok || j?.deja) store.set(`qec-envoye-${n}`, true)
    if (j?.user) syncStats(j.user)
    apres?.()
  })
}

function grille(etat) {
  return Array.from({ length: 6 }, (_, i) => {
    if (i < etat.essais.length - 1) return 'rate'
    if (i === etat.essais.length - 1) return etat.gagne ? 'win' : 'rate'
    return 'vide'
  })
}
function texteGrille(n, etat) {
  const sq = grille(etat).map((g) => (g === 'win' ? '🟩' : g === 'rate' ? '🟥' : '⬜')).join('')
  return `MOVO 2027 · Qui est-ce ? #${n}\n${sq} ${etat.gagne ? etat.essais.length : 'X'}/6\nEt toi, tu le/la reconnais ? ${SITE}`
}

function Resultat({ n, rep, etat, clues }) {
  const [copie, setCopie] = useState('')
  const [stats, setStats] = useState(() => store.get('qec-stats', { serie: 0, meilleur: null }))
  useEffect(() => {
    const maj = () => setStats(store.get('qec-stats', { serie: 0, meilleur: null }))
    finirPartie(n, etat, maj); maj()
  }, [n])
  const pts = etat.gagne ? 100 - 15 * (etat.essais.length - 1) : 0
  const partagerTexte = async () => {
    const t = texteGrille(n, etat)
    try {
      if (navigator.share) await navigator.share({ text: t })
      else { await navigator.clipboard.writeText(t); setCopie('Copié ! Collez-le où vous voulez.') }
    } catch { /* annulé */ }
  }
  const partagerStory = async () => {
    const blob = await story(n, etat)
    const file = new File([blob], `movo-qui-est-ce-${n}.png`, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: SITE }); return }
    } catch { return }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click()
  }
  return (
    <main className="screen">
      <Header title="" right={<span className="muted small b">Série : {stats.serie} · Meilleur : {stats.meilleur ?? '–'}/6</span>} />
      <div className="center stack4">
        <span className="eyebrow">Qui est-ce ? #{n}</span>
        <h1 className="h1">{etat.gagne ? `Trouvé en ${etat.essais.length} indice${etat.essais.length > 1 ? 's' : ''}` : 'Raté pour aujourd\'hui'}</h1>
        <span className="b">{pts} pts</span>
      </div>

      <section className="card-reveal">
        <div className="reveal-band" style={{ background: blocOf(rep).color }} />
        <div className="stack12 pad16">
          <div className="row12">
            <Portrait c={rep} />
            <div className="stack4">
              <b className="name">{rep.nom}</b>
              <span className="muted small">{rep.parti} · {rep.fonction}</span>
              <div className="row6"><BlocChip c={rep} /><span className="chip">DÉCLARÉ·E</span></div>
            </div>
          </div>
          <div className="divider stack8">
            <span className="eyebrow">Les 6 indices</span>
            {clues.map((c, i) => <span key={i} className="small">{i + 1} · {c.texte}</span>)}
            <span className="small muted">Sources : <SourceLinks ids={rep.sources} /></span>
          </div>
          <a className="b" href={`#fiche-${rep.id}`}>Voir sa fiche</a>
        </div>
      </section>

      <Distribution n={n} etat={etat} />

      <section className="share">
        <span className="eyebrow light">Votre grille, sans spoiler</span>
        <Grille etat={etat} />
        <span className="mono small">Qui est-ce ? #{n} · {etat.gagne ? etat.essais.length : 'X'}/6 · {SITE}</span>
        <div className="grid2 w100">
          <button className="btn btn-light" onClick={partagerStory}><Icon d={I.share} size={18} /> Story</button>
          <button className="btn btn-outline-light" onClick={partagerTexte}>Défier un ami</button>
        </div>
        {copie && <span className="small">{copie}</span>}
      </section>
      <p className="muted small center">Prochain mystère demain · <a href="#trombino">Réviser le Trombino</a></p>
    </main>
  )
}
function Distribution({ n, etat }) {
  const st = useStats(n)
  const d = st?.distrib
  const total = d ? Object.values(d).reduce((a, b) => a + Number(b), 0) : 0
  if (!total) return null
  const mien = etat.gagne ? String(etat.essais.length) : 'X'
  const rows = ['1', '2', '3', '4', '5', '6', 'X'].map((k) => ({ k, v: Number(d[k] || 0) }))
  const max = Math.max(...rows.map((r) => r.v), 1)
  return (
    <section className="distrib" aria-label="Résultats des joueurs aujourd'hui">
      <div className="row-between"><b>Aujourd'hui, les {fmt(total)} joueurs</b><span className="muted tiny">en nombre d'indices</span></div>
      {rows.map((r) => (
        <div key={r.k} className={r.k === mien ? 'drow me' : 'drow'}>
          <span className="dk">{r.k === 'X' ? 'Raté' : r.k}</span>
          <div className="dbar"><div style={{ width: `${Math.max(4, (r.v / max) * 100)}%` }}><span>{Math.round((r.v / total) * 100)} %</span></div></div>
        </div>
      ))}
    </section>
  )
}
const Grille = ({ etat, big }) => (
  <div className="grille" role="img" aria-label={`${etat.essais.length} indices utilisés sur 6`}>
    {grille(etat).map((g, i) => <span key={i} className={`sq ${g}${big ? ' big' : ''}`}>{g === 'win' && <Icon d={I.check} size={18} strokeWidth="3" />}</span>)}
  </div>
)

async function story(n, etat) {
  const W = 1080, H = 1920, cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const x = cv.getContext('2d')
  x.fillStyle = '#15172B'; x.fillRect(0, 0, W, H)
  ;['#000091', '#FFFFFF', '#E1000F'].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * H / 3, 140, H / 3) })
  await document.fonts?.ready
  x.fillStyle = '#fff'
  x.font = '700 56px "Space Grotesk", sans-serif'; x.fillText('MOVO 2027', 220, 200); x.fillStyle = '#D9D9E3'; x.font = '400 40px Inter, sans-serif'; x.fillText('Mais où va-t-on ?', 220, 260); x.fillStyle = '#fff'
  x.fillStyle = '#D9D9E3'; x.font = '700 40px Inter, sans-serif'; x.fillText(`QUI EST-CE ? #${n}`, 220, 700)
  x.fillStyle = '#fff'; x.font = '700 170px "Space Grotesk", sans-serif'
  x.fillText(etat.gagne ? 'Trouvé' : 'Raté', 220, 900)
  x.fillText(etat.gagne ? `en ${etat.essais.length}/6` : 'en 6/6', 220, 1060)
  grille(etat).forEach((g, i) => {
    const X = 220 + i * 128, Y = 1130, S = 108
    x.beginPath(); x.roundRect(X, Y, S, S, 24)
    if (g === 'vide') { x.strokeStyle = '#4A4E60'; x.lineWidth = 6; x.stroke() } else { x.fillStyle = g === 'win' ? '#18A058' : '#E1000F'; x.fill() }
    if (g === 'win') { x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.moveTo(X + 28, Y + 56); x.lineTo(X + 48, Y + 78); x.lineTo(X + 82, Y + 34); x.stroke() }
  })
  x.font = '700 68px "Space Grotesk", sans-serif'
  ;['Et toi, tu le/la', 'reconnais en combien ?'].forEach((l, i) => x.fillText(l, 220, 1400 + i * 84))
  x.fillStyle = '#D9D9E3'; x.font = '400 40px Inter, sans-serif'; x.fillText('Joue au mystère du jour', 220, 1720)
  x.fillStyle = '#fff'; x.font = '700 46px "Space Grotesk", sans-serif'; x.fillText(SITE, 220, 1800)
  return new Promise((r) => cv.toBlob(r, 'image/png'))
}

/* ---------------- Trombino ---------------- */
function Trombino({ id }) {
  const [onglet, setOnglet] = useState('principaux')
  const [bloc, setBloc] = useState('tous')
  const ordre = useMemo(() => shuffle(CANDIDATS, Math.floor(Math.random() * 1e9)), [])
  const liste = ordre.filter((c) => (onglet === 'tous' || c.principal) && (bloc === 'tous' || blocId(c) === bloc))
  const start = id ? Math.max(0, liste.findIndex((c) => c.id === id)) : 0
  const [i, setI] = useState(start)
  useEffect(() => { setI(id ? Math.max(0, liste.findIndex((c) => c.id === id)) : 0) }, [onglet, bloc]) // eslint-disable-line
  const c = liste[Math.min(i, liste.length - 1)]
  if (id && !liste.some((x) => x.id === id) && onglet === 'principaux') setTimeout(() => setOnglet('tous'))
  return (
    <main className="screen">
      <Header title="Le Trombino" />
      <div className="seg">
        <button className={onglet === 'principaux' ? 'on' : ''} onClick={() => setOnglet('principaux')}>Principaux ({CANDIDATS.filter((x) => x.principal).length})</button>
        <button className={onglet === 'tous' ? 'on' : ''} onClick={() => setOnglet('tous')}>Tous les déclarés ({CANDIDATS.length})</button>
      </div>
      <div className="chips" role="group" aria-label="Filtrer par famille">
        <button className={bloc === 'tous' ? 'fchip on' : 'fchip'} onClick={() => setBloc('tous')}>Tous</button>
        {Object.entries(BLOCS).map(([k, b]) => (
          <button key={k} className={bloc === k ? 'fchip on' : 'fchip'} style={bloc === k ? { background: b.color, borderColor: b.color } : { color: b.color, borderColor: b.color }} onClick={() => setBloc(k)}>
            <i className="dot" style={{ background: bloc === k ? '#fff' : b.color }} />{b.label}
          </button>
        ))}
      </div>
      {c ? <Fiche c={c} /> : <p className="muted">Aucune fiche dans ce filtre.</p>}
      <div className="row-between">
        <button className="round" aria-label="Fiche précédente" onClick={() => setI((i - 1 + liste.length) % liste.length)}><Icon d={I.back} /></button>
        <span className="b">{liste.length ? (i % liste.length) + 1 : 0} / {liste.length}</span>
        <a className="btn btn-dark pillbtn" href="#jeu">Tester ma mémoire</a>
        <button className="round" aria-label="Fiche suivante" onClick={() => setI((i + 1) % liste.length)}><Icon d={I.next} /></button>
      </div>
      <p className="muted tiny">Ordre aléatoire à chaque visite. Couleur = famille politique selon la source, en attendant la nuance officielle du ministère de l'Intérieur.</p>
    </main>
  )
}

function Fiche({ c }) {
  const b = blocOf(c)
  return (
    <article className="fiche">
      <div className="fiche-top" style={{ background: b.color }}>
        <Portrait c={c} size={96} radius={20} />
        <span className="chip chip-white" style={{ color: b.color }}>{FAMILLES[c.famille].label.toUpperCase()}</span>
      </div>
      <div className="row-between top">
        <div className="stack4">
          <h2>{c.nom}</h2>
          <span className="muted small">{c.parti} · {c.fonction}</span>
        </div>
        <span className="chip">{c.principal ? 'PRINCIPAL' : 'DÉCLARÉ·E'}</span>
      </div>
      <dl className="facts">
        <dt>Candidature</dt><dd>{c.annonce ? `Annoncée le ${dateFr(c.annonce)}` : c.annonce_texte}</dd>
        <dt>Présidentielles</dt><dd>{c.candidatures.length ? `Candidat·e en ${c.candidatures.join(', ')}` : 'Première candidature'}</dd>
        <dt>Ligne</dt><dd>{c.ligne ?? <span className="muted">Pas de ligne publiée vérifiée à ce jour</span>}</dd>
        <dt>Programme</dt><dd>{c.programme ? 'Publié (en cours d\'analyse)' : <span className="muted">Pas de programme publié</span>}</dd>
      </dl>
      {c.portrait_ia && <span className="tiny muted">Portrait illustré (IA), non photographique.</span>}
      <span className="small muted">Sources : <SourceLinks ids={c.sources} /> · vérifié le {dateFr(META.verifie_le)}</span>
    </article>
  )
}

/* ---------------- L'hebdo ---------------- */
function SansEdition({ titre }) {
  return (
    <main className="screen">
      <Header title={titre} />
      <section className="empty">
        <Icon d={I.chart} size={40} />
        <h2>Première édition lundi</h2>
        <p className="muted">Chaque lundi, on relève les vidéos publiées la semaine précédente sur les comptes officiels des candidat·es (Instagram, TikTok, YouTube). On en tire leurs 5 phrases les plus vues, mot pour mot avec le lien, et la part de leur temps de parole par thème.</p>
        <p className="muted small">Tout est relu par un humain avant publication.</p>
        <a className="btn btn-dark" href="#methodo">Comment c'est fait</a>
      </section>
    </main>
  )
}

// Ordre des candidats tiré au hasard à chaque visite (comme le Trombino) : aucun ordre fixe ne favorise personne.
const ORDRE_VISITE = Math.floor(Math.random() * 1e9)
function useHebdoCandidat(h) {
  const ids = useMemo(() => shuffle(Object.keys(h?.candidats ?? {}), ORDRE_VISITE), [h])
  const [id, setId] = useState(ids[0])
  return [id, setId, ids]
}
// Candidats suivis par l'hebdo mais absents de cette édition
function Absents({ h }) {
  const suivis = Object.keys(COMPTES.comptes)
  const absents = suivis.filter((k) => !h.candidats[k]).map((k) => {
    const c = CANDIDATS.find((x) => x.id === k)
    const cs = COMPTES.comptes[k]
    const raison = cs.some((a) => a.valide && a.oriane_id) ? 'aucune vidéo politique cette semaine' : cs.some((a) => a.valide) ? 'compte de campagne pas encore indexé' : 'pas encore de compte officiel validé'
    return c ? `${c.nom} (${raison})` : null
  }).filter(Boolean)
  if (!absents.length) return null
  return <p className="muted tiny">Absents de cette édition : {absents.join(', ')}.</p>
}

function Hebdo() {
  const h = editions()[0]
  const [id, setId, ids] = useHebdoCandidat(h)
  if (!h || !ids.length) return <SansEdition titre="L'hebdo" />
  const c = CANDIDATS.find((x) => x.id === id)
  const d = h.candidats[id]
  return (
    <main className="screen">
      <Header title="L'hebdo" right={<a className="icon-btn" href="#themes" aria-label="Thèmes de la semaine"><Icon d={I.chart} /></a>} />
      <span className="muted small center">Semaine du {dateFr(h.du)} au {dateFr(h.au)}</span>
      <div className="chips scroll">
        {ids.map((k) => {
          const x = CANDIDATS.find((y) => y.id === k)
          const on = k === id
          return <button key={k} className={on ? 'fchip on' : 'fchip'} style={on ? { background: blocOf(x).color, borderColor: blocOf(x).color } : {}} onClick={() => setId(k)}>{x.nom}</button>
        })}
      </div>
      <div className="row12">
        <Portrait c={c} size={48} radius={12} />
        <div className="stack4"><b>Ses 5 phrases de la semaine</b><span className="muted small">Tirées de ses vidéos officielles · {d.nb_videos} vidéos</span></div>
      </div>
      <div className="stack8">
        {d.citations.map((q, i) => (
          <article key={i} className="quote">
            <a className="thumb" href={q.url} target="_blank" rel="noreferrer" aria-label="Voir la vidéo" style={q.vignette ? { backgroundImage: `url(${q.vignette})` } : {}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4" /></svg>
            </a>
            <div className="col">
              <b className="qtext">« {q.texte} »</b>
              <div className="row-between"><span className="muted tiny">{q.plateforme} · {dateFr(q.date)}</span><a className="tiny b" href={q.url} target="_blank" rel="noreferrer">Voir la vidéo</a></div>
            </div>
          </article>
        ))}
      </div>
      <Absents h={h} />
      <p className="muted tiny center">Mot pour mot, vérifié dans son contexte · <a href="https://github.com/LucasNanini/boussole-2027/issues" target="_blank" rel="noreferrer">Signaler une erreur</a></p>
    </main>
  )
}

/* ---------------- De quoi parlent-ils ? ---------------- */
function Themes() {
  const [h, prev] = editions()
  const [id, setId, ids] = useHebdoCandidat(h)
  const [vue, setVue] = useState('campagne')
  const [tout, setTout] = useState(false)
  if (!h || !ids.length) return <SansEdition titre="De quoi parlent-ils ?" />
  const part = (src, cid) => {
    if (!src) return {}
    if (cid) return src.candidats[cid]?.themes ?? {}
    const acc = {}; let n = 0
    Object.values(src.candidats).forEach((x) => { n++; Object.entries(x.themes).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v }) })
    Object.keys(acc).forEach((k) => { acc[k] /= n })
    return acc
  }
  const cid = vue === 'campagne' ? null : id
  const now = part(h, cid), before = part(prev, cid)
  const color = cid ? blocOf(CANDIDATS.find((x) => x.id === cid)).color : '#15172B'
  const rows = THEMES.themes.map((t) => ({ ...t, v: now[t.id] || 0, p: before[t.id] })).sort((a, b) => b.v - a.v)
  const max = Math.max(...rows.map((r) => Math.max(r.v, r.p || 0)), 1)
  const top = rows.filter((r) => r.p != null).sort((a, b) => (b.v - b.p) - (a.v - a.p))[0]
  return (
    <main className="screen">
      <Header back="hebdo" title="" right={<span className="muted small">Semaine du {dateFr(h.du)}</span>} />
      <div className="stack4">
        <h1 className="h1">De quoi parlent-ils&nbsp;?</h1>
        <p className="muted small">Part du temps de parole par thème dans les vidéos officielles. Pas un sondage : ça mesure ce qu'ils disent, pas ce que vous pensez.</p>
      </div>
      <div className="seg">
        <button className={vue === 'campagne' ? 'on' : ''} onClick={() => setVue('campagne')}>Toute la campagne</button>
        <button className={vue === 'candidat' ? 'on' : ''} onClick={() => setVue('candidat')}>Par candidat·e</button>
      </div>
      {vue === 'candidat' && (
        <div className="chips scroll">
          {ids.map((k) => { const x = CANDIDATS.find((y) => y.id === k); return <button key={k} className={k === id ? 'fchip on' : 'fchip'} style={k === id ? { background: blocOf(x).color, borderColor: blocOf(x).color } : {}} onClick={() => setId(k)}>{x.nom}</button> })}
        </div>
      )}
      {cid && (() => { const n = h.candidats[cid].nb_videos; const x = CANDIDATS.find((y) => y.id === cid); return (
        <p className={n < 3 ? 'warn-soft' : 'muted small'}><b>{x.nom}</b> · {n} vidéo{n > 1 ? 's' : ''} cette semaine{n < 3 ? ' : trop peu pour en tirer une tendance, à lire avec prudence.' : ''}</p>
      ) })()}
      <div className="legend"><span><i style={{ background: color }} />Cette semaine</span>{prev && <span><i style={{ background: '#C9CAD6' }} />Semaine d'avant</span>}</div>
      <section className="chart">
        {(tout ? rows : rows.slice(0, 6)).map((r) => {
          const d = r.p != null ? Math.round(r.v - r.p) : null
          return (
            <div key={r.id} className="stack4">
              <div className="row-between small"><b>{r.court}</b><span className="b">{Math.round(r.v)} %{d != null && <span className="muted"> {d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '='}</span>}</span></div>
              <div className="track"><div style={{ width: `${(r.v / max) * 100}%`, background: color }} /></div>
              {r.p != null && <div className="track thin"><div style={{ width: `${(r.p / max) * 100}%` }} /></div>}
            </div>
          )
        })}
        <button className="linkbtn" onClick={() => setTout(!tout)}>{tout ? 'Voir le top 6' : 'Voir les 12 thèmes'}</button>
      </section>
      {top && top.v - top.p > 0 && (
        <div className="callout"><span className="eyebrow light">Le chiffre de la semaine</span><b>{top.court} : +{Math.round(top.v - top.p)} points en une semaine.</b></div>
      )}
      <Absents h={h} />
      <p className="muted tiny">Ordre des candidats tiré au hasard. Source : vidéos des comptes officiels Instagram, TikTok et YouTube (via Oriane). Thèmes classés automatiquement puis vérifiés. <a href="#methodo">Méthodologie</a></p>
    </main>
  )
}

/* ---------------- Bientôt ---------------- */
function Bientot({ titre, quand, texte }) {
  const [ok, setOk] = useState(false)
  return (
    <main className="screen dark">
      <Header title="" right={<span className="pill-white">BIENTÔT · {quand}</span>} />
      <h1 className="h1 big">{titre}</h1>
      <p className="light-muted">{texte}</p>
      <form className="stack8" onSubmit={(e) => { e.preventDefault(); store.set('alerte-' + titre, e.target.email.value); setOk(true) }}>
        <label htmlFor="email" className="b small">Être prévenu·e à l'ouverture</label>
        <div className="row6">
          <input id="email" name="email" type="email" required placeholder="votre@email.fr" className="input-dark" />
          <button className="btn btn-light" type="submit">Me prévenir</button>
        </div>
        {ok && <span className="small">Noté ! (Brouillon : l'inscription sera branchée à l'outil d'emailing.)</span>}
      </form>
    </main>
  )
}

/* ---------------- Méthodologie ---------------- */
function Methodo() {
  return (
    <main className="screen">
      <Header title="Méthodologie" />
      <article className="prose">
        <h2>Qui est dans l'app ?</h2>
        <p>{META.regle_liste}</p>
        <h2>Les couleurs</h2>
        <p>{META.regle_couleur} La couleur est toujours accompagnée du nom de la famille écrit en toutes lettres.</p>
        <h2>« Principaux »</h2>
        <p>Candidats testés dans les intentions de vote nationales récentes. Les autres sont tous dans l'onglet « Tous les déclarés ».</p>
        <h2>Le mystère du jour</h2>
        <p>Un tirage fixé à l'avance, le même pour tout le monde. Seules les candidatures avec une ligne politique sourcée y entrent. Les modes fondés sur les programmes (À l'aveugle, Mon cap) n'incluront que les candidats ayant publié un programme.</p>
        <h2>L'hebdo et les thèmes</h2>
        <p>Chaque lundi, nous relevons les vidéos publiées sur les comptes officiels des candidats. Les citations sont reproduites mot pour mot, avec un lien vers la vidéo. Chaque passage reçoit un des 12 thèmes ci-dessous ; un humain relit avant publication. On ne publie aucun classement de popularité ni de vues : ce n'est pas un sondage.</p>
        <ul>{THEMES.themes.map((t) => <li key={t.id}><b>{t.label}</b> — ex. {t.exemples.join(', ')}</li>)}</ul>
        <h2>Sources</h2>
        <ul>{Object.values(SOURCES).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.titre}</a> ({s.date})</li>)}</ul>
        <h2>Compteurs et classement</h2>
        <p>Chaque navigateur reçoit un identifiant anonyme et aléatoire. Il sert à compter les parties et les joueurs, et à tenir votre série. Le pseudo est facultatif. Pas d'email, pas de compte, pas de cookie publicitaire. Les compteurs portent sur les joueurs, jamais sur les candidats : ce n'est pas un sondage.</p>
      </article>
    </main>
  )
}

/* ---------------- Classement + code de sauvegarde ---------------- */
function Classement() {
  const st = useStats()
  const [moi, setMoi] = useState(() => store.get('qec-stats', {}))
  const [pseudo, setPseudo] = useState(moi.pseudo || '')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { api('/api/compte', { action: 'moi', joueur: joueurId() }).then((j) => { if (j?.user) { syncStats(j.user); setMoi(store.get('qec-stats', {})); if (j.user.pseudo) setPseudo(j.user.pseudo) } }) }, [])
  const enregistrerPseudo = async (e) => {
    e.preventDefault()
    const j = await api('/api/compte', { action: 'pseudo', joueur: joueurId(), pseudo })
    if (j?.ok) { syncStats({ ...moi, pseudo: j.pseudo }); setMoi(store.get('qec-stats', {})); setMsg('Pseudo enregistré. Il apparaît au classement dès que votre série est en cours.') }
    else setMsg(j?.erreur === 'pseudo' ? 'Pseudo refusé : 2 à 15 caractères, lettres, chiffres, espaces, et rien d\'injurieux.' : 'Connexion impossible, réessayez.')
  }
  const monCode = async () => {
    const j = await api('/api/compte', { action: 'code', joueur: joueurId() })
    if (j?.code) { syncStats({ ...moi, code: j.code }); setMoi(store.get('qec-stats', {})) } else setMsg('Connexion impossible, réessayez.')
  }
  const recup = async (e) => {
    e.preventDefault()
    const j = await api('/api/compte', { action: 'recuperer', code })
    if (j?.joueur) { store.set('b27-joueur', j.joueur); syncStats(j.user); setMoi(store.get('qec-stats', {})); setPseudo(j.user.pseudo || ''); setMsg(`Série récupérée : ${j.user.serie} jour${j.user.serie > 1 ? 's' : ''}.`) }
    else setMsg('Code inconnu. Vérifiez les 6 caractères.')
  }
  return (
    <main className="screen">
      <Header title="Classement" />
      <section className="chart">
        <div className="row-between"><b>Les plus longues séries en cours</b><span className="muted tiny">jours d'affilée</span></div>
        {!st && <span className="muted small">Classement indisponible pour le moment.</span>}
        {st && !st.classement.length && <span className="muted small">Personne encore. Jouez le mystère du jour et choisissez un pseudo pour ouvrir le bal.</span>}
        {st?.classement.map((u, i) => (
          <div key={i} className={u.pseudo === moi.pseudo ? 'lbrow me' : 'lbrow'}><span className="rank">{i + 1}</span><span className="col b">{u.pseudo}</span><span className="b">{u.serie}</span></div>
        ))}
      </section>

      <form className="card-form" onSubmit={enregistrerPseudo}>
        <label htmlFor="pseudo" className="b">Votre pseudo (facultatif)</label>
        <span className="muted tiny">Pas d'email, pas de compte. Votre série actuelle : {moi.serie || 0}.</span>
        <div className="row6"><input id="pseudo" maxLength={15} value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="ex. Marianne75" /><button className="btn btn-dark" type="submit">OK</button></div>
      </form>

      <section className="card-form">
        <b>Garder ma série sur un autre appareil</b>
        <span className="muted tiny">Ouvert depuis Instagram ou TikTok, ou changement de téléphone ? Notez ce code et entrez-le sur l'autre appareil.</span>
        {moi.code ? <span className="code">{moi.code}</span> : <button className="btn btn-dark" onClick={monCode}>Afficher mon code</button>}
        <form className="row6" onSubmit={recup}>
          <label className="sr" htmlFor="code">Code de sauvegarde</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={7} placeholder="J'ai déjà un code" autoComplete="off" />
          <button className="btn btn-outline" type="submit">Récupérer</button>
        </form>
      </section>
      {msg && <p className="msg" role="status">{msg}</p>}
      <p className="muted tiny">Le jeu se joue dans votre navigateur : un joueur déterminé pourrait tricher. Le classement est là pour le plaisir.</p>
    </main>
  )
}

/* ---------------- Revue (interne, non liée) ---------------- */
function Revue() {
  const c = CANDIDATS.filter((x) => x.conflit)
  return (
    <main className="screen">
      <Header title="À vérifier avant lancement" />
      <p className="muted small">{META.statut_donnees}. {c.length} fiches avec des sources divergentes.</p>
      {c.map((x) => <div key={x.id} className="clue"><span className="col"><b>{x.nom}</b><span className="small">{x.conflit}</span>{x.fiche && <a className="tiny" href={x.fiche} target="_blank" rel="noreferrer">Fiche source</a>}</span></div>)}
      <h2>Hors liste</h2>
      {DATA_EXTRA.map((t, i) => <p key={i} className="small">{t}</p>)}
      <h2>Règle « principaux »</h2><p className="small">{META.regle_principaux}</p>
    </main>
  )
}

/* ---------------- App ---------------- */
export default function App() {
  const r = useRoute()
  useEffect(() => {
    const d = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    if (store.get('b27-visite', '') !== d) { store.set('b27-visite', d); api('/api/compte', { action: 'visite', joueur: joueurId() }) }
  }, [])
  const page = r.startsWith('fiche-') ? 'trombino' : r.startsWith('apercu-') ? r.slice(7) : r
  const arg = r.startsWith('fiche-') ? r.slice(6) : undefined
  return (
    <div className="app">
      <Tricolore />
      {page === 'jeu' ? <Jeu />
        : page === 'trombino' ? <Trombino id={arg} key={arg || 't'} />
        : page === 'hebdo' ? <Hebdo />
        : page === 'themes' ? <Themes />
        : page === 'aveugle' ? <Bientot titre="À l'aveugle" quand="JANVIER" texte="Réagissez à de vraies propositions, sans nom, sans parti, sans couleur. À la fin, on révèle qui les porte. Réservé aux candidat·es ayant publié un programme." />
        : page === 'cap' ? <Bientot titre="Mon cap" quand="MARS 2027" texte="Le comparateur complet, sur la liste officielle publiée par le Conseil constitutionnel. Vous verrez vos accords… et vos désaccords." />
        : page === 'methodo' ? <Methodo />
        : page === 'revue' ? <Revue />
        : page === 'classement' ? <Classement />
        : <Accueil />}
    </div>
  )
}
