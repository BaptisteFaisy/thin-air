# Audit du dépôt — un rapport, pas une preuve

Ce fichier est produit par `node scripts/audit-depot.mjs`. La section entre
les deux marqueurs est réécrite à chaque exécution ; tout ce qui est écrit
autour est conservé.

## La règle : un rapport n'est pas une preuve, il est une piste

- Un rapport est le produit d'un script : le script se trompe. Chaque ligne
  est un **signal**, jamais un verdict.
- Le signal ne sait rien de l'intention. Un fichier exporté jamais importé
  peut être lu par un humain ; une dépendance déclarée peut servir à un
  outil ; un `todo(` peut être une trace ou une dette.
- La consolidation ne se décide donc **pas** sur le rapport : elle se décide
  dans le dépôt, ligne par ligne, après vérification à la main.
- Ce que le rapport ne sait pas faire est écrit dans sa section « Points
  durs ». Ce paragraphe se lit avant le reste.
- Un rapport qui n'est pas rejouable ne vaut rien : celui-ci est rejouable
  d'une commande, sans réseau et sans son.

## La marche à suivre, pour chaque ligne du rapport

1. **Relire le signal dans le fichier** qu'il désigne, pas dans le rapport.
   Le rapport donne un chemin et un compte : c'est le fichier qui fait foi.
2. **Décider de ce qu'il est** : vrai, faux, ou choix assumé.
   - *Vrai* : on corrige le dépôt (découper, supprimer, documenter, tester).
   - *Faux* : on corrige le script ou on écrit une exclusion explicite et
     commentée — jamais un chiffre arrangé.
   - *Choix* : on l'écrit dans `docs/journal.md`, pour que le prochain
     lecteur ne redécouvre pas la même question.
3. **Ne pas traiter le rapport comme une liste de tâches.** C'est une liste
   de questions, dans un ordre de grandeur, pas un calendrier.
4. **Refaire tourner le script** après le lot : `node scripts/audit-depot.mjs`.
   Ce qui a disparu est traité ; ce qui reste est à traiter ; ce qui a
   changé de chiffre mérite d'être regardé.
5. **Un lot, un sujet.** Ne pas mélanger « trop long » et « dépendance
   inutile » dans la même PR : la revue s'y perd, et le rapport ne dit pas
   quelle ligne a été traitée.

## Comment lire chaque section

| Section | Ce qu'elle cherche | Ce qu'il faut vérifier |
|---|---|---|
| (a) Fichiers au-delà de 500 lignes | la règle de taille du dépôt | le découpage naturel du module |
| (a) Fonctions au-delà de 50 lignes | la règle de taille des fonctions | si la fonction est une suite de cas ou une vraie logique |
| (b) `todo(` dans `packages/` et `apps/` | les dépendances de lot non livrées | si le lot est arrivé, ou s'il reste à faire |
| (c) Exports jamais importés | le code mort probable | si le fichier est lu par un outil, une garde ou un document |
| (d) Dépendances inutiles / non déclarées | la commande et le manifeste | si l'outil est lancé en ligne de commande, ou importé par un script |
| (e) Documents orphelins | les documents que personne ne cite | si le document est une trace, un compte rendu ou une fiche à garder |
| (f) `TODO`, `FIXME`, `HACK` | la dette écrite | si la dette est réelle ou si c'est une trace à supprimer |
| (g) Doublons et quasi-doublons | la duplication | si les deux fichiers ont divergé pour une raison voulue |
| (h) Forge | l'état de la file | rien : c'est un état, pas une dette |

## Les commandes

```bash
node scripts/audit-depot.mjs                       # écrit out/audit.json et réécrit la section générée
node scripts/audit-depot.mjs --sans-github         # sans la lecture de l'API GitHub
node scripts/audit-depot.mjs <dossier> --json <f> --md <f>   # auditer un autre dossier
node --test scripts/audit-depot.test.ts            # le banc du script, sur un dossier témoin
```

<!-- audit:debut -->
_Généré le 2026-11-13T15:49:08Z par `node scripts/audit-depot.mjs`._

