# Le registre des preuves — Thin Air

> **Une étape sans preuve n'est pas faite.**
>
> Ce registre est la liste de ce qui doit rester vrai. Chaque ligne est une
> étape vérifiable du projet : elle se rejoue par la commande indiquée, elle
> laisse un résultat écrit dans le dépôt, et le site l'affiche
> (`?preuves=1`).

## Comment ça marche

| Quoi | Où |
|---|---|
| La liste des preuves (le manifeste) | `docs/preuves.json` |
| Le dernier résultat de chaque preuve | `docs/preuves-resultat.json` |
| Le script qui rejoue tout et écrit le résultat | `scripts/verification.mjs` |
| Les contrôles de faits écrits (modèle, licence, main humaine) | `scripts/preuves/controles.mjs` |
| La page du site | `apps/web/src/ui/PreuvesPanel.tsx`, route `?preuves=1` |

```bash
node scripts/verification.mjs          # rejoue tout, écrit docs/preuves-resultat.json
node scripts/verification.mjs --liste  # la liste des preuves, sans les jouer
node scripts/verification.mjs --filtre AIR-P-13   # une seule
```

Le script sort 1 si une seule preuve échoue : la CI peut donc dire « le
registre est vert » sans le recalculer à la main.

## Ce que le script garantit

- **Chaque commande est jouée dans un dossier temporaire** : `TMPDIR` pointe
  vers un dossier neuf, créé puis effacé autour de la commande. Rien ne traîne
  entre deux preuves.
- **Aucune commande n'écrit dans le dépôt** : avant et après chaque commande,
  le script compare l'empreinte des fichiers du dépôt (`out/`, `dist/` et
  `node_modules/` exclus). Une commande qui écrit une preuve est invalidée —
  elle ne peut pas « passer en écrivant ».
- **Aucun son** : les preuves passent par des journaux de tests et des
  fichiers, jamais par un haut-parleur (AIR-N-02).
- **Aucune origine tierce** : les commandes sont locales, le modèle et son
  moteur d'exécution sont servis par le site (AIR-N-01).
- **Une preuve qui ne prouve rien est refusée** : Vitest sort 0 quand son
  filtre `-t` ne sélectionne aucun test ; le script exige qu'au moins un test
  soit passé, sinon la preuve est marquée en échec.
- **Aucun secret** : le manifeste est un fichier public ; le contrôle
  `node scripts/preuves/controles.mjs manifeste` refuse une valeur qui
  ressemble à une clé.

## Les preuves

Le tableau ci-dessous est rafraîchi par `node scripts/verification.mjs` : ne pas
le modifier à la main, il est réécrit à chaque exécution complète.

