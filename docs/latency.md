# Retard — ce qui est mesuré, ce qui est estimé

Règle du projet (cahier §5, AIR-F-31, AIR-N-05, AIR-N-12) : le retard est dit,
jamais caché ; chaque valeur porte la mention **mesuré** ou **estimé** ; les
mots « temps réel » et « instantané » sont interdits (§5.4, contrôle
automatique par `scripts/hooks/wording-guard.mjs`).

Les ordres de grandeur ci-dessous viennent du cahier §5.1 et sont à remplacer
par les mesures relevées sur nos machines (lot A1, recette §18 : au moins deux
machines).

| Étape | Valeur | Statut | Comment mesurer |
|---|---|---|---|
| Caméra (exposition, capteur, compression, transport) | 30 à 70 ms | **estimé** | Non mesurable dans le navigateur |
| Attente de l'image suivante | 0 à 33 ms (17 en moyenne à 30 im/s) | **mesuré** | Intervalle entre horodatages d'images |
| Analyse des mains | 5 à 25 ms | **mesuré** | Autour de `detectForVideo` |
| Filtrage, gestes, correspondance | 1 à 5 ms | **mesuré** | Autour de `TakeProcessor.push` |
| Sortie audio — `baseLatency` | 10 à 45 ms en filaire | **mesuré** (si déclaré) | `AudioContext.baseLatency` |
| Sortie audio — `outputLatency` | idem | **mesuré** si présent, sinon **mesure partielle** | `AudioContext.outputLatency` |
| Casque sans fil | +150 à 250 ms | **estimé** | Signalé au-delà de `wirelessWarnMs` (100 ms) |
| **Total mesurable** | cible < 60 ms en filaire | **mesuré** | Somme des lignes mesurées |
| **Total estimé** | ≈ 105 ms | **estimé** | Mesurable + `cameraLatencyMs` (50 par défaut) |

## Relevés

Relevé du 11 novembre 2026 avec `node scripts/preuves/latence.mjs` (Chromium en
headless, `--mute-audio`, caméra simulée ; aucun son, aucune requête vers
l'extérieur). Le fichier brut est `out/latency-pc-baptiste-ms-7d18.json`, hors
versionnage comme tout `out/`.

| Machine | Navigateur | Sortie | Images/s | Analyse | Traitement | `baseLatency` | `outputLatency` | Total mesuré | Total estimé |
|---|---|---|---|---|---|---|---|---|---|
| `pc` — baptiste-MS-7D18 | Chromium 1254, headless, sans son | simulée, 48 000 Hz | 20 im/s → **50,0 ms** (mesuré) | **non mesurée**, modèle absent → reste **estimée** | **0,000 ms** médiane, 0,12 à 0,77 ms moyenne (mesuré) | **10,7 ms** (mesuré) | **0,0 ms** (mesuré, sortie simulée) | **60,7 ms** (mesuré, partiel) | **110,7 ms** (estimé) |
| `r630` — R630 (à faire) | | | | | | | | | |

La seconde machine se mesure avec le même outil, sans rien réécrire :

```
node scripts/preuves/latence.mjs --machine "r630 — R630"
```

(`--rebuild` si le site n'est pas encore construit sur cette machine, `--port`
si le 4178 est occupé.)

### Ce que ces relevés contredisent, et ce qui manque

Écrit noir sur blanc, comme le demande la recette §18 :

- **Le total mesurable dépasse la cible des 60 ms (AIR-N-05) : 60,7 ms.** Le
  dépassement (0,7 ms) vient entièrement de la caméra simulée : Chromium rend
  20 images par seconde alors que 30 étaient demandées (la contrainte
  `frameRate: {exact: 30}` est refusée, le repli `{ideal: 30}` rend 20), soit
  50 ms d'attente d'image au lieu des 33 ms d'une webcam à 30 im/s. Avec 33,3 ms
  d'attente, la même chaîne donnerait **44,0 ms mesurables** (recalculé à partir
  des mêmes relevés, donc **estimé**) : la cible tient, mais elle dépend du débit
  d'images de la caméra, pas du code.
