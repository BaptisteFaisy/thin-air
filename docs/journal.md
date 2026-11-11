# Journal de bord

Le journal se tient dès le premier jour (cahier §17.3) : ce qui a été décidé,
ce qui a été mesuré, ce qui a été écarté. Chaque séance d'écoute humaine y est
notée avec sa date et ce qui a été réglé à la suite (recette §18).

## 2026-11-11 — ouverture du chantier

- Dépôt ouvert : `BaptisteFaisy/thin-air`, public, licence MIT.
- Nom retenu : **Thin Air** (piste 1 du §6.3). Vérifié libre sur GitHub et npm
  ce jour. Le trigramme des exigences reste `AIR`, l'identifiant de format
  devient `thin-air-instrument/1` et `thin-air-take/1` (§11.4, annexe B).
- Squelette posé : le contrat partagé (`packages/core/src/types.ts`), les
  réglages par défaut (`defaults.ts`), les signatures de tous les modules de
  `core`, `schema`, `audio`, `vision` et `bench`. Les corps arrivent par lots,
  en parallèle ; les frontières sont dans `docs/CONTRACT.md`.
- Décision de conception : le rendu hors ligne est un moteur de synthèse
  échantillon par échantillon écrit en TypeScript pur (`packages/audio/src/dsp`),
  exécuté dans Node. Le cahier (§13.1, niveau 2) prévoyait un navigateur sans
  écran ; Node rend la preuve plus stricte encore — aucun périphérique audio ne
  peut être ouvert, aucun haut-parleur ne peut être touché, et le rendu est
  reproductible au bit près en CI (AIR-N-02, AIR-N-09). Le même moteur alimente
  les modules `AudioWorklet` du jeu direct : une seule implémentation, deux
  habillages.
- Décision de conception : la réverbération est un réseau de retards à
  réinjection généré au démarrage, pas une convolution. Raison : le même calcul
  doit tourner hors ligne (Node) et en direct (graphe audio), et une convolution
  longue n'a pas de version hors ligne bon marché. L'exigence AIR-F-30
  (réverbération calculée, réglable, désactivable) est tenue ; l'écart avec le
  §7.9 est noté ici.
- Chaîne de merge : file Mergify (lots de 3, rebase), checks requis `ci`,
  `ci-budget`, `couche0`, agent de conflit piloté par le modèle InferHub,
  runners auto-hébergés déplacés depuis des dépôts au repos.

## 2026-11-11 — chantier parallèle, première journée

Le projet a été construit en lots disjoints, chacun sur sa branche, mergé par la
file Mergify (lots de 3, rebase) avec les trois checks requis `ci`, `ci-budget`,
`couche0`. Le contrat partagé (`packages/core/src/types.ts`, `defaults.ts`) et les
signatures de tous les modules ont été écrits AVANT le chantier : c'est ce qui a
permis de travailler en parallèle sans se marcher dessus. Les frontières par lot
sont dans `docs/CONTRACT.md`.

**Mesures et faits nouveaux, tous vérifiés ce jour**

- Le modèle de suivi des mains pèse **7 819 105 octets** (7,82 Mo) et sa variante
  d'exécution **13,93 Mo** : le premier chargement fait ≈ 22 Mo. L'indicateur
  « moins de 30 secondes » du cahier §4 ne tient donc que sur une connexion
  correcte — d'où l'importance du jeu au pointeur pendant le téléchargement.
  Détail dans `docs/latency.md`. C'était un point « à vérifier » de l'annexe D :
  il est levé.
- Une prise en JSON brut pesait **64 à 127 Ko/s**, soit jusqu'à 4,9 fois
  l'estimation du cahier §7.11 (~26 Ko/s). La cause n'est pas le modèle de
  données mais l'écriture : `JSON.stringify` sort les flottants sur 17 chiffres.
  `compactTakeJson` (arrondi à 1e-5, soit le millième d'un pixel en 1080p et
  au-dessous du pas du codage binaire 1,5e-5) ramène les prises à **18 Ko/s pour
  une main et 35 Ko/s pour deux**, dans l'ordre de grandeur annoncé, avec de la
  marge sous le plafond de 150 Ko/s du garde de vie privée.
- Le build du site pèse **306 Ko** de JavaScript (97 Ko gzip) hors modèle, et ne
  contient **aucune** requête vers une origine tierce : c'est contrôlé
  automatiquement par `.github/workflows/deploy.yml` avant toute publication
  (AIR-N-01), ainsi que l'absence de fichier sonore (AIR-F-25).
