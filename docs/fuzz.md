# Fuzz nocturne et budget de performance

Deux gardes de nuit qui tournent sans intervention : un **fuzz long** qui cherche
des contre-exemples sur la chaîne complète, et un **budget de performance** qui
rougit si le moteur ralentit. Elles ne sont déclenchées que la nuit (cron) ou à
la main, jamais sur les PR — le budget CI de 5 min des PR est réservé aux
preuves courtes (`ci.yml`).

Aucune oreille, aucun écran, aucun navigateur : tout passe par `processTake`
(`@thin-air/core`) puis `renderEvents` (`@thin-air/audio`), qui produisent des
événements puis un tableau d'échantillons en mémoire (AIR-N-02).

## Ce que le fuzz cherche

Pour chaque prise aléatoire, le fuzz vérifie les invariants qui doivent tenir
**partout** :

| Invariant | Vérification |
|---|---|
| AIR-P-09 — aucune voix active à la fin | aucune voix n'a de `noteOn` sans `noteOff` final |
| AIR-P-10 — voix ≤ `maxVoices` | crête des voix actives ≤ `min(maxVoices, instrument.voices)` |
| AIR-P-11 — instants non décroissants | `t` des événements ne recule jamais |
| aucune valeur non numérique | aucun `NaN`/`Infinity` dans `t`, `midi`, `velocity`, `value`, ni dans les échantillons |
| AIR-P-13 — crête ≤ −1 dB | maximum absolu des échantillons ≤ plafond −1 dB |

Les prises sont composées avec les générateurs de synthèse de `takeGen.ts`
(`linearTake`, `tremorTake`, `sweepTake`, `crossingHandsTake`, `handLeavesTake`,
`fastJabTake`, `leftHandOnlyTake`), passées dans les cas limites (`withDroppedFrames`,
`withHand`), sur les six instruments du dépôt et des réglages variés (aimant,
une main, tenue, gaucher, délai de grâce). Le seul générateur aléatoire est
`alea(graine)` (mulberry32) : les mêmes arguments redonnent les mêmes nombres
(AIR-N-09), jamais `Math.random()`.

À la première violation, la prise fautive est écrite dans
`out/fuzz/contre-exemple-<graine>.json` (dossier ignoré) avec la graine,
l'invariant violé, le détail, l'instrument, les réglages et la prise complète ;
le script sort non nul.

## Ce que le fuzz a trouvé

Lancé pour de vrai sur 5 000 prises (graine 42) :

```
✓ 5000 prises, 0 violation — 97.4 s (3343 prises sans événement)
```

Aucun contre-exemple : les cinq invariants tiennent sur les 5 000 prises. Le
chiffre « 3343 prises sans événement » est attendu : une prise tient parfois trop
peu ou trop loin des seuils de gestes pour produire une note — elle exerce quand
même la chaîne `processTake` (rôles, filtres, gestes), et le rendu n'est vérifié
que sur les prises qui produisent au moins un événement.

Le fuzz nocturne en CI fait 6 000 prises (au-dessus du minimum de 5 000) : mesuré
à ~106 s sur le worker de référence, soit un bon tiers du timeout de 5 min, ce
qui laisse de la marge si le runner est chargé.

## Reproduire un contre-exemple

La prise `i` d'une campagne a la graine `graine = seed + i`. Pour rejouer une
prise fautive, on relance avec sa graine et une seule prise :

```bash
node scripts/fuzz.mjs --seed <graine> --runs 1      # exit non nul attendu
```

Le détail est dans `out/fuzz/contre-exemple-<graine>.json` : on y retrouve la
graine exacte, l'invariant violé, le détail, l'instrument, les réglages et la
prise (les 21 points et les horodatages de chaque image).

## Le budget de performance

`scripts/perf-budget.mjs` mesure le temps de la chaîne sur une prise de
référence — 3 s à 30 im/s (91 images) sur l'instrument `phantom`, rendue à
48 kHz — et le compare au budget versionné dans `perf-budget.json`.

**Métrique.** Après une chauffe, chaque étage est répété (50 fois pour
`processTake`, 100 fois pour `renderEvents`) et on retient le **minimum**. Le
minimum est la vitesse réelle du moteur : sur un runner auto-hébergé partagé, la
médiane serait faussée par les pauses d'ordonnancement des autres processus, pas
par une régression du code. Le minimum, lui, capture le meilleur créneau et reste
stable d'une exécution à l'autre.

Comment il est fixé : on mesure le minimum, puis le budget vaut
**minimum × 1,25, arrondi au supérieur** :

```
node scripts/perf-budget.mjs --etalonner   # mesure puis écrit perf-budget.json
```

Valeurs étalonnées sur le worker de référence (novembre 2026) :

| Étage | Minimum mesuré | Budget (× 1,25, arrondi au supérieur) |
|---|---|---|
| `processTake` | 0,70 ms | 2 ms |
| `renderEvents` | 37,6 ms | 48 ms |

Le budget est un **plafond**, pas une cible : à vide, le moteur descend plus bas
(`renderEvents` ~25 ms), mais le plafond reste le même. Les mesures brutes (toutes
les répétitions) sont écrites dans `out/perf/mesures.json` (dossier ignoré) ; le
fichier `perf-budget.json`, lui, est versionné. Si un minimum dépasse son budget,
le script sort non nul : le job `perf` de la garde nocturne passe en rouge et
publie les mesures brutes en artefact.

Comment il est révisé : quand le code du moteur change légitimement (nouvel
instrument plus coûteux, rendu plus riche), on relance `--etalonner` sur la
machine cible **au repos** (pas de fuzz ni d'autre job en cours), et on
reversionne le fichier. Une hausse du minimum qui reste sous le plafond est un
bruit de machine ; une hausse qui le dépasse est une régression à instruire.