<!-- TABLEAU-PREUVES -->
| Preuve | Ce qu'elle dit | État | Mesure | Durée | Date | Rejouer |
|---|---|---|---|---|---|---|
| REC-TYPAGE | Le typage du dépôt passe | ok | — | 72.1 s | 2026-11-12 | `npx tsc --noEmit -p tsconfig.json` |
| REC-SUITE | La suite complète passe, sans son | ok | 1280 | 67.2 s | 2026-11-12 | `npx vitest run --reporter=dot` |
| REC-GARDES | Les gardes du projet sont vertes | ok | — | 3.2 s | 2026-11-12 | `node scripts/hooks/run-all-guards.mjs` |
| REC-VOCAB | Le vocabulaire du §5.4 est respecté | ok | — | 403 ms | 2026-11-12 | `node scripts/hooks/wording-guard.mjs` |
| REC-SON | Aucun fichier sonore dans le dépôt | ok | — | 527 ms | 2026-11-12 | `node scripts/hooks/no-audio-asset-guard.mjs` |
| AIR-P-01 | Zone de jeu : u et v bornés, u monotone | ok | 2 | 20.3 s | 2026-11-12 | `npx vitest run packages/core/src/space.test.ts -t "AIR-P-01" --reporter=dot` |
| AIR-P-02 | Filtre borné, convergent, jamais non numérique | ok | 3 | 19.2 s | 2026-11-12 | `npx vitest run packages/core/src/filter.test.ts -t "AIR-P-02" --reporter=dot` |
| AIR-P-03 | Hauteur monotone, avec ou sans aimant | ok | 1 | 13.4 s | 2026-11-12 | `npx vitest run packages/core/src/music.test.ts -t "AIR-P-03" --reporter=dot` |
| AIR-P-04 | 69 = 440 Hz, +12 double | ok | 1 | 11.5 s | 2026-11-12 | `npx vitest run packages/core/src/music.test.ts -t "AIR-P-04" --reporter=dot` |
| AIR-P-05 | Aimant à 1 : toute note tombe dans la gamme et l'étendue | ok | 1 | 12.0 s | 2026-11-12 | `npx vitest run packages/core/src/instrument.test.ts -t "AIR-P-05" --reporter=dot` |
| AIR-P-06 | Tremblement sous la marge : au plus un changement de note | ok | 1 | 10.8 s | 2026-11-12 | `npx vitest run packages/core/src/music.test.ts -t "AIR-P-06" --reporter=dot` |
| AIR-P-07 | Une traversée, une note | ok | 1 | 10.6 s | 2026-11-12 | `npx vitest run packages/core/src/gestures.test.ts -t "AIR-P-07" --reporter=dot` |
| AIR-P-08 | Balayage montant, balayage descendant | ok | 1 | 11.4 s | 2026-11-12 | `npx vitest run packages/core/src/gestures.test.ts -t "AIR-P-08" --reporter=dot` |
| AIR-P-09 | Aucune note coincée | ok | 3 | 11.3 s | 2026-11-12 | `npx vitest run packages/core/src/instrument.test.ts -t "AIR-P-09" --reporter=dot` |
| AIR-P-10 | Voix bornées par maxVoices | ok | 1 | 8.1 s | 2026-11-12 | `npx vitest run packages/core/src/voices.test.ts -t "AIR-P-10" --reporter=dot` |
| AIR-P-11 | Ordre et causalité | ok | 4 | 8.2 s | 2026-11-12 | `npx vitest run packages/core/src/schedule.test.ts -t "AIR-P-11" --reporter=dot` |
| AIR-P-12 | Déterminisme au bit près | ok | 1 | 8.0 s | 2026-11-12 | `npx vitest run packages/core/src/pipeline.test.ts -t "AIR-P-12" --reporter=dot` |
| AIR-P-13 | Rendu : crête sous −1 dB | ok | 2 | 12.6 s | 2026-11-12 | `npx vitest run packages/audio/src/offline/render.test.ts -t "AIR-P-13" --reporter=dot` |
| AIR-P-14 | Rendu : chaque palier à 5 centièmes de la fréquence attendue | ok | 3 | 10.2 s | 2026-11-12 | `npx vitest run packages/audio/src/offline/render.test.ts -t "AIR-P-14" --reporter=dot` |
| AIR-P-15 | Rendu : silence sous −60 dB en 800 ms (2 s avec réverbération) | ok | 2 | 7.6 s | 2026-11-12 | `npx vitest run packages/audio/src/offline/render.test.ts -t "AIR-P-15" --reporter=dot` |
| AIR-P-16 | Rendu : pas de marches sur un glissé lent | ok | 3 | 8.2 s | 2026-11-12 | `npx vitest run packages/audio/src/offline/render.test.ts -t "AIR-P-16" --reporter=dot` |
| AIR-P-17 | Boucle : compensation, calage, durée exacte | ok | 3 | 7.3 s | 2026-11-12 | `npx vitest run packages/core/src/loop.test.ts -t "AIR-P-17" --reporter=dot` |
| AIR-P-18 | MIDI : aller-retour à une unité de temps près | ok | 2 | 8.9 s | 2026-11-12 | `npx vitest run packages/core/src/midi.test.ts -t "AIR-P-18" --reporter=dot` |
| AIR-P-19 | Schémas : aller-retour, altération refusée en entier | ok | 21 | 6.2 s | 2026-11-12 | `npx vitest run packages/schema/src/schema.test.ts -t "AIR-P-19" --reporter=dot` |
| AIR-P-20 | Prise : aller-retour au pas de codage, rien d'autre que des points | ok | 8 | 7.6 s | 2026-11-12 | `npx vitest run packages/schema/src/schema.test.ts -t "AIR-P-20" --reporter=dot` |
| AIR-P-21 | Rôles stables au croisement | ok | 3 | 3.9 s | 2026-11-12 | `npx vitest run packages/core/src/roles.test.ts -t "AIR-P-21" --reporter=dot` |
| AIR-P-22 | Calibration : au moins 90 % du nuage, taille minimale, dans l'image | ok | 1 | 4.1 s | 2026-11-12 | `npx vitest run packages/core/src/space.test.ts -t "AIR-P-22" --reporter=dot` |
| REC-THEREMINE | Recette §18 — les huit notes du$thérémine et leurs nombres | ok | 8 | 4.8 s | 2026-11-12 | `npx vitest run apps/bench/src/recipes.test.ts -t "recette §18 — le thérémine" --reporter=dot` |
| REC-HARPE | Recette §18 — la harpe : quatre notes, 125 ms, force 0,17 | ok | 5 | 5.7 s | 2026-11-12 | `npx vitest run apps/bench/src/recipes.test.ts -t "recette §18 — la harpe" --reporter=dot` |
| REC-PRISES | Recette §18 — les propriétés d'une prise | ok | 4 | 6.5 s | 2026-11-12 | `npx vitest run apps/bench/src/recipes.test.ts -t "recette §18 — propriétés d'une prise" --reporter=dot` |
| REC-BOUCLE | Recette §18 — la boucle de quatre mesures à 90 batt/min | ok | 2 | 6.2 s | 2026-11-12 | `npx vitest run apps/bench/src/recipes.test.ts -t "recette §18 — la boucle" --reporter=dot` |
| REC-PROP-22 | Les vingt-deux propriétés du cœur | ok | 654 | 15.9 s | 2026-11-12 | `npx vitest run packages/core/src packages/audio/src packages/schema/src packages/vision/src --reporter=dot` |
| SITE-MODELE | Le modèle et son moteur d'exécution sont servis par le site | ok | 7819105 | 74 ms | 2026-11-12 | `node scripts/preuves/controles.mjs modele` |
| SITE-TIERCE | Aucune origine tierce dans le site construit | ok | 0.73 | 15.4 s | 2026-11-12 | `npx vite build apps/web --outDir out/dist && node scripts/check-dist.mjs apps/web/out/dist` |
| SITE-BUNDLE | Le site se construit : le bundle est publiable | ok | 0.73 | 16.8 s | 2026-11-12 | `npx vite build apps/web --outDir out/dist` |
| SITE-POIDS | Le poids du chargement est mesuré | ok | 0.73 | 12.8 s | 2026-11-12 | `npx vite build apps/web --outDir out/dist && node scripts/poids-publication.mjs apps/web/out/dist` |
| E2E-CAMERA | La fausse caméra charge le modèle depuis le site | ok | 500 | 26.1 s | 2026-11-12 | `npx playwright test --config apps/web/playwright.config.ts -g "fausse caméra"` |
| CI-BUDGET | Chaque job de la CI est borné à 5 minutes | ok | — | 102 ms | 2026-11-12 | `python3 .github/ci-budget/check_timeouts.py` |
| LATENCE | Le retard est mesuré, composante par composante | ok | 50 | 20.4 s | 2026-11-12 | `node scripts/preuves/latence.mjs` |
| LICENCE-MODELE | L'état de la licence du fichier de modèle est écrit | ok | 1 | 157 ms | 2026-11-12 | `node scripts/preuves/controles.mjs licence` |
| MAIN-HUMAINE | Les étapes qui attendent une main humaine sont listées | ok | 6 | 167 ms | 2026-11-12 | `node scripts/preuves/controles.mjs main-humaine` |
| REGISTRE-MANIFESTE | Le manifeste est complet et sans secret | ok | 42 | 195 ms | 2026-11-12 | `node scripts/preuves/controles.mjs manifeste` |
<!-- /TABLEAU-PREUVES -->

