# Les trois leçons, visibles sur le site

`apps/web/src/ui/LessonsPanel.tsx` rend les trois leçons du parcours P5
(§12.1, écran « Physique »). La logique était déjà livrée et testée dans
`apps/web/src/lessons/` ; ce lot ajoute les trois raccords : deux liens
d'accès, les libellés dans les deux langues, et les mesures réelles de la
séance en cours.

## Les trois raccords

1. **Lien depuis l'accueil** — `apps/web/src/ui/Home.tsx` : un lien
   `?lecons=1` dans le bloc d'actions, libellé `m.lessons.link`.
2. **Lien depuis l'écran Physique** — `apps/web/src/ui/PhysicsPanel.tsx` :
   même lien, même libellé (clé `lessons.link` dans `i18n/en.ts` et
   `i18n/fr.ts`).
3. **Route** — `apps/web/src/App.tsx` : `?lecons=1` ouvre le panneau, et lui
   passe ses libellés (`lessonsFor(langFrom(...))`), dans la langue de la page.

## Les libellés dans les deux langues

`apps/web/src/i18n/lessons.en.ts` et `lessons.fr.ts` sont déclarés dans
`apps/web/src/i18n/index.ts` par `lessonsFor(lang)` — le même mécanisme que la
borne (`kiosk.en.ts` / `kiosk.fr.ts`). Le catalogue est passé en prop de
`LessonsPanel` (`messages`), et **plus aucun libellé anglais n'est écrit en dur
dans le composant** : titres, légendes, unités, badges, messages et mentions
« measured » / « estimated » viennent tous du catalogue. Les nombres sont mis en
forme par `formaterNombre()` : groupe de trois chiffres et virgule décimale en
français, point en anglais.

## Les deux modes

- **direct** (mode de départ) : le panneau lit la séance en cours. Sans
  image analysée, il affiche un message « pas de données en direct » et un
  bouton qui bascule en mode exemple — **aucun nombre n'est inventé**.
- **exemple** : la prise de synthèse à graine fixe, toujours étiquetée
  « exemple », jamais « mesuré ».

## D'où vient chaque nombre réel

| Leçon | Nombre affiché | Origine |
|---|---|---|
| Les deux horloges | temps d'analyse, moyenne et pire image | `lireAnalyse()` / `suivreAnalyse()` → `hooks/analysisStore.ts` → fenêtre glissante des 60 dernières images de `@thin-air/vision` — **mesuré** |
| Les deux horloges | intervalle entre deux images, images par seconde tenues | même fenêtre glissante (`meanFrameIntervalMs`) — **mesuré** |
| Les deux horloges | fil d'exécution de l'analyse | `analysisStore.ts` (`worker` ou repli sur le fil principal) |
| Les deux horloges | retard de la caméra | `DEFAULT_SETTINGS.cameraLatencyMs` — **estimé** : non mesurable dans le navigateur (§5.1) |
| Viser juste | note jouée, et sa fréquence | `hooks/noteStore.ts`, alimenté par `hooks/useSeanceEffects.ts` depuis l'affichage de la scène (`reduceDisplay`) — la note qui sort réellement |
| Le filtre | (rien en direct, voir ci-dessous) | la chaîne de suivi n'expose pas de tampon de positions |

En mode exemple, les nombres viennent des fonctions pures de
`apps/web/src/lessons/` (`buildFilterLesson`, `buildCentsLesson`,
`sweepCents`, `tremblementEnCents`, `enEchantillons`) et des constantes du
moteur (`SAMPLE_RATE`, `lookaheadMs`, `paramTauMs`) : rien n'est écrit en dur
dans le composant, et chaque nombre existe aussi en texte (un dessin seul ne
serait pas lu par un lecteur d'écran, AIR-N-06).

## Ce qui manque encore, et pourquoi

- **L'écart-type du tremblement réel de la personne qui joue** (leçon « Le
  filtre » en direct) : `FeatureTracker` ne renvoie que ses canaux filtrés
  (`smooth`, `fast`) ; la position brute n'est exposée nulle part, et la
  logique de `apps/web/src/lessons/` est figée. Il faudrait un tampon glissant
  des positions brutes et filtrées, publié par la chaîne de suivi
  (`apps/web/src/lib/tracking.ts`) comme l'analyse l'est par `analysisStore.ts`.
  En attendant, la leçon affiche un mot qui dit ce qui manque, et **aucun
  nombre**.
- **L'écart à la gamme pour le jeu réel** (leçon « Viser juste » en direct) :
  la hauteur visée n'est pas exposée par la séance — seule la note jouée est
  connue. Le panneau dit la note jouée, et le reste est écrit dans
  `docs/ui-lecons.md` (ici), pas à l'écran en chiffres.

## Tests

`apps/web/src/ui/LessonsPanel.test.tsx` couvre les deux modes, les deux
langues, l'absence de tout nombre quand aucune séance n'a mesuré, et le
bouton qui bascule de « direct » à « exemple » (dans un vrai DOM,
`happy-dom`). Aucun son n'est produit : le rendu passe par
`react-dom/server` et `react-dom/client`.
