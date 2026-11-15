# Job hebdo « L'hebdo » + « De quoi parlent-ils ? »

Lancé chaque lundi à 7h (heure de Paris) par une tâche planifiée Claude. Il produit un **brouillon**,
jamais une publication directe : rien n'apparaît dans l'app tant que Lucas n'a pas validé.

## 0. Pré-requis (première exécution seulement)
Pour les candidats de `src/data/comptes.json` dont la liste est vide — UNIQUEMENT si
`_meta.derniere_recherche_comptes` date de plus de 28 jours (sinon passer), en UN seul appel groupé
(`displayName.includesFuzzy` avec `operator: "or"` et tous les noms sans accents), puis mettre la date à jour :
- `search_profiles` (Oriane, projection `basic`, limit 5) sur le nom affiché + `isVerified: true`.
- Ajouter les comptes trouvés avec `"valide": false`, `plateforme`, `handle`, `oriane_id`.
- Ne PAS lancer la suite pour un candidat dont aucun compte n'est `"valide": true`.

Pour chaque compte `"valide": true` sans `oriane_id` : UNE recherche `search_profiles` (projection `basic`,
`handle` en `exactMatch`, sur instagram, tiktok et youtube). S'il est trouvé, renseigner `oriane_id` et la
plateforme, et le signaler dans la PR. Sinon, le noter dans la PR (« pas encore indexé ») et passer au suivant.

## 1. Collecte — 1 appel Oriane par candidat
Pour chaque candidat ayant au moins un compte validé, UN SEUL appel `search_contents` :
- `operator: "and"`, `filters.profileId.includes` = ses `oriane_id` validés
- `filters.publishedAt` = lundi→dimanche de la semaine écoulée
- `filters.format.includes = ["video"]`, `filters.hasTranscript = true`
- `projection: "default"` (contient les transcriptions), `limit: 30`, `sort: [{ by: "viewsCount" }]`
Ne jamais utiliser `full`, la similarité visuelle ni `create_asset` (coût en crédits).
Écrire la réponse brute dans `scripts/hebdo/raw/<AAAA-Www>.json` sous `candidats.<id>.videos`
(url, plateforme, date, vues, durée, transcription, vignette).

## 2. Analyse (Claude)
Pour chaque vidéo :
- Découper la transcription en passages (≈ phrases). Donner à chaque passage UN thème parmi les 12
  de `src/data/themes.json` (exemples à l'appui), avec sa durée en secondes si disponible, sinon son nombre de mots.
- Écrire `segments: [{ theme, poids, texte }]` dans le fichier brut, où `texte` est le passage MOT POUR MOT
  tiré de la transcription (il alimente le nuage de mots et ses extraits).
- Passages SANS contenu politique (sport, vie privée, promotion, coulisses sans propos de campagne) : ne leur
  donner aucun thème et ne pas les compter. Une vidéo entièrement hors politique est ignorée (ni thèmes ni citation),
  et ne compte pas dans `nb_videos`. Si un candidat n'a aucune vidéo politique dans la semaine, ne pas le mettre
  dans l'édition.

Choisir **5 citations** par candidat :
- tirées des vidéos les plus vues, une seule par vidéo autant que possible ;
- **mot pour mot** (copier-coller de la transcription), 8 à 30 mots, compréhensibles seules ;
- pas d'extrait qui change le sens (vérifier la phrase d'avant et d'après) ;
- écrire `citations: [{ texte, url, plateforme, date, vignette }]`.

### Nuage de mots
Le script calcule seul, pour chaque candidat, les mots et expressions qu'il emploie nettement plus que
les autres (score de spécificité), en écartant les mots de `src/data/mots-exclus.json`.
Après un premier `npm run hebdo`, relire le top 15 de chaque candidat : si un mot n'apprend rien
(tic de langage, mot vague, nom propre sans intérêt), l'ajouter à la liste `exclus` du fichier brut et
relancer. Ne JAMAIS retirer un mot parce qu'il est polémique ou dérangeant : c'est le but du nuage.
Lister dans la PR les mots retirés et le top 10 de chaque candidat.

### Jeu « D'accord ou pas ? »
Pour chaque citation retenue, ajouter `"position": false` si la phrase n'exprime AUCUNE idée sur
laquelle on peut être d'accord ou non (remerciement, anecdote, phrase sur soi : « quel honneur vous me
faites », « je suis un combattant »). Ces phrases restent dans L'hebdo et Kikadi, mais sortent du swipe.
Dans le doute, garder. Lister dans la PR les citations marquées.

## 3. Construction du brouillon
`npm run hebdo -- <AAAA-Www>` → crée `src/data/hebdo/<AAAA-Www>.json` avec `"statut": "brouillon"`.
Le script refuse toute citation qui ne figure pas mot pour mot dans la transcription.

## 4. Revue humaine
Ouvrir une pull request « L'hebdo <semaine> — brouillon à valider » avec, dans la description :
les 5 citations de chaque candidat + lien, le top 3 des thèmes par candidat, les passages au thème douteux.
Lucas relit, corrige si besoin, l'aperçoit sur `/#apercu-hebdo` (brouillons visibles), puis lance
`npm run hebdo -- <AAAA-Www> --publier` (passe le statut à `publie`) et fusionne. Vercel redéploie automatiquement.

## Garde-fous
- Aucun classement de vues ou de popularité affiché (risque « sondage »).
- Pas de publication la veille et le jour du scrutin.
- Toute citation contestée est retirée d'abord, vérifiée ensuite.
