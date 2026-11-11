# Les prises réelles — la procédure en cinq étapes

Tout ce que le projet prouve aujourd'hui, il le prouve sur des prises
**synthétiques** : des trajectoires calculées. Trois points du cahier ne
peuvent être levés que par une **vraie main devant une vraie caméra**
(annexe D) :

1. la **convention de côté** du modèle sur image en miroir (§7.3) ;
2. les **valeurs du filtre** et des seuils de gestes (§7.5, §7.6) ;
3. les **mesures de retard** sur deux machines au moins (§18, `docs/latency.md`).

Cette page rend les trois faisables **en une commande** par quelqu'un qui
n'est pas développeur. Durée totale : **15 minutes par machine** (plus le
premier chargement du modèle, ~22 Mo, une fois).

## La procédure en cinq étapes

### Étape 1 — Ouvrir l'adresse

Lance le site en développement (ou ouvre l'adresse publiée) et ajoute
`?record=1` :

```bash
npm run dev          # depuis la racine du dépôt
# puis ouvre : http://localhost:5173/?record=1
```

La page « Record a real take » s'affiche. Rien ne démarre avant ton clic :
la caméra n'est ouverte qu'au bouton « Open the camera », et cette page
n'ouvre **aucun** moteur audio — aucun son n'est joué (AIR-N-02).

### Étape 2 — Cliquer

1. Presse **« Open the camera »** et autorise la caméra dans le navigateur.
2. Attends la fin du chargement du modèle de mains (une fois par visite).
3. Les trois enregistrements guidés apparaissent, avec ce que chacun prouve.

### Étape 3 — Suivre la consigne

Choisis un scénario. Un **décompte de 3 secondes** s'affiche, puis la
consigne apparaît à l'écran pendant l'enregistrement :

| Scénario | Durée | Ce que tu fais | Ce que ça lève |
|---|---|---|---|
| **Left hand only** | 3 s | Lève la main GAUCHE, ouverte, immobile dans le cadre | La convention de côté du modèle (§7.3, annexe D) |
| **Reach** | 8 s | Tends les bras : en haut, en bas, à gauche, à droite (2 s par consigne) | L'envergure réelle pour la calibration (§7.4) |
| **Tremor** | 10 s | Main immobile 5 s, puis mouvement lent 5 s | Les valeurs du filtre (§7.5, annexe D) |

Répète les trois. Chaque prise se termine toute seule et le navigateur
propose un fichier : `left-hand-only-take.json`, `reach-take.json`,
`tremor-take.json`.

### Étape 4 — Récupérer les fichiers

Accepte les trois téléchargements. Ils sont dans ton dossier de
téléchargements (par exemple `~/Téléchargements`). **Rien n'a quitté
l'appareil** : la prise est un `blob:` local (AIR-F-57), et elle ne contient
que les points des mains — jamais d'image (§7.11, AIR-F-47).

### Étape 5 — Lancer le script

Une commande, depuis la racine du dépôt (remplace le dossier et le nom de
la machine) :

```bash
npx tsx scripts/prises-reelles.mjs ~/Téléchargements --machine pc-portable
```

Le script :

- valide chaque fichier avec `parseTake` de `@thin-air/schema` (refus clair,
  avec les raisons) ;
- vérifie la vie privée avec la garde du dépôt
  (`scripts/hooks/take-privacy-guard.mjs`) : aucun champ interdit, poids par
  seconde sous le plafond de 150 Ko/s ;
- range les prises dans `takes/real/` sous le nom
  `<scénario>-<machine>-<date>.json` ;
- **lève la mesure n° 1** : sur chaque prise `left-hand-only`, il vérifie
  que le modèle annonce bien « left » et l'écrit (`✓ MESURE côté (§7.3) …`).
  Code de sortie 0 si tout est conforme, 1 si un refus ou un écart.

Sur la **seconde machine**, refais les étapes 1 à 5 avec son nom
(`--machine seconde-machine`) : le cahier §13.3 demande trois prises réelles
par machine de mesure.

## Les trois mesures, et leur commande exacte

### Mesure 1 — La convention de côté (§7.3)

```bash
npx tsx scripts/prises-reelles.mjs ~/Téléchargements --machine pc-portable
```

La ligne `✓ MESURE côté (§7.3)` est le verdict. Le test automatique existe
aussi : `apps/bench/src/real-takes.test.ts` rejoue la vérification sur les
prises rangées dans `takes/real/` (sauté tant qu'aucune prise réelle n'est
déposée — la procédure ci-dessus produit la prise).

**Ce que chaque test prouve** :

- sur la prise **synthétique** (`recipes.test.ts`, `sides.test.ts`) : la
  *chaîne de traitement* respecte la convention — ce qui entre « left »
  ressort « left », sans voix coincée. La prise est une formule : elle ne
  dit rien du modèle.
- sur la prise **réelle** (script + `real-takes.test.ts`) : le *modèle*
  annonce « left » pour une vraie main gauche sur l'image brute d'une vraie
  caméra. C'est le point « convention de côté sur image en miroir » de
  l'annexe D, et lui seul.

### Mesure 2 — Le réglage du filtre (§7.5, §7.6)

L'outil de réglage du banc est `apps/bench/src/tuning.ts` (lot N7) :

```bash
npx tsx apps/bench/src/tuning.ts --take takes/real/tremor-pc-portable-2026-11-12.json
```

Il mesure, sur une grille déterministe de couples (`fcMin`, `β`), le
**tremblement résiduel** (main immobile) et la **traîne** (mouvement lent),
puis recommande le couple qui garde le tremblement sous la cible du §5.3
(0,5 % de la largeur de zone) avec la plus petite traîne. `--json` rend le
tableau complet. Les seuils de gestes (§7.6) se règlent ensuite avec le même
outil de comparaison du banc (`npx tsx apps/bench/src/cli.ts events --take
takes/real/… --instrument instruments/phantom.json`) en observant les
déclenchements. Les valeurs retenues se reportent dans `packages/core/src/
defaults.ts` (lot A2/A7, pas ce lot) et dans le journal.

### Mesure 3 — Le retard sur deux machines (§18)

Le retard mesurable est déjà câblé et affiché dans la page (panneau
*Latency* : analyse, traitement, sortie audio — chacun marqué **measured**
ou **estimated**, §5.4). La commande sur chaque machine :

```bash
npm run dev
# ouvre http://localhost:5173/ , presse « Start », caméra autorisée,
# laisse tourner 30 s et lis le panneau Latency.
```

Recopie la ligne dans le tableau « Relevés » de `docs/latency.md` (machine,
navigateur, sortie audio, images/s, analyse, traitement, `baseLatency`,
`outputLatency`, total mesuré, total estimé). Deux machines au moins.
`docs/latency.md` appartient au lot A8 : ce lot N7 n'y écrit pas, il fournit
la procédure de relevé.

## Décision : les prises réelles ne sont PAS versionnées

`takes/real/` est dans `.gitignore`. Raison : les points d'une main ne sont
pas une image, mais **restent une donnée corporelle** (§7.11 : « une prise
n'est enregistrée que sur demande, et reste sur l'appareil »). Versionner
des prises réelles les sortirait de l'appareil de la personne filmée — à
l'opposé de la promesse « rien ne quitte ton navigateur ». Seul le harnais
(ce document, le script, l'outil de réglage, les tests) est versionné : les
mesures qu'il produit sont des **nombres** (côté annoncé, couple de filtre,
millisecondes), et ce sont ces nombres-là qui entrent dans
`docs/latency.md`, `docs/recette.md` et le journal — jamais les points.

## Ce qui est déjà prouvé sans prises réelles

- les 22 propriétés (AIR-P-01 à 22) sur prises synthétiques — `docs/recette.md` ;
- la convention de côté *dans la chaîne de traitement* (`recipes.test.ts`,
  `sides.test.ts`), et la documentation MediaPipe lue (§7.3 : le côté est
  celui du sujet, le miroir l'inverse — Thin Air envoie l'image brute) ;
- le filtre borné, convergent, jamais non numérique (AIR-P-02) ;
- le poids des prises ~26 Ko/s en JSON brut (§7.11) et le plafond de la
  garde de vie privée ;
- le retard *mesurable* câblé et affiché, marqué measured/estimated (§5.4).

## Annexe D → état → ce qui le lève

| Point de l'annexe D | État | Ce qui le lève |
|---|---|---|
| Convention de côté sur image en miroir (§7.3) | **Faisable en une commande** — prouvé dans la chaîne sur synthétique ; le verdict réel sort du script | Prise `left-hand-only` réelle (étapes 1–5) → `✓ MESURE côté` du script + `real-takes.test.ts` |
| Valeurs du filtre et des seuils de gestes (§7.5, §7.6) | **Faisable en une commande** — l'outil existe et est testé sur synthétique ; les valeurs réelles demandent la main | Prise `tremor` réelle → `npx tsx apps/bench/src/tuning.ts --take takes/real/tremor-….json` |
| Retards sur deux machines (§18, `docs/latency.md`) | **Faisable, procédure écrite** — relevé affiché par la page ; le tableau de `docs/latency.md` attend les chiffres | Étape « Mesure 3 » sur chaque machine, recopie dans le tableau Relevés |
| Calibration sur l'envergure réelle (§7.4) | **Faisable en une commande** — donnée produite, traitement déjà prouvé (AIR-P-22) | Prise `reach` réelle → rangée dans `takes/real/` par le script |
| Tous les autres points de l'annexe D | Hors lot N7 | Voir l'annexe D du cahier (licences, compatibilités, références) |
