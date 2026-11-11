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
