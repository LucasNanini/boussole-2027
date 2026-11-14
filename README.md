# MOVO 2027 · Mais où va-t-on ?

Jeu et guide neutre pour la présidentielle 2027 : le mystère du jour « Qui est-ce ? », le Trombino
des candidatures, L'hebdo (5 citations par candidat) et « De quoi parlent-ils ? » (thèmes semaine après semaine).

- `npm install` puis `npm run dev`
- `npm run build` → `dist/` (site statique ; Vercel le détecte tout seul : framework Vite)

## Données
- `src/data/candidats.json` : liste, familles, sources. **Brouillon : à relire avant lancement** (voir `/#revue`).
- `public/candidats/<id>.jpg` : portraits illustrés (IA), 512 px.
- `src/data/themes.json` : les 12 thèmes, figés jusqu'à l'élection.
- `src/data/comptes.json` : comptes officiels utilisés par le job hebdo (à valider).
- `src/data/hebdo/<AAAA-Www>.json` : éditions hebdo (seules celles en `"statut": "publie"` s'affichent).

## Job hebdo
Voir `scripts/hebdo/PROCEDURE.md`. Une tâche planifiée Claude le lance chaque lundi et ouvre une PR de brouillon.
