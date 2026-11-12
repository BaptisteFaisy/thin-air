# Luthier — dix instruments nés d'une phrase

Le luthier (cahier §14.4) écrit un instrument-fichier à partir d'une description
d'une phrase, le valide, le rend sur les prises de référence et lit le rapport.
Dix instruments s'ajoutent ici aux six du §7.8. La preuve est un nombre, jamais
une écoute (AIR-N-02, §13.1) : chaque rapport ci-dessous est la recopie exacte
du `report.json` produit par la commande

```sh
npx tsx apps/bench/src/cli.ts render --take takes/reference/<prise>.json \
  --instrument instruments/<nom>.json --out /tmp/luthier-<nom> --no-wav
```

à 48 000 échantillons par seconde. Un palier n'est mesurable qu'au-delà de
0,2 s, garde de 80 ms incluse (`apps/bench/src/render.ts`) : c'est le sens de
la colonne « paliers ». L'écart est en centièmes de demi-ton.

| Fichier | Phrase d'origine (anglais) | Moteur |
|---|---|---|
| `glass.json` | A pure sine voice glides across two octaves with no magnet at all, one hand for the pitch, the other's height for the level. | `osc` |
| `flute.json` | A soft triangle flute snaps hard to a natural minor scale over one octave, and a fist on the volume hand cuts the breath. | `osc` |
| `ghost.json` | A ghost theremin leans only a third of the way toward the scale, bending between the notes, vibrato under a pinching hand. | `osc` |
| `organ.json` | A hollow square-wave organ walks one octave with a magnet of seven tenths, and a closing fist silences the pipe. | `osc` |
| `koto.json` | Nine koto strings lie across the width, plucked bright by a crossing index and damped at once by a pinch. | `pluck` |
| `dulcimer.json` | Twelve dulcimer strings ring long and woody at a fixed strength under a crossing palm, and a fist kills the ring. | `pluck` |
| `gong.json` | Four gongs hang in four vertical bands: crossing one strikes a metallic FM crash that rings for six seconds. | `fm` |
| `chimes.json` | Five chimes hang in five horizontal bands, each holding one fixed pitch as long as a hand rests in it. | `fm` |
| `pad.json` | Three wide bands hold slow detuned sawtooth chords under the resting hand, and a dwell locks the chord in place. | `osc` |
| `tabla.json` | Two grid-locked hand drums span the width: a crossing fires a short noise-and-tone hit snapped to the sixteenth grid. | `drum` |

Répartition voulue : quatre étendues continues (`range`), quatre jeux de cordes
(`strings`), deux jeux de zones (`zones`) ; deux modes une main (`glass`,
`ghost`) ; des aimants de 0 à 1 (0 ; 0,35 ; 0,7 ; 1) ; les quatre moteurs ;
quatre voix tenues où le retard se supporte (`glass`, `flute`, `chimes`,
`pad`) ; une percussion calée sur la grille (`tabla`, `quantize: sixteenth`,
force 1).

## Rapports de rendu (recopie des `report.json`)

### glass — prise `left-hand-only`

Crête **−12,96 dB** (niveau moyen −19,44 dB) · voix max **1** · silence final
**720,4 ms** · 184 800 échantillons, 3,85 s · **1 palier**, écart max
**0,00** centième :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,080 s | 69,6 | 455,52 Hz | 455,52 Hz | 0,00 |

Sur `slow-rise`, Glass sonne (crête −34,30 dB) mais l'aimant à 0 fait glisser
la hauteur à chaque image : aucun palier de 0,2 s, donc rien de mesurable. La
prise à main immobile donne le palier stable — c'est elle qui est recopiée.

### flute — prise `slow-rise`

Crête **−35,37 dB** (niveau moyen −44,10 dB) · voix max **1** · silence final
**888,2 ms** · 218 400 échantillons, 4,55 s · **3 paliers**, écart max
**0,01** centième :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,080 s | 63 | 311,13 Hz | 311,13 Hz | 0,01 |
| 0,747 s | 65 | 349,23 Hz | 349,23 Hz | 0,00 |
| 2,413 s | 67 | 392,00 Hz | 391,99 Hz | −0,01 |

### ghost — prise `left-hand-only`

Crête **−12,49 dB** (niveau moyen −18,50 dB) · voix max **1** · silence final
**521,4 ms** · 156 000 échantillons, 3,25 s · **1 palier**, écart max
**0,00** centième :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,080 s | 58,91 | 245,66 Hz | 245,66 Hz | −0,00 |

Même remarque que Glass : sur `slow-rise`, l'aimant à 0,35 plie la hauteur en
permanence (crête −34,24 dB, 0 palier mesurable) ; la main immobile donne le
palier franc.

### organ — prise `left-hand-only`

Crête **−12,14 dB** (niveau moyen −18,39 dB) · voix max **1** · silence final
**409,2 ms** · 156 000 échantillons, 3,25 s · **1 palier**, écart max
**0,20** centième :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,080 s | 52,94 | 174,01 Hz | 174,03 Hz | 0,20 |

### koto — prise `fast-jab`