## Résumé

| Mesure | Nombre |
|---|---|
| Fichiers de code au-delà de 500 lignes | 0 |
| Fonctions au-delà de 50 lignes | 102 |
| `todo(` restants dans `packages/` et `apps/` | 26 |
| Fichiers exportés jamais importés | 5 |
| Dépendances déclarées jamais utilisées | 0 |
| Imports de paquets non déclarés | 1 |
| Documents cités par aucun autre document | 22 |
| `TODO` / `FIXME` / `HACK` | 8 |
| Groupes de doublons ou quasi-doublons | 1 |
| PR ouvertes (API GitHub) | — |
| Contrôles verts sur `main` (API GitHub) | — |

## (a) Fichiers de code au-delà de 500 lignes

- (rien à signaler)

## (a) Fonctions au-delà de 50 lignes

- `scripts/lib/api-parse.mjs:147` — `lisExport` — 199 lignes (seuil : 50)
- `packages/vision/src/replay.test.ts:58` — `describe(…)` — 143 lignes (seuil : 50)
- `packages/core/src/takeGen.test.ts:176` — `describe(…)` — 139 lignes (seuil : 50)
- `apps/web/src/lib/tracking.test.ts:153` — `describe(…)` — 138 lignes (seuil : 50)
- `packages/schema/src/schema.test.ts:269` — `describe(…)` — 136 lignes (seuil : 50)
- `packages/core/src/gestures.test.ts:50` — `describe(…)` — 135 lignes (seuil : 50)
- `apps/web/src/state/machine.test.ts:18` — `describe(…)` — 130 lignes (seuil : 50)
- `apps/bench/src/compare.test.ts:29` — `describe(…)` — 119 lignes (seuil : 50)
- `packages/vision/src/camera-source.test.ts:361` — `describe(…)` — 108 lignes (seuil : 50)
- `apps/web/src/scene/geometry.test.ts:44` — `describe(…)` — 104 lignes (seuil : 50)
- `scripts/registre-agents.test.ts:103` — `describe(…)` — 99 lignes (seuil : 50)
- `packages/vision/src/camera-source.test.ts:110` — `describe(…)` — 98 lignes (seuil : 50)
- `apps/web/src/scene/paint.test.ts:59` — `describe(…)` — 95 lignes (seuil : 50)
- `packages/core/src/gestures.test.ts:239` — `describe(…)` — 94 lignes (seuil : 50)
- `scripts/check-format-versions.test.mjs:55` — `describe(…)` — 93 lignes (seuil : 50)
- `packages/vision/src/virtual-hand.test.ts:26` — `describe(…)` — 92 lignes (seuil : 50)
- `apps/web/src/state/display.test.ts:26` — `describe(…)` — 91 lignes (seuil : 50)
- `apps/web/src/ui/LessonsPanel.tsx:184` — `Exemple` — 91 lignes (seuil : 50)
- `apps/web/src/live-controls.test.ts:153` — `describe(…)` — 89 lignes (seuil : 50)
- `packages/vision/src/recorder.test.ts:34` — `describe(…)` — 89 lignes (seuil : 50)
- `packages/audio/src/dsp/voice.test.ts:22` — `describe(…)` — 88 lignes (seuil : 50)
- `packages/core/src/features.test.ts:130` — `describe(…)` — 88 lignes (seuil : 50)
- `packages/core/src/loop.test.ts:197` — `describe(…)` — 88 lignes (seuil : 50)
- `packages/core/src/voices.test.ts:48` — `describe(…)` — 88 lignes (seuil : 50)
- `packages/vision/src/worker/host.test.ts:163` — `describe(…)` — 88 lignes (seuil : 50)
- `scripts/lib/audit/code.mjs:196` — `creerResolveur` — 88 lignes (seuil : 50)
- `packages/core/src/loop.test.ts:371` — `describe(…)` — 87 lignes (seuil : 50)
- `apps/bench/src/args.test.ts:12` — `describe(…)` — 85 lignes (seuil : 50)
- `apps/web/src/ui/RealTake.tsx:36` — `RealTakePage` — 84 lignes (seuil : 50)
- `packages/core/src/loop.test.ts:286` — `describe(…)` — 84 lignes (seuil : 50)
- `packages/core/src/midi.test.ts:212` — `describe(…)` — 84 lignes (seuil : 50)
- `apps/web/src/features.test.tsx:92` — `describe(…)` — 83 lignes (seuil : 50)
- `apps/web/src/state/latency.test.ts:33` — `describe(…)` — 82 lignes (seuil : 50)
- `packages/core/src/loop.test.ts:114` — `describe(…)` — 82 lignes (seuil : 50)
- `scripts/release-check.test.ts:57` — `describe(…)` — 81 lignes (seuil : 50)
- `packages/core/src/midi.test.ts:297` — `describe(…)` — 80 lignes (seuil : 50)
- `apps/web/src/ui/InstrumentEditor.tsx:57` — `InstrumentEditor` — 79 lignes (seuil : 50)
- `packages/vision/src/no-hands.test.ts:18` — `describe(…)` — 79 lignes (seuil : 50)
- `apps/bench/src/tuning.test.ts:43` — `describe(…)` — 75 lignes (seuil : 50)
- `packages/core/src/midi.test.ts:98` — `describe(…)` — 75 lignes (seuil : 50)
- `packages/vision/src/analysis-history.test.ts:41` — `describe(…)` — 75 lignes (seuil : 50)
- `packages/vision/src/pointer.test.ts:85` — `describe(…)` — 75 lignes (seuil : 50)
- `scripts/check-budget.test.ts:65` — `describe(…)` — 75 lignes (seuil : 50)
- `apps/web/e2e/hors-ligne.spec.ts:82` — `test(…)` — 74 lignes (seuil : 50)
- `apps/web/src/kiosk/kioskState.test.ts:30` — `describe(…)` — 74 lignes (seuil : 50)
- `apps/web/src/state/profiles.test.ts:32` — `describe(…)` — 74 lignes (seuil : 50)
- `apps/web/src/ui/LessonsPanel.tsx:97` — `Direct` — 73 lignes (seuil : 50)
- `packages/vision/src/camera-source.test.ts:234` — `describe(…)` — 73 lignes (seuil : 50)
- `apps/bench/src/recipes.test.ts:54` — `describe(…)` — 72 lignes (seuil : 50)
- `packages/audio/src/offline/render.test.ts:43` — `describe(…)` — 72 lignes (seuil : 50)
- `packages/core/src/schedule.test.ts:89` — `describe(…)` — 72 lignes (seuil : 50)
- `packages/vision/src/camera-source.test.ts:33` — `banc` — 72 lignes (seuil : 50)
- `packages/core/src/features.test.ts:40` — `describe(…)` — 69 lignes (seuil : 50)
- `packages/core/src/filter.test.ts:128` — `describe(…)` — 69 lignes (seuil : 50)
- `packages/core/src/music.test.ts:187` — `describe(…)` — 69 lignes (seuil : 50)
- `packages/schema/src/schema.test.ts:200` — `describe(…)` — 68 lignes (seuil : 50)
- `packages/vision/src/camera-source.test.ts:362` — `it(…)` — 68 lignes (seuil : 50)
- `apps/web/src/kiosk/kioskState.test.ts:169` — `describe(…)` — 67 lignes (seuil : 50)
- `apps/web/src/features-liste.test.ts:75` — `describe(…)` — 66 lignes (seuil : 50)
- `packages/core/src/instrument.test.ts:50` — `describe(…)` — 66 lignes (seuil : 50)
- `packages/core/src/instrument.test.ts:182` — `describe(…)` — 66 lignes (seuil : 50)
- `packages/core/src/space.test.ts:29` — `describe(…)` — 65 lignes (seuil : 50)
- `packages/vision/src/landmarker.test.ts:103` — `describe(…)` — 65 lignes (seuil : 50)
- `packages/audio/src/offline/render.test.ts:232` — `describe(…)` — 64 lignes (seuil : 50)
- `packages/audio/src/offline/wav.test.ts:12` — `describe(…)` — 64 lignes (seuil : 50)
- `packages/core/src/filter.test.ts:198` — `describe(…)` — 64 lignes (seuil : 50)
- `apps/web/src/kiosk/kioskState.test.ts:105` — `describe(…)` — 63 lignes (seuil : 50)
- `apps/web/src/state/calibration.test.ts:31` — `describe(…)` — 63 lignes (seuil : 50)
- `apps/web/src/state/loopState.test.ts:24` — `describe(…)` — 61 lignes (seuil : 50)
- `apps/bench/src/prises-reelles.test.ts:56` — `describe(…)` — 60 lignes (seuil : 50)
- `apps/bench/src/takes.test.ts:25` — `describe(…)` — 60 lignes (seuil : 50)
- `apps/web/src/lessons/horlogesLesson.test.ts:36` — `describe(…)` — 59 lignes (seuil : 50)
- `packages/core/src/schedule.test.ts:29` — `describe(…)` — 59 lignes (seuil : 50)
- `instruments/instruments.test.ts:71` — `describe(…)` — 58 lignes (seuil : 50)
- `instruments/instruments.test.ts:130` — `describe(…)` — 58 lignes (seuil : 50)
- `packages/core/src/pipeline.test.ts:94` — `describe(…)` — 58 lignes (seuil : 50)
- `apps/bench/src/tuning-mesure.test.ts:59` — `describe(…)` — 57 lignes (seuil : 50)
- `apps/web/src/state/realTake.test.ts:23` — `describe(…)` — 57 lignes (seuil : 50)
- `packages/audio/src/dsp/engines.test.ts:4` — `describe(…)` — 57 lignes (seuil : 50)
- `packages/vision/src/pointer.test.ts:161` — `describe(…)` — 57 lignes (seuil : 50)
- `apps/web/src/App.tsx:54` — `App` — 55 lignes (seuil : 50)
- `apps/web/src/lessons/lessons.test.ts:13` — `describe(…)` — 55 lignes (seuil : 50)
- `apps/web/src/state/instruments.test.ts:73` — `describe(…)` — 55 lignes (seuil : 50)
- `packages/audio/src/graph/scheduler.test.ts:153` — `describe(…)` — 55 lignes (seuil : 50)
- `packages/vision/src/sides.test.ts:42` — `describe(…)` — 55 lignes (seuil : 50)
- `apps/bench/src/cli.test.ts:174` — `describe(…)` — 54 lignes (seuil : 50)
- `apps/bench/src/io.test.ts:108` — `describe(…)` — 54 lignes (seuil : 50)
- `apps/web/src/ui/InstrumentEditor.tsx:138` — `Geometrie` — 54 lignes (seuil : 50)
- `packages/core/src/loop.test.ts:372` — `it(…)` — 54 lignes (seuil : 50)
- `packages/vision/src/source.test.ts:35` — `describe(…)` — 54 lignes (seuil : 50)
- `apps/bench/src/recipes.test.ts:174` — `describe(…)` — 53 lignes (seuil : 50)
- `apps/web/src/state/instruments.test.ts:129` — `describe(…)` — 53 lignes (seuil : 50)
- `packages/core/src/music.test.ts:79` — `describe(…)` — 53 lignes (seuil : 50)
- `packages/core/src/music.test.ts:133` — `describe(…)` — 53 lignes (seuil : 50)
- `packages/core/src/takeGen.test.ts:93` — `describe(…)` — 53 lignes (seuil : 50)
- `packages/core/src/gestures.test.ts:186` — `describe(…)` — 52 lignes (seuil : 50)
- `packages/vision/src/camera-source.test.ts:308` — `describe(…)` — 52 lignes (seuil : 50)
- `packages/vision/src/capture.test.ts:136` — `describe(…)` — 52 lignes (seuil : 50)
- `scripts/check-api.mjs:58` — `main` — 52 lignes (seuil : 50)
- `scripts/horodatage.test.ts:30` — `describe(…)` — 52 lignes (seuil : 50)
- `apps/bench/src/cli.test.ts:122` — `describe(…)` — 51 lignes (seuil : 50)
- `instruments/guards.test.ts:198` — `describe(…)` — 51 lignes (seuil : 50)