- **Le traitement est bien plus rapide que l'ordre de grandeur annoncé** (1 à
  5 ms dans le cahier) : médiane 0,000 ms sur 300 images poussées dans
  `TakeProcessor.push`, moyenne 0,12 à 0,77 ms selon la charge de la machine au
  moment du relevé. Le maximum relevé (11 à 112 ms suivant les passes) est le
  premier appel, qui paie l'échauffement du moteur JavaScript ; il ne décrit pas
  une image en régime établi. L'ordre de grandeur du cahier est donc large, dans
  le bon sens.
- **L'analyse des mains n'est pas mesurée sur cette machine.** Le modèle
  `public/models/hand_landmarker.task` n'est pas versionné, et son téléchargement
  (`npm run fetch-model`) est une requête vers l'extérieur — interdite par la
  consigne du lot (« tout en local »). L'outil le dit au lieu de deviner : il
  pose `inferenceUnknown`, donc `partial = true` dans le rapport, c'est-à-dire la
  « mesure partielle » du §5.2. L'ordre de grandeur du cahier (5 à 25 ms) reste
  **estimé** ici. Pour le mesurer : `npm run fetch-model` sur une machine
  autorisée à télécharger, puis relancer la même commande — l'outil charge alors
  le détecteur et mesure `detectForVideo` image par image.
- **`outputLatency` est déclaré, mais à 0 ms.** En headless avec `--mute-audio`
  il n'y a pas de sortie réelle : 0 ms est ce que le navigateur déclare pour une
  sortie simulée, ce n'est le retard d'aucun casque. `baseLatency` (10,7 ms)
  tombe dans l'ordre de grandeur du cahier (10 à 45 ms en filaire). Sur une
  machine branchée sur une vraie sortie, ces deux nombres sont à relever de
  nouveau : c'est le seul moyen de détecter un casque sans fil (AIR-F-32).
- **La caméra reste estimée à 50 ms**, comme le dit le cahier : exposition,
  compression et transport ne se mesurent pas dans un navigateur. Le total
  estimé (110,7 ms) reste cohérent avec l'ordre de grandeur du cahier
  (≈ 105 ms), à 5,7 ms près.

Ce qui n'a donc pas pu être mesuré, et pourquoi : **l'analyse des mains**
(modèle absent, téléchargement interdit par la consigne) et **la caméra réelle**
(son capteur n'est pas exposé au navigateur). Tout le reste est mesuré dans la
page réellement servie par le site, et les totaux sont calculés par
`packages/audio/src/graph/latency.ts` — pas par l'outil, qui ne fait que les
lire.

## Poids du premier chargement

Relevé du 11 novembre 2026, `npm run fetch-model` sur ce dépôt (fichiers servis
par le site lui-même, jamais par un tiers — AIR-N-01).

| Fichier | Poids | Statut |
|---|---|---|
| `public/models/hand_landmarker.task` | 7 819 105 octets (7,82 Mo) | **mesuré** |
| `public/models/wasm/vision_wasm_internal.wasm` | 14 604 817 octets (13,93 Mo) | **mesuré** |
| `public/models/wasm/vision_wasm_internal.js` | 0,32 Mo | **mesuré** |
| `public/models/wasm/vision_wasm_module_internal.*` | 14,25 Mo | **mesuré**, variante chargée selon le délégué (GPU ou processeur) |
| **Total du premier chargement** | **≈ 22 Mo** (modèle + une variante d'exécution) | **mesuré** |

**Conséquence, écrite noir sur blanc** : l'indicateur du cahier §4 (« moins de
30 secondes du premier clic à la première note ») tient sur une connexion à
10 Mbit/s et au-delà, et ne tient pas sur une connexion plus lente. C'est
exactement ce que le parcours « Play without a camera » couvre : le jeu au
pointeur et au clavier est disponible PENDANT le téléchargement, avec le même
moteur (AIR-F-02), et la progression du modèle est affichée (§12.2). Après la
première visite, le cache long rend le démarrage immédiat (AIR-F-54).

Le modèle et ses fichiers d'exécution ne sont pas versionnés (`.gitignore`) :
`scripts/fetch-model.mjs` les télécharge et copie la variante d'exécution depuis
le paquet installé — la même version que celle utilisée par les tests.

Pour se représenter 100 ms : le son parcourt 34 mètres dans ce temps
(cahier §5.1).
