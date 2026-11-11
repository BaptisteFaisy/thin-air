# Rapport d'accessibilité automatisée — Thin Air

**Date : 2026-11-11.** Outils : axe-core 4.14.0 injecté dans Chromium headless
par Playwright 1.65.0 ; parcours clavier et `prefers-reduced-motion` pilotés
par Playwright. Cible : WCAG 2.2 AA (cahier §12.4, AIR-N-06). Périmètre :
l'écran d'accueil, la scène (mode pointeur, P2) et le panneau de réglages.

## Rejouer

```sh
npx playwright test --config apps/web/playwright.config.ts
```

Les preuves brutes sont écrites dans `apps/web/out/e2e/` (`axe-accueil.json`,
`axe-scene.json`, `axe-reglages.json`, ignoré par git). Détails des specs :
`apps/web/e2e/README.md`.

## 1. Ce que l'outil a trouvé

Règles exécutées : jeux de tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
`wcag22a`, `wcag22aa`.

| Écran | Violations critiques | Violations sérieuses | Autres |
|---|---|---|---|
| Accueil | 0 | 0 | 0 |
| Scène (jeu au pointeur) | 0 | **1 connue** (`listitem`) | 0 |
| Panneau de réglages | 0 | **1 connue** (`listitem`) | 0 |

### La violation connue : `listitem` (sérieuse)

`ul.notices` porte `role="status"` (`apps/web/src/ui/Notices.tsx`) : le rôle
`status` efface la sémantique de liste, et les `li` des messages d'état se
retrouvent orphelins — un lecteur d'écran n'annonce plus « liste de N
éléments ». Correctif attendu (une ligne, hors du périmètre de ce lot qui
n'édite pas `apps/web/src/**`) : déplacer `role="status"` et `aria-live` sur
un `div` enveloppant le `ul`, qui garde son rôle de liste implicite. Transmit
au lot accessibilité (W5). En attendant, l'exception est déclarée
explicitement dans la spec (`GRAVES_CONNUES`) : toute **nouvelle** violation
grave fait échouer les tests.

### Découvertes adjacentes (hors axe, relevées par les tests de bout en bout)

- **Note coincée à la sortie du pointeur** : la main virtuelle ne se désactive
  jamais (aucun `pointerleave` dans `usePointerHands`) ; avec la voix « lead »
  tenue, la note reste affichée après la sortie de la souris — contraire à
  l'esprit d'AIR-P-09 vu de l'écran. Test dédié marqué `test.fail` (il
  redeviendra bruyant le jour du correctif).
- **Texte de note du thérémine** : la note affichée ne suit pas le glissando
  (les changements de hauteur passent par des événements `control`, et
  l'affichage ne lit que `noteOn`). Sur les instruments à cordes pincées, le
  texte change bien à chaque pincement.
- **`WASM_ROOT` non transmis** : sous la base `/thin-air/`, le wasm du modèle
  est demandé à `/models/wasm/` (404) — le chargement du modèle échoue et
  l'app replie au pointeur. Sans impact sur l'accessibilité, mais la page
  affiche alors « The camera was refused. » alors que c'est le modèle qui a
  échoué : message trompeur pour l'utilisateur.

## 2. Contraste — les trois couleurs de la direction artistique

Valeurs **réelles du site** (`apps/web/src/styles.css`, `:root`), ratios
recalculés avec la formule de luminance relative WCAG 2.2 (exigence textes :
4,5:1 ; le calcul est reproductible, voir commande en fin de section).

| Couleur | Hex | Sur fond de nuit `#0b0d12` | Sur fond de panneau `#151922` |
|---|---|---|---|
| os (traits, textes) | `#f2ece1` | **16,53:1** ✓ | **14,96:1** ✓ |
| spectre (ce qui sonne) | `#7fd4c1` | **11,19:1** ✓ | **10,13:1** ✓ |
| discret (textes secondaires) | `#c9c2b4` | **10,98:1** ✓ | **9,93:1** ✓ |

Cas particuliers : le bouton primaire (nuit sur spectre) donne **11,19:1** ✓ ;
spectre posé sur os donnerait 1,48:1 — la teinte spectrale n'est jamais
utilisée comme texte sur l'os (règle déjà écrite dans la feuille de style).
À noter : la palette citée dans `docs/accessibility.md` (`#0B0D14`, `#F2EBDC`,
`#7CE8CB`…) diffère de la feuille de style réelle ; les valeurs ci-dessus font
foi car elles sont mesurées sur le CSS livré.

Reproduire :

```sh
cat > /tmp/contraste.mjs <<'EOF'
function lum(h){const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)
.map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);
return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
const r=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);
return((x+0.05)/(y+0.05)).toFixed(2);};
console.log(r("#f2ece1","#0b0d12"), r("#7fd4c1","#0b0d12"), r("#c9c2b4","#0b0d12"));
console.log(r("#f2ece1","#151922"), r("#7fd4c1","#151922"), r("#c9c2b4","#151922"));
EOF
node /tmp/contraste.mjs
```

axe-core vérifie le contraste de son côté (règle `color-contrast`) : aucune
violation sur les trois écrans.

## 3. Parcours clavier (automatisé)

Tout est atteignable au clavier, vérifié par la spec `accessibilite.spec.ts` :

- **Accueil** : Tab atteint « Start » puis « Play without a camera », chacun
  avec son nom accessible ; Enter ouvre le jeu sans caméra (P2).
- **Scène** : les cinq boutons de la barre d'outils (« Open the instruments »,
  « Loop », « Calibrate », « Settings », « Show the physics ») sont atteignables
  par Tabulation.
