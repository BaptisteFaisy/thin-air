# Recette — état au 11 novembre 2026

Chaque ligne de la recette du cahier (§18) avec sa preuve. Une seule règle : la
preuve est un journal, un fichier ou un nombre — jamais une oreille, sauf la
ligne qui est explicitement rendue à l'humain.

Commandes pour reproduire :

```bash
npm ci
npx tsc --noEmit -p tsconfig.json          # typage
npx vitest run                             # 946 tests, aucun son
node scripts/hooks/run-all-guards.mjs      # les gardes du projet
npx tsx apps/bench/src/cli.ts events --take takes/reference/slow-rise.json \
    --instrument instruments/phantom.json --settings '{"magnet":1}'
npx tsx apps/bench/src/cli.ts render --take takes/reference/slow-rise.json \
    --instrument instruments/phantom.json --out bench-out --no-wav
```

## Les vingt-deux propriétés

| Id | Propriété | Preuve | État |
|---|---|---|---|
| AIR-P-01 | Zone de jeu : u, v bornés, u monotone | `space.test.ts`, `features.test.ts` (400 + 200 cas) | ✓ |
| AIR-P-02 | Filtre borné, converge, jamais non numérique | `filter.test.ts`, `features.test.ts` | ✓ |
| AIR-P-03 | Hauteur monotone, avec ou sans aimant | `music.test.ts` (400 cas) | ✓ |
| AIR-P-04 | 69 = 440 Hz, +12 double | `music.test.ts` | ✓ |
| AIR-P-05 | Aimant à 1 : toute note dans la gamme et l'étendue | `music.test.ts`, `instrument.test.ts`, `pipeline.test.ts` | ✓ |
| AIR-P-06 | Tremblement sous la marge : au plus un changement | `music.test.ts`, `gestures.test.ts`, `pipeline.test.ts`, `recipes.test.ts` | ✓ |
| AIR-P-07 | Une traversée, une note | `gestures.test.ts` (100 cas) | ✓ |
| AIR-P-08 | Balayage montant, balayage descendant | `gestures.test.ts` (14 cordes dans chaque sens) | ✓ |
| AIR-P-09 | Aucune note coincée | `instrument.test.ts` (120 cas), `pipeline.test.ts`, `recipes.test.ts` | ✓ |
| AIR-P-10 | Voix bornées par `maxVoices` | `voices.test.ts`, `instrument.test.ts` (120 cas), `pipeline.test.ts` | ✓ |
| AIR-P-11 | Ordre et causalité | `schedule.test.ts`, `instrument.test.ts`, `pipeline.test.ts` | ✓ |
| AIR-P-12 | Déterminisme au bit près | `instrument.test.ts` (60 cas), `pipeline.test.ts` | ✓ |
| AIR-P-13 | Crête sous −1 dB | `offline/render.test.ts`, `recipes.test.ts` | ✓ |
| AIR-P-14 | Palier à 5 centièmes de la fréquence attendue | `offline/render.test.ts`, `recipes.test.ts` | ✓ |
| AIR-P-15 | Silence sous −60 dB en 800 ms (2 s avec réverbération) | `offline/render.test.ts`, `recipes.test.ts` | ✓ |
| AIR-P-16 | Pas de marches sur un glissé lent | `offline/render.test.ts`, `graph/params.test.ts` | ✓ |
| AIR-P-17 | Boucle : compensation, calage, durée exacte | `loop.test.ts`, `recipes.test.ts` | ✓ |
| AIR-P-18 | MIDI : aller-retour à une unité de temps près | `midi.test.ts` | ✓ |
| AIR-P-19 | Schémas : aller-retour, altération refusée en entier | `schema.test.ts` (200 altérations) | ✓ |
| AIR-P-20 | Prise : aller-retour au pas de codage, rien d'autre que des points | `schema.test.ts`, `recorder.test.ts` | ✓ |
| AIR-P-21 | Rôles stables au croisement | `roles.test.ts`, `recipes.test.ts` | ✓ |
| AIR-P-22 | Calibration : ≥ 90 % du nuage, taille minimale, dans l'image | `space.test.ts` (200 cas) | ✓ |

## Les lignes chiffrées de la recette

