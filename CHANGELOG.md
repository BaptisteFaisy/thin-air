# Changelog

Les versions livrées de Thin Air. Une version est livrée quand elle tient les
quatre éléments du contrat (`docs/release.md`) : **une version**, **une section
ici**, **un tag git**, **une publication vérifiée**. Ce fichier ne raconte que
ce qui a été livré — rien de prévu, rien de supposé.

Format des sections : `## x.y.z — AAAA-MM-JJ`, puis des entrées groupées par
nature, du plus visible au plus technique.

## 0.1.0 — 2026-11-12

Première version publiée. Le site est en ligne sur
`https://baptistefaisy.github.io/thin-air/` depuis le 2026-11-12 (GitHub
Pages), sous la version `0.1.0` du `package.json`.

Tag : `v0.1.0`, à couper sur le commit publié — le contrôle
`scripts/release-check.mjs` refuse un tag absent, et compare le bundle
construit au bundle servi en ligne.

### Le site (`apps/web`)

- Les deux mains sont suivies par MediaPipe (21 points par main) ; l'analyse
  est déportée dans un worker, la scène reste fluide.
- Les notes s'aimantent sur la gamme par défaut : une note hors gamme demande
  un effort. Une main choose la hauteur, l'autre le volume ; le mode clavier
  et le pointeur prennent le relais quand il n'y a pas de caméra.
- La boucle rejoue ce qui vient d'être joué pendant qu'on ajoute une voix.
- Le service worker garde le site utilisable hors ligne après la première
  visite ; le cache s'invalide par version.
- Le mode borne (kiosque) : le fantôme joue, une main prend la main.
- Les profils de mobilité : portée courte, une main, tremblement.
- La galerie d'instruments, le lien de partage d'une prise dans le fragment de
  l'URL, l'éditeur d'instrument validé en direct.
- Les trois leçons (filtre, centièmes, couture des deux horloges), dans les
  deux langues, avec les mesures réelles de la séance.
- La latence est affichée part par part, **mesurée** ou **estimée**, et la
  boucle rend le retard estimé.

### Le moteur (`packages/`)

- `core` : espace, filtre adaptatif, features, gestes, musique (gammes et
  accords), instruments, voix, planification, boucle, MIDI, mesures — pur, sans
  navigateur, sans audio.
- `audio` : la synthèse échantillon par échantillon en TypeScript pur, le rendu
  hors ligne, l'écriture WAV, le graphe Web Audio — un seul moteur, deux
  habillages.
- `schema` : instrument, prise, session — validés, jamais réparés en silence.
- `vision` : caméra, main, enregistreur de prise, rejeu.

### Les instruments

- Seize instruments en JSON, lisibles et partageables : phantom, harpe, chœur,
  cloches, bourdon, grid-drums, chimes, dulcimer, flûte, ghost, glass, gong,
  koto, orgue, pad, tabla.

### La preuve

- Le banc (`apps/bench`) : une prise + un instrument → événements, WAV,
  rapport (notes, centièmes d'écart, dB de crête, silence après relâchement).
  Jamais de périphérique audio ouvert.
- 96 fichiers de test, aucun son, aucune requête vers une origine tierce.
- La mesure de latence, composante par composante, mesurée et estimée.
- Le poids de publication, fichier par fichier, sur le site réellement construit.
- La sonde de disponibilité du site publié : quatre ressources critiques,
  interrogées en HEAD, une fois par jour.

### La chaîne

- Une CI unique sur PR : typecheck, tests, gardes, budget de cinq minutes
  contrôlé par un garde-fou.
- Le build du site et les preuves (Playwright, axe) hors PR, sur `main` et à la
  demande.
- Le déploiement GitHub Pages sur `main`.
- Les gardes du dépôt : aucun son, le vocabulaire du cahier, la vie privée des
  prises.

### Les documents

- Le cahier des charges, le contrat entre lots, le journal de bord, la
  latence, le postmortem, la disponibilité, le kiosque, la compensation, le
  hors-ligne, l'accessibilité, la publication des paquets, le dossier de
  commande d'une œuvre, la soumission.
- Le contrat de release lui-même : `docs/release.md`, `CHANGELOG.md`,
  `scripts/release-check.mjs` et son banc.

### Les formats de fichiers

- La politique de versionnement des formats : `docs/versions-formats.md`. Chaque
  format porte un numéro, un changement incompatible crée un nouveau numéro,
  l'ancien reste lu six mois, et la dépréciation est datée et écrite au
  registre, au journal et au schéma.
- Le registre des formats, dans `docs/versions-formats.md` : les trois formats
  du dépôt y sont inscrits avec leur statut et la constante qui les déclare.
  `thin-air-instrument/1` (constante `INSTRUMENT_FORMAT`),
  `thin-air-take/1` (constante `TAKE_FORMAT`), `thin-air-session/1`
  (constante `SESSION_FORMAT`).
- Le contrôleur `scripts/check-format-versions.mjs` : il refuse un format
  vivant sans ligne de registre, une ligne de registre sans format vivant, un
  format absent du journal, et une dépréciation sans date ou plus courte que
  la fenêtre annoncée. Il sort 1 avec la liste des manques.
- La garde `scripts/hooks/format-versions-guard.mjs` : le contrôleur tourne
  dans la file des gardes du dépôt, donc dans la CI.
- Aucun changement de format : les numéros `thin-air-instrument/1`,
  `thin-air-take/1` et `thin-air-session/1` restent ce qu'ils sont. Ce qui
  change, c'est qu'ils sont désormais datés et surveillés.
