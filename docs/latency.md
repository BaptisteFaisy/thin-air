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

| Machine | Navigateur | Sortie | Images/s | Analyse | Traitement | `baseLatency` | `outputLatency` | Total mesuré | Total estimé |
|---|---|---|---|---|---|---|---|---|---|
| _(à remplir — lot A1)_ | | | | | | | | | |

## Poids du premier chargement

| Fichier | Poids | Statut |
|---|---|---|
| `public/models/hand_landmarker.task` | _à mesurer après `npm run fetch-model`_ | **mesuré** |
| Fichiers d'exécution du modèle (wasm) | _à mesurer_ | **mesuré** |

Pour se représenter 100 ms : le son parcourt 34 mètres dans ce temps
(cahier §5.1).