- **Panneau de réglages** : les neuf contrôles (`setting-snap`,
  `setting-left-handed`, `setting-one-hand`, `setting-hold`,
  `setting-volume`, `setting-reverb`, `setting-camera-latency`,
  `setting-filter`, `setting-show-camera`) sont atteignables, chacun avec un
  nom accessible non vide (via `<label for>`) ; les **flèches** changent la
  valeur d'un curseur (`aria-valuetext` mis à jour), l'**espace** coche une
  case, **Shift+Tab** revient en arrière.
- Raccourcis de jeu (`usePointerHands`) : A–K pincent les cordes, les flèches
  déplacent la main virtuelle, P relance le moteur audio.

## 4. Moins de mouvement (`prefers-reduced-motion: reduce`)

Respecté et **observable** : avec la préférence `reduce`, la scène affiche
`p.reduced` (« Your system asks for less motion… ») et le panneau de réglages
un `p.help[role="status"]` ; côté rendu, `scene/paint.ts` coupe la traîne
(`if (model.reducedMotion) return;`) et la vibration des cordes. Sans la
préférence, aucun de ces éléments n'apparaît. Les deux comportements sont
assertés par les specs.

## 5. Ce qui reste à vérifier à la main

L'automate ne remplace pas :

1. **Lecteur d'écran réel** (NVDA/JAWS sous Windows, VoiceOver sous macOS/iOS) :
   ordre d'annonce des régions `aria-live` (note en cours, messages d'état),
   verbosité du `role="meter"` de la jauge, comportement après le correctif
   `listitem`.
2. **Focus visible en conditions réelles** : l'anneau `focus-visible` (3 px
   spectre) est présent dans le CSS, mais son contraste sur chaque contrôle et
   sa visibilité sur le panneau fixe méritent un œil.
3. **Zoom 400 % et recadrage** (WCAG 1.4.4/1.4.10) : la scène passe en 70vh —
   vérifier qu'aucun contenu ne devient inaccessible en zoom texte.
4. **Tailles des cibles** (2.5.8) : boutons de la barre d'outils et cases à
   cocher à mesurer au rendu réel.
5. **Vestibulaire** : confirmer avec une personne sensible au mouvement que
   l'absence de traîne suffit (le fond de nuit et les dégradés lents restent).
6. **Séance d'écoute humaine** (§13.4) : ce rapport ne dit rien de la qualité
   sonore — les tests tournent muets, volontairement.

## 6. Bilan

| Exigence | État |
|---|---|
| Zéro violation axe critique/sérieuse (hors exception documentée) | ✓ automatisé |
| Tous les réglages au clavier, avec noms accessibles | ✓ automatisé |
| Note en cours en texte | ✓ automatisé (harpes/cordes ; limite thérémine documentée) |
| `prefers-reduced-motion` respecté | ✓ automatisé |
| Contraste ≥ 4,5:1 des trois couleurs | ✓ mesuré (16,53 / 11,19 / 10,98 sur nuit) |
| Aucune note coincée à la sortie du pointeur | ✗ défaut produit connu, test marqué, correctif à faire |
| Lecteur d'écran réel | à faire à la main (§5) |
