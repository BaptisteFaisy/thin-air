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
