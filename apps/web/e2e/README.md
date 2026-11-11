# Tests de bout en bout — Playwright + Chromium

Preuve de niveau 3 du cahier (§13.1) : la page entière dans un vrai
navigateur, avec un fichier vidéo en guise de caméra. On y lit le journal des
événements et des requêtes, et le texte affiché — **jamais le son**.

## Lancer

```sh
npx playwright test --config apps/web/playwright.config.ts
```

La configuration construit le site (`npx vite build apps/web`) puis le sert
(`npx vite preview apps/web --port 4173 --strictPort --host 127.0.0.1`) sous
`http://127.0.0.1:4173/thin-air/`. Un seul projet : Chromium headless. Chaque
test est borné à moins de 60 s (la suite entière tourne en ~40 s).

Prérequis : `@playwright/test` et `axe-core` installés, Chromium téléchargé
(`npx playwright install chromium`). Le modèle et son wasm (`public/models/`,
ignorés par git) s'obtiennent par `npm run fetch-model` ; sans eux, le test
« fausse caméra » prouve le repli, pas la détection de mains.

## La règle du silence (AIR-N-02)

**Aucun de ces tests n'émet un son.** Chromium est lancé avec `--mute-audio`
(dans `playwright.config.ts`, `launchOptions.args` — un test dédié, « aucun
son : Chromium est lancé muet », relit la configuration et vérifie que
l'argument y est). Aucune spec n'ouvre de périphérique audio, ne règle de
volume, ni n'exécute de commande son. La fausse caméra
(`--use-fake-device-for-media-stream`) ne demande que de la vidéo ; le test
asserte que `getUserMedia` est appelé avec `audio: false`.

## Ce que chaque spec prouve

### `bout-en-bout.spec.ts`

| Test | Preuve |
|---|---|
| aucun son : Chromium est lancé muet | `--mute-audio` est bien dans les arguments de lancement |
| l'accueil propose les deux portes | « Start » et « Play without a camera » (§12.1) |
| P2 : le pointeur joue… | La souris fait une main (harpe chargée par le fragment d'adresse, P8) ; la note en cours est affichée **en texte** et change avec le pointeur ; **journal réseau** : toutes les requêtes du chargement jusqu'à 20 s de jeu sont sur `127.0.0.1:4173`, et **aucune requête pendant le jeu** (AIR-N-01). Écrit `apps/web/out/e2e/reseau.json` |
| AIR-P-09 à l'écran | Marqué `test.fail` : **défaut produit connu** — la main virtuelle du pointeur ne se relâche jamais (aucun `pointerleave` dans `usePointerHands`), la note reste affichée après la sortie. Le jour où le produit relâche la note, le test passera de façon inattendue et il faudra retirer la marque |
| fausse caméra (niveau 3) | Chromium lancé avec fausse caméra + fausse UI + fichier vidéo YUV généré à la volée (`out/e2e/fixtures/fausse-camera.y4m`) : `getUserMedia` est demandé **sans audio**, un `AudioContext` est construit, l'écran passe par « Loading the hand model… », le wasm est demandé **au site lui-même** (même origine). Écrit `apps/web/out/e2e/camera.json` |

Ce que la fausse caméra **n'a pas** prouvé : la détection de mains réelle —
le wasm du modèle est demandé à `/models/wasm/` au lieu de
`/thin-air/models/wasm/` (`WASM_ROOT` de `useSession.ts` n'est pas passé à
`loadLandmarker`), donc il répond 404 et le chargement échoue ; l'app replie
au pointeur avec un message clair (comportement P6, vérifié). Défaut transmis
au lot vision.

### `accessibilite.spec.ts`

| Test | Preuve |
|---|---|
| axe × 3 écrans | axe-core (WCAG 2.0 → 2.2, A + AA) sur l'accueil, la scène et le panneau de réglages : zéro violation critique ou sérieuse **inconnue**. La violation grave connue (`listitem`, `role="status"` sur `ul.notices`) est documentée dans `docs/accessibility-report.md`. Preuves : `out/e2e/axe-*.json` |
| parcours clavier | Tab/Shift+Tab/Enter/espace/flèches : les deux portes de l'accueil, les cinq boutons de la barre d'outils et les **neuf réglages** sont atteignables, chacun avec un nom accessible ; les flèches changent un curseur, l'espace coche une case |
| moins de mouvement | Avec `prefers-reduced-motion: reduce`, la scène expose l'état réduit (`p.reduced`, traîne et vibration des cordes coupées dans `scene/paint.ts`) ; sans la préférence, rien n'est annoncé |

### `hors-ligne.spec.ts` (AIR-F-54)

| Test | Preuve |
|---|---|
| après une première visite, tout redémarre sans réseau | Site servi sous `/thin-air/` : le worker s'installe (scope vérifié), un rechargement en ligne met la coquille et les assets en cache pendant que le modèle et son wasm sont préchauffés en arrière-plan ; puis `context.setOffline(true)` (coupure au niveau du navigateur), rechargement : la page redémarre, le jeu au pointeur fonctionne, et le modèle (7 819 105 o) comme le wasm (14 603 354 o) sont lus **en entier depuis le cache** — prouvé par l'en-tête `x-thin-air-source: cache` posé par le worker. Journal réseau : aucune requête hors de l'origine (AIR-N-01). Écrit `apps/web/out/e2e/hors-ligne.json`. Détails et invalidation : `docs/hors-ligne.md` |

Ce que la spec ne prouve pas : la détection de mains hors ligne (le défaut
connu de chemin du wasm, ci-dessus, est indépendant du cache).

## Artefacts

Les preuves écrites vont dans `apps/web/out/e2e/` (`out/` est ignoré par
git) : `reseau.json`, `camera.json`, `hors-ligne.json`, `axe-accueil.json`, `axe-scene.json`,
`axe-reglages.json`, `fixtures/fausse-camera.y4m`.

Ces specs ne sont pas ramassées par Vitest : `vitest.config.ts` exclut
`apps/web/e2e/**` et n'inclut que les `*.test.ts(x)` sous `src/`.