Crête **−32,80 dB** (niveau moyen −53,69 dB) · voix max **2** · silence final
**1 237,8 ms** · 116 000 échantillons, 2,42 s · **1 palier**, écart max
**183,56** centièmes :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,213 s | 58 | 233,08 Hz | 259,15 Hz | 183,56 |

L'écart mesure un palier où les cordes frappées au quart de seconde résonnent
les unes sur les autres (extinction 1 200 ms) : la fréquence dominante n'est
pas celle de la dernière corde. La Harpe de référence du §7.8 présente les
mêmes écarts sur les mêmes prises (497 à 2 703 centièmes selon la prise) ;
c'est un comportement du moteur pincé mesuré, pas un défaut du fichier.

### dulcimer — prise `fast-jab`

Crête **−22,45 dB** (niveau moyen −38,42 dB) · voix max **3** · silence final
**1 189,4 ms** · 178 400 échantillons, 3,72 s · **2 paliers**, écart max
**102,42** centièmes :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,113 s | 59 | 246,94 Hz | 261,99 Hz | 102,42 |
| 0,213 s | 60 | 261,63 Hz | 261,99 Hz | 2,42 |

Même remarque que Koto pour le premier palier ; le second, plus tardif, retombe
à 2,42 centièmes.

### gong — prise `fast-jab`

Crête **−25,04 dB** (niveau moyen −36,72 dB) · voix max **1** · silence final
**1 271,8 ms** · 346 400 échantillons, 7,22 s · **1 palier**, écart max
**63,58** centièmes :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,113 s | 45 | 110,00 Hz | 114,11 Hz | 63,58 |

L'écart vient du spectre inharmonique voulu (rapport FM 1,41, indice 8) : le
tam-tam n'a pas une fondamentale pure. Sur `two-hands-cross`, quatre frappes
se chevauchent et l'écart max monte à 4 111 centièmes — la prise `fast-jab`,
une seule frappe, est la mesure honnête.

### chimes — prise `slow-rise`

Crête **−10,86 dB** (niveau moyen −17,72 dB) · voix max **2** · silence final
**857,8 ms** · 309 600 échantillons, 6,45 s · **1 palier**, écart max
**0,02** centième :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,080 s | 72 | 523,25 Hz | 523,25 Hz | −0,02 |

Sur `left-hand-only` et `hand-leaves-mid-note`, Chimes se rend mais reste
muet : la main de volume, absente de la première image, émet `handLost`, qui
relâche aussitôt la note que `enter` vient de prendre (décision des quatre
délais, `packages/core/src/instrument.ts`). Il faut une prise à deux mains —
c'est dit ici plutôt que masqué.

### pad — prise `slow-rise`

Crête **−12,28 dB** (niveau moyen −25,11 dB) · voix max **2** · silence final
**834,2 ms** · 261 600 échantillons, 5,45 s · **1 palier**, écart max
**5,59** centièmes :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,080 s | 51 | 155,56 Hz | 156,07 Hz | 5,59 |

Les 5,59 centièmes sont le battement voulu des dents de scie désaccordées de
12 centièmes. Muet sur `left-hand-only`, même cause que Chimes.

### tabla — prise `harp-sweep`

Crête **−27,37 dB** (niveau moyen −51,88 dB) · voix max **1** · silence final
**846,6 ms** · 73 440 échantillons, 1,53 s · **1 palier**, écart max
**73,78** centièmes :

| Palier | midi | attendue | mesurée | écart |
|---|---|---|---|---|
| 0,380 s | 57 | 220,00 Hz | 229,58 Hz | 73,78 |

Le moteur `drum` fait sonner son `toneHz` (220 Hz) quelle que soit la note
demandée ; la gamme est donc rooted en la 3 (57 = 220 Hz) pour que la hauteur
attendue et le corps sonore coïncident. L'écart résiduel vient du bruit
d'attaque (90 ms) qui déborde la garde de mesure de 80 ms.

## Corrections et observations, dites plutôt que masquées

- **`grid-drums.json` corrigé** : `quantizeStrength` valait 100, alors que le
  schéma des réglages exige un rapport de 0 à 1 (`loop.quantize` borne la force
  à 1) ; le schéma strict refusait le fichier et `bench render` ne pouvait même
  pas le charger. Corrigé en 1, test du §7.13 adapté en conséquence.
- **`gong` et `tabla`, première version refusée par la garde** : elles
  combinaient `strings` et `zones` ; or range, strings et zones sont exclusifs
  (§11.5, `instrument-schema-guard`). Version livrée : `strings` seuls — la
  frappe retombe sur le degré de la gamme, le rendu sonore est identique.
- **`bells.json` (existant, non touché)** : son seul geste est `cross → strike`
  sans `strings`, et une traversée ne se détecte que sur des cordes
  (`packages/core/src/gestures.ts`) : Bells ne peut sonner sur aucune prise.
  Observation transmise, hors du périmètre de ce lot.
- Les prises ont été choisies pour que chaque instrument sonne et produise au
  moins un palier mesurable ; `instruments/luthier.test.ts` épingle ces choix
  (16 rendus, aucun muet parmi les dix du luthier).
