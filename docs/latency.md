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
par le site lui-même, jamais par un tiers — AIR-N-01), après l'allègement du
lot N3 : les deux variantes de wasm fournies par le paquet ne sont plus toutes
copiées, seule celle que le site charge l'est.

| Fichier | Poids | Statut |
|---|---|---|
| `public/models/hand_landmarker.task` | 7 819 105 octets (7,82 Mo) | **mesuré** |
| `public/models/wasm/vision_wasm_internal.js` | 334 128 octets (0,33 Mo) | **mesuré** |
| `public/models/wasm/vision_wasm_internal.wasm` | 14 603 354 octets (13,93 Mo) | **mesuré** |
| **Total publié (modèle + exécution)** | **22 756 587 octets (22,76 Mo)** | **mesuré** |

Avant l'allègement, `fetch-model` copiait aussi `vision_wasm_module_internal.*`
(14,25 Mo) : le site exposait 37,69 Mo pour une seule variante utile.

### Quelle variante est chargée, et pourquoi une seule suffit

Le paquet fournit deux variantes de wasm et choisit par un booléen : dans le
bundle (grep ciblé de `vision_bundle.mjs`), la fonction qui construit le
fileset écrit `wasm${useWasmModule ? "_module" : ""}_internal`, et
`FilesetResolver.forVisionTasks(chemin, useWasmModule = false)`.
`packages/vision/src/landmarker.ts` appelle `forVisionTasks(wasmRoot)` sans le
second argument → `false` → la variante **NON-module**
`vision_wasm_internal.{js,wasm}`. Le délégué (GPU ou processeur, AIR-N-07)
n'entre pas en jeu à ce stade : il est choisi plus tard, dans
`createFromOptions`, et les deux délégués partagent le même fileset — donc la
même variante. Publier l'autre variante n'ajoute que du poids mort.

Preuve empirique (journal des requêtes, `scripts/preuves/chargement.mjs`,
Chromium headless, fausse caméra, clic « Start ») : les seules requêtes vers
`models/wasm/` sont `vision_wasm_internal.js` et `vision_wasm_internal.wasm`.
`vision_wasm_module_internal.*` n'est **jamais** demandé, quelle que soit la
séquence de chargement. Ne garder que la variante non-module ne casse donc pas
le repli processeur (AIR-N-07) : GPU et processeur chargent la même variante.

Conséquence : `scripts/fetch-model.mjs` ne copie que la variante utile par
défaut, avec une option explicite `--all` pour garder les deux (et un
commentaire qui explique pourquoi — la variante module ne servirait que si un
appel futur passait `useWasmModule: true`).

### Mesure sous connexion bridée (11 novembre 2026, cette machine)

Méthode : le site construit et les modèles sont servis par un serveur local
(127.0.0.1:4180) ; Chromium headless lancé muet (`--mute-audio`), fausse
caméra (la même vidéo y4m que les specs de bout en bout), clic « Start » ;
débit bridé via CDP `Network.emulateNetworkConditions` (latence non émulée) ;
octets = `encodedDataLength` CDP (ce qui passe réellement sur le réseau) ;
fenêtre = première requête `models/` → fin du dernier téléchargement
modèle + wasm. Rejouable : `node scripts/preuves/chargement.mjs [débits…]`
(écrit `out/chargement-<débit>.json`).

| Débit | Octets réellement transférés | Temps modèle + wasm | Verdict §4 (30 s) |
|---|---|---|---|
| 10 Mbit/s | 45 180 002 o | 38,8 s | **ne tient pas** |
| 4 Mbit/s | 22 757 158 o | 45,8 s | **ne tient pas** |
| 1,5 Mbit/s | 45 180 002 o | 241,7 s | **ne tient pas** |

Lecture honnête de ces chiffres : les valeurs de 45,18 Mo incluent un DOUBLE
téléchargement (défaut 2 ci-dessous). À 4 Mbit/s, le cache du navigateur a
absorbé le second chargement (22,76 Mo transférés) ; aux deux autres débits,
non — Chromium n'est pas déterministe ici, faute d'en-tête de cache explicite
au-delà de `max-age=600`. Même sans ce défaut, 22,76 Mo mettent ≈ 45,8 s à
4 Mbit/s : l'objectif des 30 s ne tiendrait qu'à partir d'environ 6,1 Mbit/s
(22 756 587 × 8 / 30 — **estimé** d'après les mesures ci-dessus). Le verdict
mesuré est net : l'indicateur §4 est **en risque** sur une connexion moyenne,
comme le signalait l'annexe D ; le parcours « Play without a camera » reste
disponible pendant le téléchargement (AIR-F-02), progression affichée (§12.2).

### Deux défauts constatés, hors périmètre de ce lot (signalés, non corrigés)

1. **Racine wasm absolue.** `DEFAULT_WASM_ROOT` vaut `/models/wasm` (absolu),
   alors que le site est publié sous `/thin-air/` : la requête
   `https://baptistefaisy.github.io/models/wasm/vision_wasm_internal.js`
   renvoie 404 (vérifié le 11 novembre 2026). `WASM_ROOT` (préfixé) est bien
   calculé dans `apps/web/src/hooks/useSession.ts` mais jamais passé à
   `loadLandmarker`. Aujourd'hui, en production, la caméra bascule en mode
   pointeur. Correctif attendu (lot B4) : passer `wasmRoot: WASM_ROOT`.
2. **Double chargement.** `useSession.ts` charge un landmarker puis le jette
   (`void landmarker`), et `createCameraSource` (packages/vision,
   `camera-source.ts`) en recharge un second avec les chemins par défaut :
   jusqu'à 2 × 22,4 Mo au premier démarrage (visible dans les mesures : la
   tâche est demandée une fois via `/thin-air/models/` puis une fois via
   `/models/`). Correctif attendu (lots B5/B4).

Le serveur de mesure sert `/models/*` à la racine pour que le chargement
aboutisse malgré le défaut 1 ; c'est la seule entorse à la topologie de
production, et elle est dite.

### Cache de l'hébergeur (mesuré)

En-tête observé le 11 novembre 2026 sur `baptistefaisy.github.io` :
`Cache-Control: max-age=600` (10 minutes), ce n'est **pas** un cache long. La
phrase « le cache long rend le démarrage immédiat (AIR-F-54) » est donc à
nuancer : au-delà de 10 minutes d'inactivité, le navigateur revalide l'asset.
Un cache durable exigerait un en-tête posé par l'hébergeur (GitHub Pages ne le
permet pas) ou un service worker — décision à prendre ailleurs, pas ici.

Le modèle et ses fichiers d'exécution ne sont pas versionnés (`.gitignore`) :
`scripts/fetch-model.mjs` les télécharge et copie la variante d'exécution depuis
le paquet installé — la même version que celle utilisée par les tests.

Pour se représenter 100 ms : le son parcourt 34 mètres dans ce temps
(cahier §5.1).
