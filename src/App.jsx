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
// Compte Instagram de MOVO, sans le @. Laisser vide tant que le compte n'existe pas : rien ne s'affiche.
export const INSTAGRAM = ''
const IG_URL = INSTAGRAM ? `https://instagram.com/${INSTAGRAM}` : ''
// Adresse affichée dans tous les partages, quelle que soit l'adresse sur laquelle on joue
const SITE = 'movo-2027.vercel.app'

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
  const st = useStats(numeroDuJour())
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

      <section className="hero hero-compact">
        <div className="qe-cards" aria-hidden="true"><span className="qe-card red">?</span><span className="qe-card blue">?</span></div>
        <div className="hero-body">
          <span className="eyebrow light">Le mystère du jour · #{n}</span>
          <h1>KYESSE ?</h1><span className="pill-ghost">Série {stats.serie}</span>
        </div>
        <button className="btn btn-light" onClick={() => go('jeu')}>
          {etat?.fini ? 'Voir mon résultat' : etat?.essais?.length ? 'Reprendre' : 'Jouer'}
        </button>
      </section>

      <KikadiCarte n={n} />
      <a className="kk-card dacc-card" href="#swipe">
        <span className="dacc-mark" aria-hidden="true"><i>✕</i><i>✓</i></span>
        <div className="kk-card-top"><span className="kk-new white">NOUVEAU</span><span className="eyebrow light">Swipe</span></div>
        <b className="kk-title">DAKOUPA ?</b>
        <span className="kk-sub">20 vraies phrases. D'accord ou pas ? On révèle qui à la fin.</span>
        <span className="btn kk-btn">Swiper</span>
      </a>

      <a className="lb-link" href="#classement">
        <span className="col"><b>Les classements</b><span className="muted small">{st?.classementJour?.[0]?.essais ? `Aujourd'hui en tête : ${st.classementJour[0].pseudo}, en ${st.classementJour[0].essais} indice${st.classementJour[0].essais > 1 ? 's' : ''}` : "Aujourd'hui · Moyenne · Séries"}</span></span>
        <Icon d={I.next} />
      </a>

      <h2>Explorer</h2>
      <div className="explore">
        <a href="#trombino"><b>Le Trombino</b><span className="muted small">Les {CANDIDATS.length} candidatures, carte par carte</span><Icon d={I.next} /></a>
        <a href="#hebdo"><b>L'hebdo</b><span className="muted small">Leurs 5 phrases de la semaine</span><Icon d={I.next} /></a>
        <a href="#themes"><b>De quoi parlent-ils ?</b><span className="muted small">Leurs mots, semaine après semaine</span><Icon d={I.next} /></a>
      </div>
      <p className="muted small">Bientôt : <a href="#aveugle">À l'aveugle</a> (janvier) · <a href="#cap">Mon cap</a> (mars 2027)</p>

      <footer className="foot"><span>Neutre · sourcé · sans compte</span>{INSTAGRAM && <a href={IG_URL} target="_blank" rel="noreferrer">@{INSTAGRAM}</a>}<a href="#methodo">Méthodologie</a></footer>
    </main>
  )
}
function KikadiCarte({ n }) {
  const e = store.get(`kk-${n}`, null)
  const fait = e?.vu
  const jeu = useMemo(() => (fait ? kikadiDuJour(n) : null), [n, fait])
  const sc = fait && jeu ? jeu.filter((q, k) => e.rep[k] === q.id).length : null
  return (
    <a className="kk-card" href="#kikadi">
      <span className="kk-mark" aria-hidden="true">«</span>
      <div className="kk-card-top"><span className="kk-new">NOUVEAU</span><span className="eyebrow light">#{n} · 5 citations</span></div>
      <b className="kk-title">KIKADI ?</b>
      <span className="kk-sub">{fait ? `${sc}/5 aujourd'hui. 5 nouvelles demain.` : e?.rep?.length ? 'Il vous reste des citations.' : 'Vraies phrases. Qui les a dites ?'}</span>
      <span className="btn kk-btn">{fait ? 'Voir mon récap' : e?.rep?.length ? 'Reprendre' : 'Jouer'}</span>
    </a>
  )
}

/* ---------------- KYESSE ? ---------------- */
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
  const defi = useMemo(() => defiRecu(n), [n])
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
      <Header title={`KYESSE ? #${n}`} right={<span className="pts">{points} pts</span>} />
      {defi && <div className="defi">On vous a défié : {defi === 'X' ? 'votre ami·e n\'a pas trouvé' : `votre ami·e a trouvé en ${defi} indice${defi > 1 ? 's' : ''}`}. À vous de faire mieux !</div>}
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
  const ig = INSTAGRAM ? `\nSuis @${INSTAGRAM} sur Instagram : instagram.com/${INSTAGRAM}` : ''
  const score = etat.gagne ? etat.essais.length : 'X'
  return `MOVO 2027 · KYESSE ? #${n}\n${sq} ${score}/6\nJe te défie : tu le/la reconnais en moins d'indices ?\nhttps://${SITE}/?defi=${score}&n=${n}#jeu${ig}`
}
// Défi reçu : ?defi=3&n=12 dans l'adresse (lu une fois, puis gardé pour la partie du jour)
function defiRecu(n) {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('defi') && Number(q.get('n')) === n) store.set('defi-' + n, q.get('defi'))
  } catch { /* rien */ }
  return store.get('defi-' + n, null)
}