- Deux garde-fous trouvés par les tests, pas par la relecture : une vitesse non
  finie (deux images au même horodatage) déclenchait un pincement parce que
  `NaN < seuil` est faux en JavaScript ; et l'appariement des mains par seule
  proximité échangeait les rôles au croisement — AIR-P-21 exigeait de prendre le
  côté anatomique comme clé principale, la proximité ne départageant que deux
  mains du même côté.

**Ce que la CI a refusé, et pourquoi c'est bien**

- Un README qui citait, pour l'expliquer, l'expression interdite par le tableau du
  §5.4 : le garde de vocabulaire a refusé sa propre justification. La règle est
  désormais décrite sans citer les mots.
- Un verrou npm désynchronisé des espaces de travail : `npm ci` refusait de
  tourner, donc aucune PR ne pouvait rendre de verdict. Corrigé avant le
  chantier.
- Une PR dont le périmètre déclaré omettait un changement de mode de fichier
  (`100644` → `100755`) posé par npm : `couche0` compte les modes.

**Écarts assumés au cahier** (déjà notés plus haut, rappelés pour la soumission) :
le rendu hors ligne tourne dans Node et non dans un navigateur sans écran — la
preuve est plus stricte, aucun périphérique audio ne peut être ouvert ; la
réverbération est un réseau de retards à réinjection et non une convolution — le
même calcul doit servir hors ligne et en direct.

## 2026-11-11 (soir) — intégration : la chaîne de bout en bout, et la recette

Le dernier lot (B2 : instrument, voix, datation, chaîne complète) est mergé. La
recette du §18 est maintenant vérifiée ligne par ligne dans `docs/recette.md`.

**Quatre défauts d'intégration trouvés en rejouant les exemples chiffrés du
cahier — aucun n'était visible lot par lot :**

1. **Les prises de synthèse étaient lues à l'envers.** `apps/bench/src/synth.ts`
   avait sa propre conversion `u → x`, sans le miroir du §7.4 : la prise
   `slow-rise` faisait descendre la hauteur au lieu de la monter, et le thérémine
   ne donnait qu'une note (midi 70) au lieu des huit attendues. La conversion est
   désormais déléguée à `takeGen.uToImageX` / `vToImageY` : une seule
   implémentation dans le dépôt, et un test d'aller-retour (poser une main à
   `u`, la relire à `u`) verrouille la convention.
2. **Le balayage de cordes suivait la paume, pas l'index.** Le §7.14 dit « un
   index passe de u = 0,20 à u = 0,45 » ; `sweepTake` plaçait le centre de la
   paume, d'où un décalage d'une corde (4, 5, 6, 7 au lieu de 3, 4, 5, 6).
   `sweepTake` compense maintenant par `indexTipOffsetU`, mesuré et non deviné.
   Résultat : cordes 3, 4, 5, 6, notes 57, 60, 62, 65 = la, do, ré, fa, aux
   fréquences exactes du cahier.
3. **`--settings '{"magnet":1}'` était refusé.** Le validateur comparait au type
   de la valeur par défaut, or `magnet` vaut `null` par défaut et `typeof null`
   est `"object"` : aucun nombre ne pouvait passer. Les réglages « nombre ou
   null » sont traités comme tels.
4. **Le rapport de rendu mesurait une fréquence moyenne.** Sur une voix continue,
   `noteOn → noteOff` ne fait qu'un palier de 4,2 s : la fréquence mesurée
   (390 Hz pour un sol attendu à 196 Hz) ne voulait rien dire. Le rapport découpe
   maintenant la voix à chaque contrôle de hauteur (`noteSteps`) et mesure chaque
   palier après une garde de 80 ms. Écart maximal obtenu : **3,05 centièmes**
   pour une tolérance de 5.

**Ce que le cahier avait prédit, et que la mesure confirme** : la traîne du
filtre sur les instants du thérémine est de **87 ms en moyenne** (0 à 110 ms
selon les notes), là où le §7.14 annonce « environ 80 ms ». C'est le genre de
coïncidence qui dit que la couture est câblée comme le cahier le décrit.

**Un défaut de conception corrigé au passage** : quitter une zone du chœur ne
libérait pas la note, parce que le geste `leave` arrive en phase « end » et que
le mapping `hold` n'agissait qu'en phase « start ». Une note coincée — le défaut
classique du genre — que AIR-P-09 ne voyait pas en test unitaire, parce que
`end()` rattrapait tout en fin de prise.