La ligne « une par propriété » du tableau AIR-P-01 à AIR-P-22 est détaillée
dans `docs/preuves.json` : chaque propriété a son fichier de test, son filtre
`-t` et son attendu.

## Ce qui attend une main humaine

Certaines lignes de la recette ne se prouvent pas toutes seules : le journal
réseau du navigateur de test, le contrôle d'accessibilité automatique sur la
page publiée, la séance d'écoute, la vidéo de moins de trois minutes, et la
licence du fichier de modèle. Elles sont listées dans `docs/recette.md` (« Ce
qui demande encore une main humaine ») et le contrôle
`node scripts/preuves/controles.mjs main-humaine` vérifie qu'elles restent
listées — pour qu'elles ne disparaissent pas du tableau.

La preuve `LICENCE-MODELE` porte sur l'écriture de l'état, pas sur une licence
acquise : l'état au 12 novembre 2026 est « non établie », avec la source et la
date de la vérification dans `NOTICE.md` et `docs/journal.md`.

## La page du site

`?preuves=1` affiche le tableau : pour chaque preuve, l'état (ok ou ko, en
toutes lettres), la date, la durée, la mesure notable quand la commande en
produit une, la commande qui la rejoue, et les dernières lignes de sa sortie.

Le résultat est importé **à la compilation** (`import.meta.glob`) : la page ne
fait aucune requête, et encore moins vers une origine tierce. Le registre
reste ainsi lisible sur la page publiée, hors ligne compris.
