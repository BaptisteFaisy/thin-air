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
