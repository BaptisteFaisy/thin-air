# Poids de publication — ce que le site met réellement en ligne

Relevé du 12 novembre 2026 sur la machine `pc` (baptiste-MS-7D18), avec le
modèle téléchargé par le script du dépôt (seule requête réseau autorisée,
AIR-N-01). Rejouable :

```
npm run fetch-model    # modèle + fichiers d'exécution dans public/models/
npm run build          # site dans apps/web/dist/
node scripts/poids-publication.mjs
```

**Convention** : la sortie des scripts est en mégaoctets décimaux
(1 Mo = 1 000 000 octets). `docs/latency.md` emploie par endroits le Mo
binaire (son « 13,93 Mo » pour le wasm vaut 14 603 354 / 1 048 576) ; les
valeurs en **octets** sont identiques partout et seules font foi.

## Sortie réelle de `scripts/poids-publication.mjs` (recopiée telle quelle)

Publication par défaut — `npm run fetch-model` sans option, donc
`--variante les-deux` — suivie de `npm run build` :

```
fichiers publiés dans apps/web/dist :
  assets/analysis-worker-Ct7hh_9P.js : 147125 octets (0.15 Mo)
  assets/index-B0BFITDv.js : 438053 octets (0.44 Mo)
  assets/index-D40UWMkw.css : 3814 octets (0.00 Mo)
  assets/src-CyIPy1ps.js : 23800 octets (0.02 Mo)
  assets/src-Opx9byDe.js : 13697 octets (0.01 Mo)
  assets/src-rM5XJTQz.js : 19601 octets (0.02 Mo)
  assets/vision_bundle-CW6lxI94.js : 154646 octets (0.15 Mo)
  index.html : 734 octets (0.00 Mo)
  models/hand_landmarker.task : 7819105 octets (7.82 Mo)
  models/wasm/vision_wasm_internal.js : 334128 octets (0.33 Mo)
  models/wasm/vision_wasm_internal.wasm : 14603354 octets (14.60 Mo)
  sw.js : 5462 octets (0.01 Mo)
total publié : 23563519 octets (23.56 Mo) — 12 fichiers
aucun doublon de 14 Mo : au plus une variante de wasm est publiée.
```

Dont 22 756 587 octets pour le modèle et son moteur d'exécution (la ligne
« Total publié » de `docs/latency.md`) ; les 806 932 octets restants sont le
site lui-même (bundle, feuille de style, page, service worker).

Le même dossier, après copie de la variante module depuis le paquet
(`node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.*`) —
c'était l'état publié avant l'allègement du lot N3 ; le script la signale :

```
  models/wasm/vision_wasm_module_internal.js : 334166 octets (0.33 Mo)
  models/wasm/vision_wasm_module_internal.wasm : 14603372 octets (14.60 Mo)
total publié : 38501057 octets (38.50 Mo) — 14 fichiers
DOUBLON : models/wasm/vision_wasm_module_internal.wasm (14603372 octets (14.60 Mo)) fait double emploi avec models/wasm/vision_wasm_internal.wasm — le site ne charge que la variante non-module (docs/latency.md) : c'est du poids mort au premier chargement.
DOUBLON : models/wasm/vision_wasm_module_internal.js (334166 octets (0.33 Mo)) fait double emploi avec models/wasm/vision_wasm_internal.js — le site ne charge que la variante non-module (docs/latency.md) : c'est du poids mort au premier chargement.
```

L'écart entre les deux totaux (38 501 057 − 23 563 519 = 14 937 538 octets)
est exactement le poids de la variante morte : c'est les « −14 Mo au premier
chargement » de l'idée 3, mesurés.

Pour référence, le rappel que `scripts/fetch-model.mjs` affiche à chaque
exécution (sortie réelle, recopiée) :

```
rappel des poids (mesurés sur les fichiers réels) :
  modèle hand_landmarker.task : 7819105 octets (7.82 Mo)
  variante non-module, chargée par le délégué GPU comme par le processeur : 14937482 octets (14.94 Mo)
  variante module, jamais chargée (--all seulement) : 14937538 octets (14.94 Mo)
  fichiers d'exécution effectivement publiés : 14937482 octets (14.94 Mo)
```

## Recommandation

**Premier chargement : publier la variante NON-module seule**
(`vision_wasm_internal.{js,wasm}`). C'est la seule que le site demande :
`FilesetResolver.forVisionTasks` est appelé sans son second argument
(`useWasmModule`, défaut `false`) dans `packages/vision/src/landmarker.ts`, et
le journal des requêtes Playwright (`scripts/preuves/chargement.mjs`) montre
que `vision_wasm_module_internal.*` n'est jamais demandé, quelle que soit la
séquence de chargement. C'est le défaut de `scripts/fetch-model.mjs`, donc de
`deploy.yml` qui l'appelle sans option.

**Coût du repli processeur (AIR-N-07) : 0 octet supplémentaire.** Le délégué
(GPU ou processeur) est choisi dans `createFromOptions`, APRÈS le chargement
des fichiers d'exécution : les deux délégués partagent le même fileset
non-module (mesuré, voir `docs/latency.md`, « Quelle variante est chargée, et
pourquoi une seule suffit »). `--variante` nomme donc les délégués à servir,
pas deux variantes de wasm distinctes : `gpu`, `cpu` et `les-deux` (le défaut,
qui garde le repli) copient les mêmes fichiers, et le rappel des poids le dit
à chaque exécution. Publier la variante module « au cas où » ne protégerait
pas le repli — elle n'est demandée par aucun des deux délégués — et coûterait
14 937 538 octets à chaque premier chargement (mesuré ci-dessus).

**La variante module ne servira qu'à un appel futur passant
`useWasmModule: true`** ; ce jour-là, `node scripts/fetch-model.mjs --all` la
conserve (ou la restaure) à côté de la variante utile.

## Le doublon de 14 Mo, concrètement

Les deux variantes sont deux copies quasi identiques du même moteur compilé
(14 603 354 contre 14 603 372 octets pour le wasm). Les publier ensemble,
c'est demander au visiteur de télécharger deux fois le même moteur alors
qu'une seule copie est exécutée. `scripts/poids-publication.mjs` le signale
par nom de fichier, avec les poids mesurés ; le test
`scripts/poids-publication.test.ts` vérifie le signal sur un dossier témoin
et le script sur le site réellement construit.
