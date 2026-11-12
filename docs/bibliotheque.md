# Le moteur publiable seul — frontières, contrat, garanties

`@thin-air/core`, `@thin-air/audio` et `@thin-air/schema` forment le moteur de
Thin Air tel qu'un tiers peut l'utiliser **dans un projet Node/TypeScript
ordinaire** : produire une liste d'événements en `Float32Array`, écrire un WAV,
mesurer justesse, crête et silence — sans navigateur, sans haut-parleur, sans
jamais émettre un son (AIR-N-02).

## La frontière entre les trois paquets

```
              ┌───────────────────────────────────────────┐
              │              @thin-air/core               │
              │ musique, MusicEvent, mesure d'échantillons │
              └──────────────┬───────────────┬────────────┘
        (type import)        │               │ (runtime import)
              ┌──────────────▼───┐      ┌────▼──────────────────────┐
              │ @thin-air/schema │      │       @thin-air/audio     │
              │  validation zod  │      │  dsp/offline (pur Node)   │
              │   refus entier   │      │  graph/worklets (WebAudio)│
              └──────────────────┘      └───────────────────────────┘
```

- **`core`** est le tronc commun, zéro dépendance : gammes, conversion
  position → hauteur/gain, `MusicEvent`, et la famille de mesures
  (`measureNotes`, `peakDb`, `rmsDb`, `finalSilenceMs`, `buildReport`).
- **`audio`** synthétise les événements de `core` en `Float32Array` et les
  encode en WAV. Sa face hors ligne n'importe que `core` et n'a **aucune
  dépendance au DOM** ; sa face directe (`graph/`, `worklets/`) est le même
  calcul branché sur Web Audio, et reste hors du périmètre « sans navigateur ».
- **`schema`** valide les fichiers (instrument, prise) sur `zod`, en les
  refusant **en entier** avec une raison — jamais de réparation silencieuse.
  Ses schémas importent les types de `core` par `import type` uniquement.

## Le contrat `MusicEvent` — la couture des deux horloges

`MusicEvent` (dans `packages/core/src/types.ts`) est l'unique objet qui traverse
la frontière entre la logique de geste et le moteur sonore. Trois variantes,
toutes horodatées par `t` **en secondes** : `noteOn` (`voice`, `midi`,
`velocity`), `noteOff` (`voice`) et `control` (`param`, `value`). Le commentaire
du type est la couture matérialisée (§11.3) : en jeu direct, `t` est l'instant
présent plus l'avance ; en rendu hors ligne, c'est l'instant de la prise. C'est
pourquoi `@thin-air/audio` n'a pas besoin de lire d'horloge : il reçoit des
instants, il ne les fabrique pas.

## Les garanties

- **Déterminisme au bit près** (AIR-N-09, AIR-P-12) : pas de `Math.random()`
  sans graine, pas de `Date.now()` dans `core`, pas d'itération d'objet non
  triée. Le même événement rendu deux fois produit les mêmes échantillons.
- **Aucune dépendance au DOM** sur la face hors ligne : `import` de
  `@thin-air/audio` s'exécute dans un Node nu (preuve : les exemples des README
  de paquets et l'environnement `node` de la CI, aucun polyfill).
- **Aucun son émis** (AIR-N-02), **aucune requête réseau** (AIR-N-01) : les
  preuves sont des tableaux, des fichiers et des nombres.
- **Une seule implémentation par logique** : `measure.ts`, `tuning.ts`, etc.,
  vivent une fois ; le banc (`apps/bench`) et la CI les réutilisent au lieu de
  les réécrire.

## Les limites assumées

Deux décisions de conception ont déjà été prises et consignées dans
`docs/journal.md` (entrées du 2026-11-11) — on les cite, sans les recopier :

1. **Le rendu hors ligne tourne dans Node**, et non dans un navigateur sans
   écran comme l'envisageait le §13.1. La preuve est plus stricte : aucun
   périphérique audio ne peut être ouvert, et le rendu est reproductible au bit
   près en CI. (Recette §18, « Écarts au cahier, assumés et écrits », point 1.)
2. **La réverbération est un réseau de retards à réinjection**, et non une
   convolution (§7.9) : le même calcul doit servir hors ligne et en direct.
   L'exigence AIR-F-30 (réverbération calculée, réglable, désactivable) est
   tenue. (Recette §18, « Écarts… », point 2.)

## Ce qu'il reste à faire pour publier sur un registre

Décrit ici, non fait : `scripts/pack-check.mjs` vérifie la cohérence, et la
marche à suivre exacte (ordre, vérifications, `npm pack --dry-run`) est dans
`docs/publication.md`. Les trois paquets sont **source-only** : `exports` cible
`./src/index.ts` et `files` ne livre que `src/`, choix justifié dans
`docs/publication.md`. Reste à combler avant `npm publish` :

- **Retirer `"private": true`** des trois `package.json` de paquets — c'est le
  verrou qui empêche aujourd'hui toute publication accidentelle.
- **Décider le nom scopé ou non, et le registre** (npmjs.org, GitHub Packages,
  registre privé) : rien n'est configuré dans le dépôt.
- **Déclarer et figer les dépendances entre paquets** : `@thin-air/schema`
  importe `@thin-air/core` sans le déclarer, et `@thin-air/audio` le déclare en
  `"*"`. Les deux veulent `"@thin-air/core": "^0.1.0"` (versions synchronisées).
- **Éventuellement compiler vers `dist/`** si un consommateur JavaScript nu
  doit pouvoir importer le paquet : `tsconfig` par paquet, script `build`,
  `"files": ["dist"]` et `exports` en `{ "types": …, "default": … }`.

Déjà faits : `version` 0.1.0 sur les trois paquets, `license: "MIT"`,
`repository`, `description`, `keywords`, `files`, `sideEffects: false`.

La garde `node scripts/pack-check.mjs` échoue (code non nul) dès qu'un paquet
est privé de `license`, de `files` ou d'un `exports` dont une cible ne pointe
vers aucun fichier existant ; elle refuse toute importation d'un paquet non
déclaré et tout fichier sonore. Le banc `instruments/publication.test.ts`
revérifie les trois manifests dans `npx vitest run`.