function Resultat({ n, rep, etat, clues }) {
  const [copie, setCopie] = useState('')
  const [stats, setStats] = useState(() => store.get('qec-stats', { serie: 0, meilleur: null }))
  useEffect(() => {
    const maj = () => setStats(store.get('qec-stats', { serie: 0, meilleur: null }))
    finirPartie(n, etat, maj); maj()
  }, [n])
  const pts = etat.gagne ? 100 - 15 * (etat.essais.length - 1) : 0
  const [defiTexte, setDefiTexte] = useState(null)
  const partagerTexte = async () => {
    const t = texteGrille(n, etat)
    if (navigator.share) {
      try { await navigator.share({ text: t }); return }
      catch (e) { if (e?.name === 'AbortError') return } // annulé par le joueur
    }
    try { await navigator.clipboard.writeText(t); setCopie('Défi copié ! Collez-le dans une conversation.') } catch { /* presse-papiers bloqué */ }
    setDefiTexte(t) // dans tous les cas : fenêtre avec WhatsApp, SMS et le texte à copier
  }
  // L'image est préparée dès l'affichage du résultat : au clic, le partage part tout de suite
  // (les navigateurs mobiles refusent un partage lancé trop longtemps après le toucher).
  const [img, setImg] = useState(null)
  const [apercu, setApercu] = useState(false)
  useEffect(() => {
    let url
    story(n, etat).then((blob) => { if (blob) { url = URL.createObjectURL(blob); setImg({ blob, url }) } }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [n, etat])
  const partagerStory = async () => {
    if (!img) return
    const file = new File([img.blob], `movo-kyesse-${n}.png`, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return }
    } catch (e) { if (e?.name === 'AbortError') return } // annulé par le joueur
    setApercu(true) // pas de partage de fichier possible (navigateur intégré, ordinateur…) : on montre l'image
  }
  return (
    <main className="screen">
      <Header title="" right={<span className="muted small b">Série : {stats.serie} · Meilleur : {stats.meilleur ?? '–'}/6</span>} />
      <div className="center stack4">
        <span className="eyebrow">KYESSE ? #{n}</span>
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

      {defiTexte && (
        <div className="modal" role="dialog" aria-label="Défier un ami" onClick={() => setDefiTexte(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <b>Défier un ami</b>
            <a className="btn btn-dark" href={`https://wa.me/?text=${encodeURIComponent(defiTexte)}`} target="_blank" rel="noreferrer">Envoyer par WhatsApp</a>
            <a className="btn btn-outline" href={`sms:?&body=${encodeURIComponent(defiTexte)}`}>Envoyer par SMS</a>
            <label className="small muted" htmlFor="defi-txt">Ou copiez le texte :</label>
            <textarea id="defi-txt" readOnly value={defiTexte} rows={6} className="defi-txt" onFocus={(e) => e.target.select()} />
            <button className="btn btn-outline" onClick={() => setDefiTexte(null)}>Fermer</button>
          </div>
        </div>
      )}
      {apercu && img && (
        <div className="modal" role="dialog" aria-label="Image à partager en story" onClick={() => setApercu(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <img src={img.url} alt="Votre résultat MOVO, format story" className="story-img" />
            <p className="small">Appui long sur l'image, puis « Enregistrer l'image ». Ajoutez-la ensuite à votre story Instagram.</p>
            <div className="grid2 w100">
              <a className="btn btn-dark" href={img.url} download={`movo-kyesse-${n}.png`}>Télécharger</a>
              <button className="btn btn-outline" onClick={() => setApercu(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      <section className="share">
        <span className="eyebrow light">Votre grille, sans spoiler</span>
        <Grille etat={etat} />
        <span className="mono small">KYESSE ? #{n} · {etat.gagne ? etat.essais.length : 'X'}/6 · {SITE}</span>
        <div className="grid2 w100">
          <button className="btn btn-light" onClick={partagerStory}><Icon d={I.share} size={18} /> Story</button>
          <button className="btn btn-outline-light" onClick={partagerTexte}>Défier un ami</button>
        </div>
        {copie && <span className="small">{copie}</span>}
      </section>
      {INSTAGRAM && <a className="ig-btn" href={IG_URL} target="_blank" rel="noreferrer">Suivre @{INSTAGRAM} sur Instagram</a>}
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
  x.fillStyle = '#D9D9E3'; x.font = '700 40px Inter, sans-serif'; x.fillText(`KYESSE ? #${n}`, 220, 700)
  x.fillStyle = '#fff'; x.font = '700 170px "Space Grotesk", sans-serif'
  x.fillText(etat.gagne ? 'Trouvé' : 'Raté', 220, 900)
  x.fillText(etat.gagne ? `en ${etat.essais.length}/6` : 'en 6/6', 220, 1060)
  grille(etat).forEach((g, i) => {
    const X = 220 + i * 128, Y = 1130, S = 108
    x.beginPath(); if (x.roundRect) x.roundRect(X, Y, S, S, 24); else x.rect(X, Y, S, S)
    if (g === 'vide') { x.strokeStyle = '#4A4E60'; x.lineWidth = 6; x.stroke() } else { x.fillStyle = g === 'win' ? '#18A058' : '#E1000F'; x.fill() }
    if (g === 'win') { x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.moveTo(X + 28, Y + 56); x.lineTo(X + 48, Y + 78); x.lineTo(X + 82, Y + 34); x.stroke() }
  })
  x.font = '700 68px "Space Grotesk", sans-serif'
  ;['Et toi, tu le/la', 'reconnais en combien ?'].forEach((l, i) => x.fillText(l, 220, 1400 + i * 84))
  x.fillStyle = '#D9D9E3'; x.font = '400 40px Inter, sans-serif'; x.fillText('Joue au mystère du jour', 220, 1720)
  x.fillStyle = '#fff'; x.font = '700 46px "Space Grotesk", sans-serif'; x.fillText(SITE, 220, 1800)
  if (INSTAGRAM) { x.fillStyle = '#D9D9E3'; x.font = '600 40px Inter, sans-serif'; x.fillText(`@${INSTAGRAM}`, 220, 1860) }
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
  const nom = (k) => CANDIDATS.find((x) => x.id === k)?.nom
  const ids = Object.keys(COMPTES.comptes).filter((k) => !h.candidats[k] && nom(k))
  const grp = (f) => ids.filter((k) => f(COMPTES.comptes[k])).map(nom)
  const suiviCetteSemaine = (k) => !h.suivis || h.suivis.includes(k)
  const pasEncore = ids.filter((k) => !suiviCetteSemaine(k) && COMPTES.comptes[k].some((a) => a.valide && a.oriane_id)).map(nom)
  const sansVideo = ids.filter((k) => suiviCetteSemaine(k) && COMPTES.comptes[k].some((a) => a.valide && a.oriane_id)).map(nom)
  const nonIndexe = grp((cs) => !cs.some((a) => a.valide && a.oriane_id) && cs.some((a) => a.valide))
  const sansCompte = grp((cs) => !cs.some((a) => a.valide))
  if (!ids.length) return null
  return (
    <details className="absents">
      <summary>Pas dans cette édition : {ids.length} candidat·es</summary>
      {sansVideo.length > 0 && <p><b>Aucune vidéo politique cette semaine :</b> {sansVideo.join(', ')}.</p>}
      {pasEncore.length > 0 && <p><b>Suivi·es à partir de la prochaine édition :</b> {pasEncore.join(', ')}.</p>}
      {nonIndexe.length > 0 && <p><b>Compte de campagne pas encore indexé :</b> {nonIndexe.join(', ')}.</p>}
      {sansCompte.length > 0 && <p><b>Pas de compte officiel trouvé pour l'instant :</b> {sansCompte.join(', ')}. Vous connaissez le leur ? <a href="https://github.com/LucasNanini/boussole-2027/issues" target="_blank" rel="noreferrer">Signalez-le</a>.</p>}
    </details>
  )
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

/* ---------------- KIKADI ? (qui l'a dit) ---------------- */
const KK_NB = 5
const sansAcc = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Citations jouables le jour n : éditions publiées dont la semaine est finie depuis au moins un jour
// (une édition publiée le lundi entre dans le Kikadi du mardi : le jeu du jour ne change jamais en cours de journée).
function poolKikadi(n) {
  const veille = new Date(Date.UTC(2026, 10, 14) + (n - 2) * 864e5).toISOString().slice(0, 10)
  const pool = []
  for (const h of EDITIONS) {
    if (h.statut !== 'publie' || !(h.au < veille)) continue
    for (const [id, c] of Object.entries(h.candidats)) {
      const cand = CANDIDATS.find((x) => x.id === id)
      if (!cand) continue
      const noms = cand.nom.split(' ').filter((m) => m.length > 2).map(sansAcc)
      for (const q of c.citations || []) {
        const mots = q.texte.split(/\s+/).length
        const t = sansAcc(q.texte)
        if (mots < 6 || mots > 45 || noms.some((m) => t.includes(m))) continue // trop court, trop long, ou se nomme lui-même
        pool.push({ ...q, id, key: `${id}|${q.url}|${q.texte.slice(0, 30)}` })
      }
    }
  }
  return pool
}
function kikadiDuJour(n) {
  const pool = poolKikadi(n)
  const ids = [...new Set(pool.map((q) => q.id))]
  if (pool.length < KK_NB || ids.length < 4) return null
  // pas de citation déjà tombée dans les 6 jours précédents (tant que le stock le permet)
  const recent = new Set()
  let pick = []
  for (let d = Math.max(1, n - 6); d <= n; d++) {
    const ordre = shuffle(pool, d * 7919 + 13)
    const dispo = ordre.filter((q) => !recent.has(q.key))
    const src = dispo.length >= KK_NB ? dispo : ordre
    pick = []; const vus = new Set()
    for (const q of src) { if (pick.length < KK_NB && !vus.has(q.id)) { vus.add(q.id); pick.push(q) } }
    for (const q of src) { if (pick.length < KK_NB && !pick.includes(q)) pick.push(q) }
    pick.forEach((q) => recent.add(q.key))
  }
  return pick.map((q, i) => ({ ...q, options: shuffle([q.id, ...shuffle(ids.filter((x) => x !== q.id), n * 31 + i).slice(0, 3)], n * 17 + i) }))
}
function defiKikadi(n) {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('defik') && Number(q.get('n')) === n) store.set('defik-' + n, q.get('defik'))
  } catch { /* rien */ }
  return store.get('defik-' + n, null)
}
const nomDe = (id) => CANDIDATS.find((x) => x.id === id)

function Kikadi() {
  const n = numeroDuJour()
  const jeu = useMemo(() => kikadiDuJour(n), [n])
  const key = `kk-${n}`
  const [etat, setEtat] = useState(() => store.get(key, { rep: [] }))
  const defi = useMemo(() => defiKikadi(n), [n])
  if (!jeu) return <main className="screen"><Header title="KIKADI ?" /><p className="muted">Pas encore assez de citations publiées. Revenez après la prochaine édition de L'hebdo.</p></main>
  const i = etat.rep.length
  const fini = i >= KK_NB
  if (fini && etat.vu) return <KikadiResultat n={n} jeu={jeu} etat={etat} />
  const q = jeu[Math.min(i, KK_NB - 1)]
  const dernier = i > 0 ? { q: jeu[i - 1], r: etat.rep[i - 1] } : null
  const montrer = etat.attente // réponse donnée, on montre la correction avant de passer
  const repondre = (id) => {
    if (montrer || fini) return
    const next = { ...etat, rep: [...etat.rep, id], attente: true }
    setEtat(next); store.set(key, next)
  }
  const suivante = () => {
    const next = { ...etat, attente: false, vu: etat.rep.length >= KK_NB }
    setEtat(next); store.set(key, next); window.scrollTo(0, 0)
  }
  const cur = montrer ? dernier.q : q
  const choisi = montrer ? dernier.r : null
  const bon = choisi === cur.id
  return (
    <main className="screen">
      <Header title="" right={<span className="muted small b">KIKADI ? #{n}</span>} />
      {defi != null && i === 0 && <div className="defi">On vous a défié : votre ami·e a fait {defi}/5. À vous de faire mieux !</div>}
      <div className="kk-progress">{jeu.map((_, k) => <span key={k} className={k < etat.rep.length ? (etat.rep[k] === jeu[k].id ? 'ok' : 'ko') : k === i ? 'cur' : ''} />)}</div>
      <span className="eyebrow">Citation {Math.min(etat.rep.length + (montrer ? 0 : 1), KK_NB)} sur {KK_NB} · Qui l'a dit ?</span>
      <blockquote className="kk-quote">« {cur.texte} »</blockquote>
      <span className="muted tiny">Mot pour mot, vidéo du {dateFr(cur.date)}</span>
      <div className="kk-options">
        {cur.options.map((id) => {
          const c = nomDe(id)
          const cls = !montrer ? '' : id === cur.id ? ' good' : id === choisi ? ' bad' : ' dim'
          return (
            <button key={id} className={'kk-opt' + cls} onClick={() => repondre(id)} disabled={montrer}>
              <TileFace c={c} /><span className="b small">{c.nom}</span>
            </button>
          )
        })}
      </div>
      {montrer && (
        <div className={'kk-verdict ' + (bon ? 'ok' : 'ko')}>
          <b>{bon ? 'Bien vu !' : `Non : c'était ${nomDe(cur.id).nom}.`}</b>
          <span className="small">{nomDe(cur.id).parti} · <a href={cur.url} target="_blank" rel="noreferrer">Voir la vidéo</a></span>
          <button className="btn btn-dark" onClick={suivante}>{etat.rep.length >= KK_NB ? 'Voir mon score' : 'Citation suivante'}</button>
        </div>
      )}
    </main>
  )
}
function texteKikadi(n, jeu, etat) {
  const sc = jeu.filter((q, k) => etat.rep[k] === q.id).length
  const sq = jeu.map((q, k) => (etat.rep[k] === q.id ? '🟩' : '🟥')).join('')
  const ig = INSTAGRAM ? `\nSuis @${INSTAGRAM} sur Instagram : instagram.com/${INSTAGRAM}` : ''
  return `MOVO 2027 · KIKADI ? #${n}\n${sq} ${sc}/5\n5 vraies phrases de candidats : tu sais qui les a dites ?\nhttps://${SITE}/?defik=${sc}&n=${n}#kikadi${ig}`
}
function KikadiResultat({ n, jeu, etat }) {
  const sc = jeu.filter((q, k) => etat.rep[k] === q.id).length
  const [distrib, setDistrib] = useState(null)
  const [defiTexte, setDefiTexte] = useState(null)
  const [copie, setCopie] = useState('')
  useEffect(() => { api('/api/partie', { jeu: 'kikadi', joueur: joueurId(), numero: n, score: sc }).then((j) => { if (j?.distrib) setDistrib(j.distrib) }) }, [n])
  const partager = async () => {
    const t = texteKikadi(n, jeu, etat)
    if (navigator.share) {
      try { await navigator.share({ text: t }); return }
      catch (e) { if (e?.name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(t); setCopie('Défi copié ! Collez-le dans une conversation.') } catch { /* bloqué */ }
    setDefiTexte(t)
  }
  const total = distrib ? Object.values(distrib).reduce((a, b) => a + Number(b), 0) : 0
  const mots = ['Aïe.', 'Il y a du boulot.', 'Pas mal.', 'Bien joué.', 'Très fort.', 'Sans faute !']
  return (
    <main className="screen">
      <Header title="" right={<span className="muted small b">KIKADI ? #{n}</span>} />
      <div className="center stack4">
        <span className="eyebrow">KIKADI ? #{n}</span>
        <h1 className="h1">{sc}/5 · {mots[sc]}</h1>
      </div>
      <section className="share">
        <span className="eyebrow light">Votre grille, sans spoiler</span>
        <div className="kk-grid">{jeu.map((q, k) => <span key={k}>{etat.rep[k] === q.id ? '🟩' : '🟥'}</span>)}</div>
        <span className="mono small">KIKADI ? #{n} · {sc}/5 · {SITE}</span>
        <button className="btn btn-light w100" onClick={partager}><Icon d={I.share} size={18} /> Défier un ami</button>
        {copie && <span className="small">{copie}</span>}
      </section>
      {total > 0 && (
        <section className="distrib" aria-label="Résultats des joueurs aujourd'hui">
          <div className="row-between"><b>Aujourd'hui, les {fmt(total)} joueurs</b><span className="muted tiny">bonnes réponses</span></div>
          {['5', '4', '3', '2', '1', '0'].map((k) => { const v = Number(distrib[k] || 0); const max = Math.max(...Object.values(distrib).map(Number), 1); return (
            <div key={k} className={k === String(sc) ? 'drow me' : 'drow'}>
              <span className="dk">{k}/5</span>
              <div className="dbar"><div style={{ width: `${Math.max(4, (v / max) * 100)}%` }}><span>{Math.round((v / total) * 100)} %</span></div></div>
            </div>
          ) })}
        </section>
      )}
      <section className="stack8">
        <h2>Le récap</h2>
        {jeu.map((q, k) => { const c = nomDe(q.id); const ok = etat.rep[k] === q.id; return (
          <div key={k} className="card kk-recap">
            <div className="row12"><Portrait c={c} /><div className="stack4"><b>{ok ? '✅' : '❌'} {c.nom}</b><span className="muted tiny">{c.parti}{!ok && ` · vous aviez dit ${nomDe(etat.rep[k]).nom}`}</span></div></div>
            <blockquote className="extrait">« {q.texte} »<span className="muted tiny"> {q.plateforme === 'tiktok' ? 'TikTok' : q.plateforme === 'youtube' ? 'YouTube' : 'Instagram'} · {dateFr(q.date)} · <a href={q.url} target="_blank" rel="noreferrer">Voir la vidéo</a></span></blockquote>
          </div>
        ) })}
      </section>
      {defiTexte && (
        <div className="modal" role="dialog" aria-label="Défier un ami" onClick={() => setDefiTexte(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <b>Défier un ami</b>
            <a className="btn btn-dark" href={`https://wa.me/?text=${encodeURIComponent(defiTexte)}`} target="_blank" rel="noreferrer">Envoyer par WhatsApp</a>
            <a className="btn btn-outline" href={`sms:?&body=${encodeURIComponent(defiTexte)}`}>Envoyer par SMS</a>
            <label className="small muted" htmlFor="defik-txt">Ou copiez le texte :</label>
            <textarea id="defik-txt" readOnly value={defiTexte} rows={6} className="defi-txt" onFocus={(e) => e.target.select()} />
            <button className="btn btn-outline" onClick={() => setDefiTexte(null)}>Fermer</button>
          </div>
        </div>
      )}
      {INSTAGRAM && <a className="ig-btn" href={IG_URL} target="_blank" rel="noreferrer">Suivre @{INSTAGRAM} sur Instagram</a>}
      <p className="muted small center">5 nouvelles citations demain · <a href="#jeu">Jouer à KYESSE ?</a></p>
    </main>
  )
}

/* ---------------- Swipe : d'accord / pas d'accord, sans les noms ---------------- */
const SW_PAR_CANDIDAT = 2
function pioche() {
  const n = numeroDuJour() + 3 // toutes les citations publiées jusqu'ici
  const pool = poolKikadi(n).filter((q) => q.position !== false) // phrases sans prise de position écartées (marquées à la relecture)
  const par = {}
  pool.forEach((q) => { (par[q.id] = par[q.id] || []).push(q) })
  const seed = Math.floor(Math.random() * 1e9)
  const ids = Object.keys(par).filter((id) => par[id].length >= SW_PAR_CANDIDAT) // même nombre de phrases pour chacun
  const cartes = ids.flatMap((id, k) => shuffle(par[id], seed + k).slice(0, SW_PAR_CANDIDAT))
  return shuffle(cartes, seed)
}
function Swipe() {
  const [cartes, setCartes] = useState(() => pioche())
  const [rep, setRep] = useState([]) // +1, -1 ou 0, gardé dans ce navigateur seulement
  const [dx, setDx] = useState(0)
  const [depart, setDepart] = useState(null)
  const i = rep.length
  const fini = i >= cartes.length
  useEffect(() => { if (fini && cartes.length) api('/api/partie', { jeu: 'swipe', joueur: joueurId() }) }, [fini])
  if (cartes.length < 6) return <main className="screen"><Header title="DAKOUPA ?" /><p className="muted">Pas encore assez de citations publiées.</p></main>
  if (fini) return <SwipeResultat cartes={cartes} rep={rep} rejouer={() => { setCartes(pioche()); setRep([]) }} />
  const q = cartes[i]
  const voter = (v) => { setRep([...rep, v]); setDx(0); setDepart(null) }
  const fin = () => { if (dx > 90) voter(1); else if (dx < -90) voter(-1); else { setDx(0); setDepart(null) } }
  return (
    <main className="screen">
      <Header title="" right={<span className="muted small b">{i + 1} / {cartes.length}</span>} />
      <div className="stack4"><h1 className="h1">DAKOUPA&nbsp;?</h1><p className="muted small">De vraies phrases de candidats, sans les noms. Glissez à droite si vous êtes d'accord, à gauche sinon. On révèle tout à la fin.</p></div>
      <div className="sw-zone">
        {cartes[i + 1] && <div className="sw-card sw-next">« {cartes[i + 1].texte} »</div>}
        <div className={'sw-card' + (dx > 40 ? ' yes' : dx < -40 ? ' no' : '')}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: depart == null ? 'transform .2s' : 'none' }}
          onPointerDown={(e) => { setDepart(e.clientX); e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => { if (depart != null) setDx(e.clientX - depart) }}
          onPointerUp={fin} onPointerCancel={fin}>
          {dx > 40 && <span className="sw-stamp yes">D'ACCORD</span>}
          {dx < -40 && <span className="sw-stamp no">PAS D'ACCORD</span>}
          <span className="sw-q">« {q.texte} »</span>
        </div>
      </div>
      <div className="sw-btns">
        <button className="sw-btn no" onClick={() => voter(-1)} aria-label="Pas d'accord">✕</button>
        <button className="sw-btn skip" onClick={() => voter(0)}>Sans avis</button>
        <button className="sw-btn yes" onClick={() => voter(1)} aria-label="D'accord">✓</button>
      </div>
    </main>
  )
}
function SwipeResultat({ cartes, rep, rejouer }) {
  const parId = {}
  cartes.forEach((q, k) => { const p = (parId[q.id] = parId[q.id] || { id: q.id, pour: 0, contre: 0 }); if (rep[k] > 0) p.pour++; if (rep[k] < 0) p.contre++ })
  const lignes = Object.values(parId).sort((a, b) => (b.pour - b.contre) - (a.pour - a.contre) || b.pour - a.pour)
  const best = lignes[0].pour - lignes[0].contre
  const proches = lignes.filter((l) => l.pour - l.contre === best && l.pour > 0)
  const [copie, setCopie] = useState('')
  const [defiTexte, setDefiTexte] = useState(null)
  const total = cartes.length
  const partager = async () => {
    const qui = proches.length ? `je suis le plus souvent d'accord avec ${proches.map((l) => nomDe(l.id).nom).join(' et ')}` : "je ne suis d'accord avec personne"
    const t = `MOVO 2027 · DAKOUPA ?\nSur ${total} vraies phrases de candidats, sans les noms, ${qui}. Surprise !\nEt toi ? https://${SITE}/#swipe`
    if (navigator.share) { try { await navigator.share({ text: t }); return } catch (e) { if (e?.name === 'AbortError') return } }
    try { await navigator.clipboard.writeText(t); setCopie('Texte copié !') } catch { /* bloqué */ }
    setDefiTexte(t)
  }
  return (
    <main className="screen">
      <Header title="" right={<span className="muted small b">Résultat</span>} />
      <section className="sw-res">
        <span className="eyebrow light">Sur ces {total} phrases</span>
        {proches.length ? <>
          <span>Vous étiez le plus souvent d'accord avec</span>
          <div className="row12 wrap">{proches.map((l) => <div key={l.id} className="row6"><Portrait c={nomDe(l.id)} /><b className="name">{nomDe(l.id).nom}</b></div>)}</div>
        </> : <b className="name">Vous n'étiez d'accord avec personne. Exigeant·e !</b>}
        <button className="btn btn-light w100" onClick={partager}><Icon d={I.share} size={18} /> Partager</button>
        {copie && <span className="small">{copie}</span>}
      </section>
      <p className="warn-soft">Un jeu, pas une consigne de vote : {SW_PAR_CANDIDAT} phrases par candidat, tirées au hasard dans leurs vidéos de la semaine, ce n'est pas un programme. Rejouez : d'autres phrases peuvent donner un autre résultat. Vos réponses restent sur votre téléphone, nous ne les enregistrons pas.</p>
      <section className="stack8">
        <h2>Tous les candidats</h2>
        {lignes.map((l) => { const c = nomDe(l.id); return (
          <div key={l.id} className="row-between small sw-ligne"><span className="row6"><span style={{ color: blocOf(c).color }}>●</span><b>{c.nom}</b></span><span>{l.pour} d'accord · {l.contre} pas d'accord</span></div>
        ) })}
      </section>
      <section className="stack8">
        <h2>Qui a dit quoi</h2>
        {cartes.map((q, k) => { const c = nomDe(q.id); return (
          <div key={k} className="card kk-recap">
            <span className="small b">{rep[k] > 0 ? '👍 D\'accord' : rep[k] < 0 ? '👎 Pas d\'accord' : '· Sans avis'}</span>
            <blockquote className="extrait">« {q.texte} »<span className="muted tiny"> <b>{c.nom}</b> · {dateFr(q.date)} · <a href={q.url} target="_blank" rel="noreferrer">Voir la vidéo</a></span></blockquote>
          </div>
        ) })}
      </section>
      <button className="btn btn-dark" onClick={rejouer}>Rejouer avec d'autres phrases</button>
      {defiTexte && (
        <div className="modal" role="dialog" aria-label="Partager" onClick={() => setDefiTexte(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <b>Partager</b>
            <a className="btn btn-dark" href={`https://wa.me/?text=${encodeURIComponent(defiTexte)}`} target="_blank" rel="noreferrer">Envoyer par WhatsApp</a>
            <a className="btn btn-outline" href={`sms:?&body=${encodeURIComponent(defiTexte)}`}>Envoyer par SMS</a>
            <textarea readOnly value={defiTexte} rows={5} className="defi-txt" onFocus={(e) => e.target.select()} />
            <button className="btn btn-outline" onClick={() => setDefiTexte(null)}>Fermer</button>
          </div>
        </div>
      )}
    </main>
  )
}

/* ---------------- De quoi parlent-ils ? ---------------- */
function Nuage({ h, cid, color, mot, setMot }) {
  const nom = (k) => CANDIDATS.find((y) => y.id === k)?.nom || k
  const liste = cid ? h.candidats[cid]?.mots : h.mots_campagne
  if (!liste) return <div className="callout soft"><b>Le nuage de mots arrive avec l'édition du lundi 16 novembre.</b><span className="small">Cette semaine, voyez la répartition par thème dans « Les thèmes ».</span></div>
  if (!liste.length) return <p className="muted small">{cid ? "Pas assez de vidéos politiques cette semaine pour dégager des mots propres à ce candidat." : 'Pas encore de mots partagés par plusieurs candidats cette semaine.'}</p>
  const max = Math.max(...liste.map((t) => t.n)), min = Math.min(...liste.map((t) => t.n))
  const taille = (n) => 15 + (max === min ? 10 : ((n - min) / (max - min)) * 22)
  // ordre mélangé (graine = semaine) pour éviter une liste triée qui ressemblerait à un classement
  const melange = shuffle([...liste], (h.semaine + (cid || '')).split('').reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7))
  const sel = liste.find((t) => t.mot === mot)
  return (
    <section className="stack8">
      <div className="nuage">
        {melange.map((t) => (
          <button key={t.mot} className={'mot' + (t.mot === mot ? ' on' : '')} style={{ fontSize: taille(t.n), color: t.mot === mot ? '#fff' : color, background: t.mot === mot ? color : 'transparent' }} onClick={() => setMot(t.mot === mot ? null : t.mot)}>{t.mot}</button>
        ))}
      </div>
      {sel && (
        <div className="card stack8">
          <div className="row-between small"><b>« {sel.mot} »</b><span className="muted">{sel.n} fois cette semaine</span></div>
          {cid ? (sel.extraits || []).map((x, k) => (
            <blockquote key={k} className="extrait">« {x.texte} »<span className="muted tiny"> {x.plateforme} · {dateFr(x.date)} · <a href={x.url} target="_blank" rel="noreferrer">Voir la vidéo</a></span></blockquote>
          )) : <ul className="small qui">{sel.qui.map((q) => <li key={q.id}><span style={{ color: blocOf(CANDIDATS.find((y) => y.id === q.id)).color }}>●</span> {nom(q.id)} · {q.n} fois</li>)}</ul>}
          <span className="muted tiny">Un mot seul peut tromper : lisez toujours la phrase entière.</span>
        </div>
      )}
    </section>
  )
}

function Themes() {
  const [h, prev] = editions()
  const [id, setId, ids] = useHebdoCandidat(h)
  const [vue, setVue] = useState('campagne')
  const [tout, setTout] = useState(false)
  const [mode, setMode] = useState('mots')
  const [mot, setMot] = useState(null)
  useEffect(() => setMot(null), [vue, id, mode])
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
        <p className="muted small">{mode === 'mots' ? "Les mots qu'ils emploient le plus, et nettement plus que les autres, dans leurs vidéos officielles. Touchez un mot pour lire la phrase entière." : 'Part du temps de parole par thème dans les vidéos officielles.'} Pas un sondage : ça mesure ce qu'ils disent, pas ce que vous pensez.</p>
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
      <div className="seg small-seg">
        <button className={mode === 'mots' ? 'on' : ''} onClick={() => setMode('mots')}>Leurs mots</button>
        <button className={mode === 'themes' ? 'on' : ''} onClick={() => setMode('themes')}>Les thèmes</button>
      </div>
      {mode === 'mots' && <Nuage h={h} cid={cid} color={color} mot={mot} setMot={setMot} />}
      {mode === 'themes' && <>
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
      </>}
      {mode === 'themes' && top && top.v - top.p > 0 && (
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
        <h2>KYESSE ? (le mystère du jour)</h2>
        <p>Un tirage fixé à l'avance, le même pour tout le monde. Seules les candidatures avec une ligne politique sourcée y entrent. Les modes fondés sur les programmes (À l'aveugle, Mon cap) n'incluront que les candidats ayant publié un programme.</p>
        <h2>L'hebdo et les thèmes</h2>
        <p>Chaque lundi, nous relevons les vidéos publiées sur les comptes officiels des candidats. Les citations sont reproduites mot pour mot, avec un lien vers la vidéo. Chaque passage reçoit un des 12 thèmes ci-dessous ; un humain relit avant publication. On ne publie aucun classement de popularité ni de vues : ce n'est pas un sondage.</p>
        <ul>{THEMES.themes.map((t) => <li key={t.id}><b>{t.label}</b> — ex. {t.exemples.join(', ')}</li>)}</ul>
        <h2>KIKADI ?</h2>
        <p>Chaque jour, 5 citations tirées des éditions de L'hebdo déjà publiées, les mêmes pour tout le monde. Elles sont mot pour mot, avec la vidéo d'origine. On écarte les phrases où le candidat se nomme lui-même. Les 3 autres noms proposés sont tirés au hasard parmi les candidats cités dans L'hebdo. Une citation ne revient pas avant une semaine tant que le stock le permet. Les nouvelles citations entrent le lendemain de la publication de L'hebdo.</p>
        <h2>DAKOUPA ?</h2>
        <p>Le même nombre de phrases pour chaque candidat cité dans L'hebdo, tirées au hasard et présentées sans nom. À la fin, on indique avec qui vous avez été le plus souvent d'accord sur ces phrases-là. C'est un jeu, pas un comparateur de programmes ni une consigne de vote. Vos réponses ne quittent pas votre téléphone : seul le nombre de parties est compté.</p>
        <h2>Le nuage de mots</h2>
        <p>À partir des seuls passages politiques des vidéos, nous comptons les mots et expressions de chaque candidat, puis gardons ceux qu'il emploie nettement plus que les autres. On retire les mots-outils et les mots trop vagues (« choses », « vraiment », « pays »…). On ne retire jamais un mot parce qu'il est polémique. Un mot doit apparaître au moins deux fois. Les mots sont affichés dans un ordre mélangé, pas classés. Chaque mot renvoie à la phrase entière et à la vidéo : un mot sorti de son contexte peut tromper.</p>
        <h2>Sources</h2>
        <ul>{Object.values(SOURCES).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.titre}</a> ({s.date})</li>)}</ul>
        <h2>Compteurs et classement</h2>
        <p>Chaque navigateur reçoit un identifiant anonyme et aléatoire. Il sert à compter les parties et les joueurs, et à tenir votre série. Le pseudo est facultatif. Pas d'email, pas de compte, pas de cookie publicitaire. Les compteurs portent sur les joueurs, jamais sur les candidats : ce n'est pas un sondage.</p>
      </article>
    </main>
  )
}

/* ---------------- Classement + code de sauvegarde ---------------- */
const ONGLETS = {
  jour: { label: "Aujourd'hui", titre: 'Le mystère du jour', unite: 'indices', vide: "Personne n'a encore joué le mystère du jour.", note: "Moins d'indices = mieux. À égalité, le premier à avoir trouvé passe devant." },
  moyenne: { label: 'Moyenne', titre: 'Les plus réguliers', unite: 'indices en moyenne', vide: 'Il faut au moins 5 parties pour entrer dans ce classement.', note: 'Moyenne d\'indices sur toutes vos parties (un raté compte 7), dès 5 parties.' },
  series: { label: 'Séries', titre: 'Les plus longues séries en cours', unite: "jours d'affilée", vide: 'Personne encore. Jouez le mystère du jour pour ouvrir le bal.', note: 'Nombre de jours trouvés d\'affilée, sans en rater un.' },
}

function Classement() {
  const st = useStats(numeroDuJour())
  const [onglet, setOnglet] = useState('jour')
  const [moi, setMoi] = useState(() => store.get('qec-stats', {}))
  const [pseudo, setPseudo] = useState(moi.pseudo || '')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { api('/api/compte', { action: 'moi', joueur: joueurId() }).then((j) => { if (j?.user) { syncStats(j.user); setMoi(store.get('qec-stats', {})); if (j.user.pseudo) setPseudo(j.user.pseudo) } }) }, [])
  const enregistrerPseudo = async (e) => {
    e.preventDefault()
    const j = await api('/api/compte', { action: 'pseudo', joueur: joueurId(), pseudo })
    if (j?.ok) { syncStats({ ...moi, pseudo: j.pseudo, nom: j.pseudo }); setMoi(store.get('qec-stats', {})); setMsg('Pseudo enregistré. Il apparaît dans les classements dès votre prochaine partie.') }
    else setMsg(j?.erreur === 'pris' ? 'Ce pseudo est déjà pris. Choisissez-en un autre.' : j?.erreur === 'pseudo' ? 'Pseudo refusé : 2 à 15 caractères, lettres, chiffres, espaces, et rien d\'injurieux.' : 'Connexion impossible, réessayez.')
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
      <div className="seg">
        {Object.entries(ONGLETS).map(([k, o]) => <button key={k} className={onglet === k ? 'on' : ''} onClick={() => setOnglet(k)}>{o.label}</button>)}
      </div>
      <section className="chart">
        <div className="row-between"><b>{ONGLETS[onglet].titre}</b><span className="muted tiny">{ONGLETS[onglet].unite}</span></div>
        {!st && <span className="muted small">Classement indisponible pour le moment.</span>}
        {st && (() => {
          const rows = onglet === 'jour' ? (st.classementJour || []).map((u) => ({ pseudo: u.pseudo, v: u.essais ?? 'Raté' }))
            : onglet === 'moyenne' ? (st.classementMoyenne || []).map((u) => ({ pseudo: u.pseudo, v: String(u.moyenne).replace('.', ','), sub: `${u.parties} parties` }))
            : (st.classement || []).map((u) => ({ pseudo: u.pseudo, v: u.serie }))
          if (!rows.length) return <span className="muted small">{ONGLETS[onglet].vide}</span>
          return rows.map((u, i) => (
            <div key={i} className={u.pseudo === (moi.nom || moi.pseudo) ? 'lbrow me' : 'lbrow'}><span className="rank">{i + 1}</span><span className="col"><b>{u.pseudo}</b>{u.sub && <span className="muted tiny">{u.sub}</span>}</span><span className="b">{u.v}</span></div>
          ))
        })()}
        <span className="muted tiny">{ONGLETS[onglet].note}</span>
      </section>

      <form className="card-form" onSubmit={enregistrerPseudo}>
        <label htmlFor="pseudo" className="b">Votre pseudo (facultatif)</label>
        <span className="muted tiny">Pas d'email, pas de compte. {moi.num && !moi.pseudo ? `Sans pseudo, vous apparaissez comme « Joueur ${moi.num} ». ` : ''}Votre série actuelle : {moi.serie || 0}.</span>
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
        : page === 'kikadi' ? <Kikadi />
        : page === 'swipe' ? <Swipe />
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