## (b) `todo(` restants dans `packages/` et `apps/`

- `apps/bench/src/contracts.ts:6` — * sont des `todo(...)` : un import statique empêcherait `bench --help` de
- `apps/bench/src/errors.ts:37` — /** Une dépendance d'un autre lot n'est pas encore livrée (`todo(...)`). */
- `apps/bench/src/errors.ts:46` — * `todo(...)`, ou le paquet n'est pas résolvable ici — `@thin-air/schema` et
- `apps/bench/src/synth.test.ts:49` — // Tant que `takeGen` est en `todo(...)`, `synthTake` doit lever une erreur
- `apps/web/src/lib/engine.test.ts:39` — it.todo("AIR-F-03 — une image analysée une seule fois : demande un navigateur (E2E)");
- `apps/web/src/lib/engine.test.ts:40` — it.todo("AIR-F-50 — le fantôme rejoue une prise : demande un navigateur (E2E)");
- `apps/web/src/lib/gameLoop.test.ts:78` — it.todo("AIR-P-11 — une image ne produit jamais plus de `maxVoices` voix — dépend du lot A3 (voices)");
- `apps/web/src/lib/gameLoop.test.ts:79` — it.todo("AIR-P-12 — la même prise redonne la même liste d'événements — dépend du lot A3 (pipeline)");
- `apps/web/src/state/display.test.ts:115` — it.todo("AIR-P-03 — la note affichée suit la hauteur de la main — dépend du lot A3 (music)");
- `packages/audio/src/graph/live.test.ts:114` — it.todo("AIR-P-16 — pas de marches pendant un glissé lent — dépend du graphe Web Audio (navigateur)");
- `packages/audio/src/graph/live.test.ts:115` — it.todo("le graphe voix → réverbération → gain → limiteur → plafond — dépend d'un AudioContext");
- `packages/audio/src/graph/live.test.ts:116` — it.todo("l'ordre interactif est demandé à l'ouverture du contexte — dépend d'un AudioContext");
- `packages/audio/src/graph/live.test.ts:117` — it.todo("les notes sonnent à l'instant programmé — dépend d'un AudioContext et d'une horloge");
- `packages/audio/src/graph/live.test.ts:118` — it.todo("la sortie sans fil est signalée au-delà de 100 ms — dépend d'un outputLatency réel");
- `packages/audio/src/graph/nodes.ts:302` — * encore un `todo(...)` dans cet arbre, et un son sans réverbération vaut mieux
- `packages/audio/src/graph/params.test.ts:111` — it.todo("`dbToGain` et `midiToFreq` viennent de `core/music.ts` — dépend du lot A3");
- `packages/audio/src/worklets/pluck-core.test.ts:164` — it.todo("`addModule()` installe le processeur — dépend d'un AudioContext (navigateur)");
- `packages/audio/src/worklets/pluck-core.test.ts:165` — it.todo("`process()` rend des blocs de 128 échantillons — dépend d'un AudioContext (navigateur)");
- `packages/core/src/internal.ts:6` — export function todo(module: string, lot: string): never {
- `packages/core/src/music.ts:209` — if (!Number.isFinite(midi)) return todo("music.noteName", "A3");
- `packages/vision/src/camera-source.test.ts:172` — it.todo(
- `packages/vision/src/camera-source.test.ts:465` — it.todo(
- `packages/vision/src/recorder.test.ts:158` — it.todo(
- `packages/vision/src/replay.test.ts:186` — it.todo(
- `packages/vision/src/sides.test.ts:93` — it.todo(
- `packages/vision/src/worker/host.test.ts:283` — it.todo("AIR-F-07 — le worker réel charge MediaPipe et renvoie les mains hors du fil principal", () => undefined);

## (c) Fichiers exportés mais jamais importés

- `apps/bench/src/make-reference-takes.ts` — exporté, jamais importé ailleurs
- `apps/bench/src/preuves/compensation.ts` — exporté, jamais importé ailleurs
- `apps/bench/src/preuves/make-guard-log.ts` — exporté, jamais importé ailleurs
- `apps/bench/src/preuves/two-clocks.ts` — exporté, jamais importé ailleurs
- `apps/mcp/src/server.ts` — exporté, jamais importé ailleurs

## (d) Dépendances déclarées et jamais utilisées

- (rien à signaler)

## (d) Imports de paquets non déclarés

- `playwright` — importé par 1 fichier(s), déclaré dans aucun manifeste

## (e) Documents cités par aucun autre document

- `.kiro/agents/wording-reviewer.md` — cité par aucun autre document
- `docs/budget-ci.md` — cité par aucun autre document
- `docs/compensation.md` — cité par aucun autre document
- `docs/contract-api.md` — cité par aucun autre document
- `docs/features.md` — cité par aucun autre document
- `docs/filter-tuning.md` — cité par aucun autre document
- `docs/fuzz.md` — cité par aucun autre document
- `docs/horodatage.md` — cité par aucun autre document
- `docs/integration-t4.md` — cité par aucun autre document
- `docs/integration-t7.md` — cité par aucun autre document
- `docs/inventaire.md` — cité par aucun autre document
- `docs/kiosque-installation.md` — cité par aucun autre document
- `docs/methode-agents.md` — cité par aucun autre document
- `docs/mobilite.md` — cité par aucun autre document
- `docs/partage-prise.md` — cité par aucun autre document
- `docs/piece.md` — cité par aucun autre document
- `docs/poids-publication.md` — cité par aucun autre document
- `docs/postmortem.md` — cité par aucun autre document
- `docs/preuves.md` — cité par aucun autre document
- `docs/rapport-defaut.md` — cité par aucun autre document
- `docs/recap-modele.md` — cité par aucun autre document
- `docs/ui-lecons.md` — cité par aucun autre document

## (f) `TODO`, `FIXME` et `HACK`

- `apps/bench/src/errors.ts:39` — `TODO` — return error instanceof Error && /^TODO\(/.test(error.message);
- `apps/bench/src/events.test.ts:58` — `TODO` — throw new Error("TODO(music.noteName) — lot A3");
- `packages/audio/src/graph/nodes.ts:305` — `TODO` — * TODO(raccordement lot A5) : remplacer ce try/catch par un appel direct une
- `packages/audio/src/worklets/pluck-core.ts:9` — `TODO` — * TODO(raccordement lot A5) : `dsp/engines.ts` expose `pluckDelayLength`,
- `packages/core/src/internal.ts:7` — `TODO` — throw new Error(`TODO(${module}) — à implémenter dans le lot ${lot}`);
- `scripts/hooks/lib/lancer.mjs:36` — `TODO` — * Le squelette du dépôt lève `TODO(module)` tant que le corps manque
- `scripts/hooks/lib/lancer.mjs:40` — `TODO` — return resultat.erreur.includes("TODO(") || resultat.sortie.includes("TODO(");
- `scripts/hooks/render-check.mjs:9` — `TODO` — * B3. Tant qu'ils manquent — ou tant que le squelette lève `TODO(module)` —

## (g) Fichiers dupliqués ou quasi dupliqués

- groupe `quasi` (2 fichiers) : `scripts/fuzz.mjs`, `scripts/perf-budget.mjs`

## (h) État de la forge

- Section omise : désactivé (--sans-github)

## Points durs

- Le découpage des fonctions est une heuristique de lecture des accolades : un signalement est une piste, pas une preuve.
- Les documents orphelins sont comptés parmi 127 documents du dépôt ; un document peut être lu sans être cité.
- Un fichier exporté jamais importé peut être lu par une garde, un script ou un document.
- Une dépendance déclarée jamais importée peut être lancée en ligne de commande ou servir à l'outillage.
<!-- audit:fin -->
