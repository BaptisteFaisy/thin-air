# L'analyse des mains dans un worker (AIR-F-07)

Ce document décrit le mécanisme mis en place dans `packages/vision/src/worker/`,
son repli quand le navigateur ne peut pas déporter l'analyse, et la marche à
suivre (non exécutée ici) pour afficher le temps d'analyse dans le compteur de
retard d'`apps/web`.

## Le mécanisme choisi

L'appel `detectForVideo(video, instant)` de MediaPipe est **synchrone** : il
occupe le fil principal le temps de l'analyse (cahier §7.3). Le déport se fait
avec un **module worker** (`analysis-worker.ts`) qui charge le modèle et exécute
l'analyse hors du fil principal, et un **hôte** (`host.ts`) qui fait la couture
entre la caméra et le worker.

- **ImageBitmap, pas OffscreenCanvas.** Chaque image de la vidéo devient une
  `ImageBitmap` via `createImageBitmap(video)`, puis est **transférée** au worker
  (`postMessage(bitmap, [bitmap])`) : l'image est détachée du fil principal sans
  copie, et MediaPipe accepte `TexImageSource` (dont `ImageBitmap`) en mode
  VIDÉO. `OffscreenCanvas` obligerait à redessiner la vidéo à chaque image
  (`drawImage` + transfert du canvas), soit une copie GPU/CPU de plus pour rien :
  `ImageBitmap` est le chemin direct, et le modèle tourne en processeur
  graphique avec repli processeur exactement comme aujourd'hui (AIR-N-07).
- **Protocole** (`protocol.ts`) : `init` (modèle servi par le site, AIR-N-01),
  `detect` (une image + son horodatage), `ready` (délégué retenu), `result`
  (mains + côté + score + temps d'analyse mesuré) et `error`. Le format de
  retour est celui de `VisionFrame` : rien en aval ne change.
- **Une seule analyse par image** (`FrameGate`, AIR-F-03) : une image en vol,
  une en attente, la dernière arrive gagne ; les précédentes sont fermées, jamais
  analysées deux fois. L'horodatage émis est celui de l'**image** (le `mediaTime`
  de la caméra), pas celui de la réponse. Une réponse tardive (image dépassée ou
  fin de session) est écartée.

## Le repli

Quand le navigateur n'a ni `Worker` ni `createImageBitmap` (ou que
l'initialisation du worker échoue), `host.ts` repasse en mode `main-thread` :
l'analyse se fait dans le fil principal avec la même API (`submit`, `onFrame`,
`ready`), et l'état reste lisible via `host.mode` (`"worker" | "main-thread"`)
et `host.state` (`"loading" | "ready" | "closed"`). L'hôte est donc un
remplacement direct de l'analyse en ligne d'`camera-source.ts`, avec la même
sémantique.

## Brancher l'affichage du temps d'analyse

Le temps mesuré remonte déjà, dans `VisionFrame.inferenceMs`, au format exact
attendu par le panneau de retard (`latencyLines`, §5.2). Ce qu'il reste à faire
dans `apps/web` — décrit ici, **pas exécuté** :

1. Dans l'état du compteur de retard, remplacer la valeur instantanée par une
   **moyenne et un maximum glissant sur les 60 dernières images** (fenêtre de
   60, cohérente avec la cadence §7.2), alimentés par `onStats` ou par
   `frame.inferenceMs` ;
2. Libeller les deux valeurs **« mesuré »**, comme l'exige le vocabulaire de
   §5.4 (`latencyLines` affiche déjà `analyse … ms (mesuré)`) — la moyenne et
   le max s'insèrent dans la même ligne ou en dessous, toujours avec la mention
   « mesuré » ;
3. S'assurer que le worker est bien émis dans `apps/web/dist` (voir ci-dessous)
   avant de brancher `createAnalysisHost` à la place de l'analyse en ligne.

Aucune requête tierce : le modèle et son wasm restent servis par le site
(AIR-N-01), et le worker ne sort rien du navigateur.

## Servir le worker (Vite)

`defaultAnalysisEnvironment` crée le worker par
`new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" })`.
Vite détecte ce motif et émet un asset séparé dans `dist/` (avec `base`
`/thin-air/`).

**État après `npx vite build apps/web` :** le build réussit (243 modules,
`vision_bundle` présent), mais le worker n'est **pas** dans `apps/web/dist`.
C'est attendu : rien n'importe encore `createAnalysisHost` — `index.ts` du
paquet est hors périmètre de ce lot, et `apps/web` ne référence pas encore
`@thin-air/vision/worker/host`. Le worker n'est donc jamais atteint par le
graphe d'imports, et Vite ne l'émet pas.

**Correctif à faire quand `apps/web` branchera l'hôte** (décrit, pas exécuté) :
- importer `createAnalysisHost` depuis `@thin-air/vision/worker/host` dans le
  hook caméra d'`apps/web` ; dès cet instant, le motif
  `new URL("./analysis-worker.ts", import.meta.url)` est atteint et Vite émet
  l'asset worker dans `dist/assets/` ;
- si, malgré cela, le worker n'était pas émis (format non détecté), ajouter à
  `apps/web/vite.config.ts` : `worker: { format: "es" }` (et, si besoin,
  `worker: { plugins: … }`). Aucun changement de config n'est nécessaire tant
  que le motif `new URL` est présent.