| Exigence | Mesure | État |
|---|---|---|
| Thérémine : sol, la, si♭, do♯, ré, mi, fa, sol dans cet ordre | 55, 57, 58, 61, 62, 64, 65, 67 — exactement | ✓ |
| … aux instants de référence à une image près | 0 / 0,233 / 0,600 / 1,233 / 1,733 / 2,167 / 2,567 / 3,000 s contre 0 / 0,139 / 0,514 / 1,153 / 1,625 / 2,083 / 2,458 / 2,917 s dans le cahier : traîne moyenne **87 ms**, celle que le §7.14 annonce (≈ 80 ms) | ✓ |
| Rendu : chaque palier à 5 centièmes | écart maximal **3,05 centièmes** sur 7 paliers mesurés | ✓ |
| Rendu : crête sous −1 dB | **−35,3 dB** (volume général −12 dB, une voix) | ✓ |
| Rendu : 144 000 échantillons pour 3 s | 144 000 exactement à 48 kHz | ✓ |
| Silence 800 ms après la sortie des mains | atteint **723 ms** après la dernière image, soit dans la cible | ✓ |
| Harpe : quatre notes la, do, ré, fa | 57 (220,00 Hz), 60 (261,63), 62 (293,66), 65 (349,23), cordes 3, 4, 5, 6 | ✓ |
| … espacées de 125 ms à une image près | **133 ms** d'écart, soit 8 ms au-delà de la cible et 25 ms sous la tolérance d'une image | ✓ |
| … de force 0,17 | **0,167** sur les trois derniers pincements ; le premier est à 0,13, mesuré pendant l'échauffement du filtre de vitesse | ✓ |
| `hand-leaves-mid-note` : aucune voix active à la fin | 0 voix active | ✓ |
| `tremor-at-boundary` : au plus un changement de note | 1 note, aucun changement | ✓ |
| `left-hand-only` : côté « gauche » | `side = "left"` sur les 61 images | ✓ |
| Boucle de 4 mesures à 90 batt/min : 512 000 échantillons | **512 000** exactement, 10,667 s | ✓ |
| Aucun fichier sonore dans le dépôt | garde `no-audio-asset-guard` verte en CI | ✓ |
| Vocabulaire du §5.4 | garde `wording-guard` verte en CI (site, README, textes d'interface) | ✓ |
| Budget CI de 5 min par job | `ci` = 39 s à 2 m 41 s selon les lots, `ci-budget` vérifie les 8 workflows | ✓ |

## Ce qui demande encore une main humaine

| Exigence | Ce qui manque |
|---|---|
| Journal réseau du navigateur de test : aucune requête après le chargement | Le contrôle statique du bundle est vert (aucune origine tierce dans notre code). La vérification à l'exécution demande un navigateur : à faire sur la page publiée, et à joindre en capture. |
| `docs/latency.md` : le retard sur deux machines au moins | Les composantes mesurables sont câblées (`baseLatency`, `outputLatency`, temps d'analyse, intervalle d'images) et affichées ; les relevés demandent une caméra et une sortie audio réelles. |
| Contrôle automatique d'accessibilité sans erreur | La checklist WCAG 2.2 AA est écrite (`docs/accessibility.md`) avec les contrastes calculés ; le passage de l'outil automatique reste à faire sur la page publiée. |
| Séance d'écoute humaine | Par construction, ni l'agent ni la CI n'écoutent (AIR-N-02). Cette ligne est la seule qui soit rendue à l'oreille : à noter ici avec la date et ce qui a été réglé. |
| Vidéo de moins de trois minutes | Le script est écrit (`docs/submission.md`) ; la pièce reste à jouer et à filmer. |
| Poids du modèle et licence du fichier | Poids mesuré (7,82 Mo + 13,93 Mo d'exécution, `docs/latency.md`). Licence du code établie (Apache 2.0) ; licence du fichier `hand_landmarker.task` **non établie à ce jour** : vérification faite le 2026-11-11 sur les pages officielles (sources et dates dans `docs/journal.md`), aucune n'énonce de licence pour le fichier. Main humaine : ouvrir la carte du modèle (PDF illisible par nos outils, URL dans `NOTICE.md`) et, sans section licence, demander à Google une confirmation écrite. |

## Écarts au cahier, assumés et écrits

1. **Le rendu hors ligne tourne dans Node**, pas dans un navigateur sans écran
   (§13.1, niveau 2). La preuve est plus stricte : aucun périphérique audio ne
   peut être ouvert, et le rendu est reproductible au bit près en CI.
2. **La réverbération est un réseau de retards à réinjection**, pas une
   convolution (§7.9) : le même calcul doit servir hors ligne et en direct.
3. **Un thérémine est une voix continue** dont la hauteur glisse (§7.8) : la
   liste des huit notes se lit dans les `noteOn` et les contrôles de hauteur
   (`noteSteps`), pas dans les seuls `noteOn`.
4. **Un palier de moins de 200 ms n'est pas mesuré** : AIR-P-14 exige une note
   « tenue une demi-seconde ». Le dernier palier de `slow-rise` dure 150 ms (le
   délai de grâce) ; l'exclure est plus honnête que d'élargir la tolérance.
