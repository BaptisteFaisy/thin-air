# Contrat de construction — qui écrit quoi, et sur quelles règles

Le projet est construit en parallèle, par lots. Ce fichier est la seule
autorité sur les frontières : il dit quels fichiers appartiennent à quel lot,
quelles signatures sont figées, et ce qu'un lot n'a pas le droit de toucher.

Le cahier des charges est `docs/cahier-des-charges.md` ; les références
`§7.5`, `AIR-F-13`, `AIR-P-02` renvoient à ses sections.

## Règles qui valent pour tous les lots

1. **Les signatures exportées du squelette sont figées.** Un lot implémente les
   corps, ajoute ce dont il a besoin, mais ne renomme pas et ne retire pas un
   export, et ne change pas un type de `packages/core/src/types.ts`. Besoin d'un
   changement de contrat → le dire dans le compte rendu, ne pas le faire.
2. **Aucun lot ne touche aux fichiers d'un autre**, ni à `package.json`, ni à
   `package-lock.json`, ni à `tsconfig*.json`, ni à `vitest.config.ts`, ni à
   `.github/`. Une dépendance manquante se signale, elle ne s'installe pas.
3. **Aucun fichier de code au-delà de 500 lignes, aucune fonction au-delà de
   50 lignes** (règle user). Découper en modules plutôt que laisser grossir.
4. **Aucune duplication** : une logique = une implémentation. Réutiliser
   `@thin-air/core` (musique, mesures, défauts) au lieu de réécrire.
5. **Aucun son, jamais** (AIR-N-02). Pas de lecteur audio, pas de réglage de
   volume, pas de périphérique : les preuves sont des tableaux d'échantillons,
   des fichiers et des nombres.
6. **Aucune requête réseau** hors `scripts/fetch-model.mjs` (AIR-N-01).
7. **Déterminisme** (AIR-N-09) : pas de `Math.random()` sans graine, pas de
   `Date.now()` dans `packages/core`, pas d'ordre d'itération d'objet non trié.
8. Chaque lot livre **ses tests** (Vitest, `*.test.ts` à côté du code), et les
   propriétés du cahier qu'il couvre, nommées d'après leur identifiant :
   `it("AIR-P-02 — la sortie reste bornée", …)`.
9. `npm run typecheck` et `npx vitest run` doivent passer **avant** de pousser.
   Une propriété dont la dépendance n'est pas encore implémentée (autre lot) se
   marque `it.todo(...)` avec l'identifiant, jamais `it.skip` silencieux.

## Propriété des fichiers, par lot

| Lot | Fichiers (propriétaire exclusif) | Propriétés du cahier |
|---|---|---|
| A1 `space` | `packages/core/src/space.ts` + `space.test.ts` | AIR-P-01, 22 |
| A2 `filter` | `packages/core/src/filter.ts` + `filter.test.ts` | AIR-P-02 |
| A3 `music` | `packages/core/src/music.ts` + `music.test.ts` | AIR-P-03, 04, 05 |
| A4 `schema` | `packages/schema/src/**` | AIR-P-19, 20 |
| A5 `audio` | `packages/audio/src/**` (dsp, offline, graph, worklets) **et** `packages/core/src/measure.ts` + son test | AIR-P-13, 14, 15, 16 |
| A6 `loop+midi` | `packages/core/src/loop.ts`, `midi.ts` + leurs tests | AIR-P-17, 18 |
| A7 `kiro+instruments` | `.kiro/**`, `instruments/**`, `scripts/hooks/**` (sauf les deux gardes déjà écrites), `takes/README.md` | recette §18 |
| A8 `docs+ci` | `README.md`, `NOTICE.md`, `docs/journal.md`, `docs/latency.md`, `.github/workflows/build.yml` | AIR-N-05, 11, 13 |
| B1 `features+gestures` | `packages/core/src/features.ts`, `roles.ts`, `gestures.ts`, `takeGen.ts` + tests | AIR-P-06, 07, 08, 21 |
| B2 `instrument+pipeline` | `packages/core/src/instrument.ts`, `voices.ts`, `schedule.ts`, `pipeline.ts` + tests | AIR-P-09, 10, 11, 12 |
| B3 `bench` | `apps/bench/src/**`, `takes/reference/**`, `takes/synth/**` | recette §18 |
| B4 `web` | `apps/web/**` | AIR-F-01, 02, 31 à 33, 51 à 53, AIR-N-06 |
| B5 `vision` | `packages/vision/src/**` | AIR-F-03, 04, 47, 48 |

## Ce qui est déjà écrit (ne pas réécrire)

- `packages/core/src/types.ts` — les types partagés, dont `MusicEvent`, la
  couture matérialisée (§11.3).
- `packages/core/src/defaults.ts` — `DEFAULT_SETTINGS` (§7.13) et la zone par
  défaut (AIR-F-08). Une valeur de réglage ne vit nulle part ailleurs.
- `packages/core/src/internal.ts` — `todo(module, lot)`, qui marque un contrat
  pas encore implémenté. Un lot remplacé retire ses `todo`.
- `scripts/hooks/no-audio-asset-guard.mjs`, `wording-guard.mjs`,
  `run-all-guards.mjs` — les gardes lancées par la CI.
- `.github/**`, `.mergify.yml` — la chaîne de merge (gelée, voir `couche0`).

## Forme d'un compte rendu de lot

Trois lignes suffisent : ce qui est implémenté, ce que les tests prouvent
(nombres), et ce qui reste bloqué par un autre lot. Les décisions de
conception qui s'écartent du cahier sont écrites dans `docs/journal.md`.
