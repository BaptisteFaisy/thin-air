---
inclusion: always
---

# Pile technique

| Élément | Choix | Pourquoi |
|---|---|---|
| Langage | TypeScript strict (`strict`, `noUncheckedIndexedAccess`) | un contrat partagé entre lots parallèles (`packages/core/src/types.ts`) |
| Exécution | Node ≥ 22 | le calcul pur se teste sans navigateur |
| Site | Vite + React 19 | statique, hébergé gratuitement en HTTPS (AIR-N-13) |
| Vision | `@mediapipe/tasks-vision`, Hand Landmarker | 21 points par main, mode vidéo (§7.3) |
| Validation | Zod | instrument, prise, session (`packages/schema`) |
| Tests | Vitest + fast-check | propriétés du §13.2, graines consignées |
| TypeScript exécuté | `tsx` | le banc d'essai tourne en ligne de commande |
| Rendu audio | moteur échantillon par échantillon écrit en TypeScript pur | tourne dans Node : aucun périphérique audio ne peut être ouvert |

## Trois contraintes qui commandent tout le reste

- **Aucun son, jamais** (AIR-N-02) : pas de lecteur, pas de réglage de volume,
  pas de périphérique. Le rendu hors ligne calcule des échantillons dans un
  tableau et les écrit dans un fichier (décision notée au journal de bord :
  Node remplace le navigateur sans écran du §13.1, la preuve est plus stricte).
- **Aucune requête réseau** hors `scripts/fetch-model.mjs` (AIR-N-01) : le
  modèle et ses fichiers d'exécution sont servis par le site lui-même, dans
  `public/models/`, et la page fonctionne hors ligne après la première visite.
- **Déterminisme** (AIR-N-09) : pas de `Math.random()` sans graine, pas de
  `Date.now()` dans `packages/core`, pas d'ordre d'itération d'objet non trié.
  Une même prise et un même instrument donnent la même liste d'événements.

## Espaces de travail

`packages/core` (pur), `packages/schema`, `packages/audio`, `packages/vision`,
`apps/web`, `apps/bench`. Les alias `@thin-air/<paquet>` sont déclarés dans
`tsconfig.base.json` et `vitest.config.ts` : un lot ne touche ni à l'un ni à
l'autre (`docs/CONTRACT.md`). Une dépendance manquante se signale, elle ne
s'installe pas.