## 2026-11-11 — lot N1 : la licence du modèle de vision, vérifiée et écrite

L'annexe D du cahier laissait un point ouvert : « licence du fichier de modèle
— à vérifier sur sa fiche » (AIR-N-11). C'était le seul risque juridique de la
soumission : le site redistribue `hand_landmarker.task` (7 819 105 octets,
téléchargé depuis `storage.googleapis.com` par `scripts/fetch-model.mjs`) et
les fichiers wasm du paquet `@mediapipe/tasks-vision`. Vérification faite ce
jour, sans rien deviner.

**Ce qui a été lu, où et quand (toutes les consultations datent du
2026-11-11) :**

- La fiche officielle du modèle Hand Landmarker :
  <https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker>
  (page mise à jour le 2025-01-13), lue via une copie archivée sur
  web.archive.org — la page en ligne fait une redirection inter-domaines que
  l'outil de consultation refuse. On y lit : modèle « HandLandmarker (full) »,
  float16, 192×192 et 224×224 ; le lien de téléchargement est exactement
  l'URL de `scripts/fetch-model.mjs` ; la « fiche » désignée est un PDF,
  « Model Card Hand Tracking (Lite_Full) with Fairness Oct 2021 »
  (<https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20(Lite_Full)%20with%20Fairness%20Oct%202021.pdf>).
  **Aucune licence du fichier n'y est écrite.**
- Le guide MediaPipe Solutions :
  <https://ai.google.dev/edge/mediapipe/solutions/guide> (lu via copie
  archivée) — décrit « MediaPipe Models: Pre-trained, ready-to-run models »,
  sans citer de licence pour les fichiers.
- La page « About the Preview » :
  <https://ai.google.dev/edge/mediapipe/solutions/about> (mise à jour
  2024-05-14, lue via copie archivée) — l'usage est soumis aux Google APIs
  Terms of Service, à la Google API Services User Data Policy et aux
  MediaPipe API Terms of Service.
- Les MediaPipe APIs Terms of Service :
  <https://ai.google.dev/edge/mediapipe/legal/tos.md> (modifiées le
  2021-11-12, lues via copie archivée) — portent sur la confidentialité des
  données d'entrée et les métriques ; aucune concession de licence.
- La licence du **code** : le LICENSE du dépôt MediaPipe
  (<https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE>) est
  Apache 2.0 (avec une exception Lucent limitée à des fichiers utf internes) ;
  le paquet installé `node_modules/@mediapipe/tasks-vision/package.json`
  (version 1.2.2) déclare `"license": "Apache-2.0"` — le paquet ne contient
  aucun fichier LICENSE — et le registre npm confirme la même valeur
  (<https://registry.npmjs.org/@mediapipe/tasks-vision/latest>). Les fichiers
  wasm que le site redistribue viennent de ce paquet : ils sont sous
  Apache 2.0, attribution requise.
- Le PDF de la carte du modèle n'a pas pu être lu : l'outil de consultation
  de documentation refuse le type `application/pdf`
  (« Unsupported content type »). C'est la fiche que l'annexe D désigne ; son
  contenu reste donc non lu.

**Conclusion, honnête :** la licence du code est **établie** (Apache 2.0,
paquet et dépôt). La licence du **fichier** `hand_landmarker.task` est
**non établie à ce jour** : aucune page officielle consultée ne l'énonce, et
la carte du modèle — seule source désignée — n'a pas pu être lue avec les
outils autorisés. En l'état : l'usage du modèle via les API MediaPipe est
couvert par les conditions de Google, et la redistribution du code et des
wasm est couverte par Apache 2.0 (attribution écrite dans `NOTICE.md`) ; la
redistribution du fichier `.task` depuis l'origine du site n'est pas
clairement autorisée par un texte lu. Ce qu'il faudrait : une main humaine
ouvre le PDF (éventuelle section licence) et, à défaut, demande à Google une
confirmation écrite (issue sur `google-ai-edge/mediapipe` ou Stack Overflow,
tag `mediapipe`).

Fichiers touchés : `NOTICE.md` (section modèle réécrite, MIT et tiers séparés)
et `docs/recette.md` (ligne « main humaine » mise à jour). La ligne reste au
tableau de la recette puisque la licence du fichier reste non établie.
