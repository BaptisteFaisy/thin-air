# Hors ligne — fonctionner sans réseau après la première visite (AIR-F-54)

> « Après une première visite, le système DOIT fonctionner sans réseau. »
> (cahier des charges, AIR-F-54 ; voir aussi AIR-N-01 : aucune requête vers
> une origine tierce, le modèle est servi par le site lui-même.)

## Ce qui est mis en cache, et son poids

Tout est servi par le site lui-même, sous sa racine publiée `/thin-air/`
(`base` dans `apps/web/vite.config.ts`, AIR-N-13). Aucune origine tierce
n'est mise en cache ni même interceptée.

| Contenu | Adresses | Poids |
|---|---|---|
| La coquille | `/thin-air/`, `/thin-air/index.html` | ~0,7 ko |
| Les assets horodatés par Vite | `/thin-air/assets/*` (JS, CSS) | ~0,63 Mo pour la publication actuelle |
| Le modèle de vision | `/thin-air/models/hand_landmarker.task` | 7 819 105 o (7,8 Mo) |
| Les fichiers d'exécution | `/thin-air/models/wasm/*` (2 chargeurs : `vision_wasm_internal` et `vision_wasm_module_internal`, `.js` + `.wasm`) | ~29,9 Mo |

Total mis en cache après une première visite complète : **~38 Mo**, dont
37,7 Mo pour le modèle et ses fichiers d'exécution. Le chargeur wasm choisit
l'une des deux variantes selon le processeur ; les deux sont mises en cache
pour que le repli fonctionne aussi hors ligne.

## La stratégie

Le service worker est `public/sw.js` (le dossier public de `apps/web` est
`public/` à la racine du dépôt, voir `publicDir` dans `vite.config.ts`) ; il
est publié tel quel sous `/thin-air/sw.js`, avec `/thin-air/` pour champ
d'action — toutes les adresses du jeu sont donc interceptées.

- **Cache d'abord pour l'immuable** : la coquille, `assets/` (horodatés par
  Vite) et `models/`. Ce qui manque est téléchargé une fois, copié dans le
  cache, et les demandes concurrentes pour la même adresse partagent le même
  téléchargement en cours (une carte de promesses dans `sw.js`) : **le modèle
  n'est jamais téléchargé deux fois**, même si la page le demande pendant le
  préchauffage.
- **Réseau pour le reste** : toute requête qui n'est pas dans l'ensemble
  immuable (et toute requête non-GET) passe sans interception ni copie.
- **Le premier rendu n'est jamais bloqué** : l'installation ne met en cache
  que la coquille (quelques kilo-octets) ; le modèle et le wasm sont
  préchauffés en arrière-plan **après** l'activation, sans `waitUntil`
  bloquant.
- Chaque réponse servie porte l'en-tête `x-thin-air-source: cache` ou
  `reseau` : c'est la preuve lisible, pour les tests comme pour quiconque,
  d'où vient le fichier.
- L'enregistrement (`apps/web/src/lib/offline.ts`, appelé par `main.tsx`) ne
  se fait qu'en **construction de production** et en **contexte sûr** (HTTPS
  ou hôte local) ; le mode développement garde son rechargement à chaud, et
  si l'API est absente ou refuse, le repli est silencieux : le jeu continue,
  simplement sans hors ligne.

## Invalider le cache quand une version change

Le versionnage est explicite dans le code : en haut de `public/sw.js`,

```js
const VERSION = "v1";
const NOM_CACHE = `thin-air-${VERSION}`;
```

**À chaque publication qui change un fichier mis en cache (coquille, assets,
modèle, wasm), incrémenter `VERSION`** (`v1` → `v2`…). Au chargement suivant,
le navigateur constate que `sw.js` a changé, installe la nouvelle version, et
à l'activation celle-ci supprime tous les caches d'un autre nom puis
repréchauffe les siens. Rien d'autre à faire : aucun fichier en cache ne
survit à un changement de version.

## Limites connues

- **La première visite demande le réseau** : un service worker n'existe pas
  avant d'avoir été téléchargé, et il ne contrôle la page qu'à partir du
  chargement suivant. Le hors ligne commence donc à la **deuxième** visite —
  ou dès la première si l'on recharge la page une fois après l'installation
  (c'est ce que fait la preuve ci-dessous).
- Si la première visite s'arrête avant la fin du préchauffage (~38 Mo), le
  modèle peut manquer au rechargement hors ligne ; la coquille et le jeu au
  pointeur fonctionnent, et le jeu avec caméra replie au pointeur avec son
  message clair (P6).
- La détection de mains hors ligne n'est pas prouvée par le test de bout en
  bout : un défaut connu de chemin du wasm (documenté dans
  `apps/web/e2e/README.md`, transmis au lot vision) fait échouer le
  chargement du modèle, en ligne comme hors ligne. Le cache, lui, est prouvé
  fichier par fichier.

## Rejouer la preuve

```sh
npm run fetch-model   # une fois : modèle + wasm dans public/models/ (ignorés par git)
npx playwright test --config apps/web/playwright.config.ts hors-ligne
```

La spec `apps/web/e2e/hors-ligne.spec.ts` construit le site, le sert sous
`/thin-air/`, attend l'installation du worker, **coupe le réseau**
(`context.setOffline(true)`, émulation de coupure au niveau du navigateur),
recharge, puis vérifie : la page redémarre, le jeu au pointeur fonctionne,
le modèle et le wasm sont servis depuis le cache (en-tête
`x-thin-air-source: cache`, tailles complètes lues hors ligne), et aucune
requête ne quitte l'origine du site. Chromium est lancé muet
(`--mute-audio`) : aucun son n'est émis (AIR-N-02). La preuve écrite est
`apps/web/out/e2e/hors-ligne.json`.
