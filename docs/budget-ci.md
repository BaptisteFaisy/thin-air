# Budget CI — 5 min par job de PR

## La règle

Une pull request ne doit pas attendre : **chaque job de PR rend son verdict en
5 minutes au plus**. Un job qui passe son temps en CI ne prouve rien de plus
qu'un typecheck rapide et quelques propriétés — il allonge le chemin critique
de chaque PR.

La règle a deux versants :

- **job de PR** (`pull_request`, `merge_group`) : budget de 5 minutes, pas une
  seconde de plus ;
- **job hors PR** (`push`, `schedule`, `workflow_dispatch`) : le budget peut
  être plus long — le fuzz de nuit, la publication du site — mais il doit être
  **écrit explicitement** sur la ligne `timeout-minutes`, avec la raison.

Une règle que personne ne vérifie reste un souhait. Le contrôle est donc
automatique, et il échoue la CI.

## Ce que le contrôle interdit

`scripts/check-budget.mjs` relit **tous** les fichiers `.github/workflows/*.yml`
et sort en code 1 dès qu'il trouve :

| Refus | Pourquoi |
| --- | --- |
| un job **sans** `timeout-minutes` | le défaut GitHub est 360 minutes : le budget n'existe pas |
| un job de PR à **plus de 5 minutes** | le chemin critique de la PR |
| un job de PR en `continue-on-error: true` | un job de PR doit être **bloquant**, sinon le verdict ment |
| un job hors PR au-delà de 5 minutes **sans justification sur la ligne** | un budget long s'écrit, avec sa raison |

Les fautes sont rapportées avec le fichier, le job et la valeur :

```
::error::.github/workflows/ci.yml : job 'ci' : timeout-minutes: 8 > 5 (budget des PR)
```

## Où le contrôle est branché

- `.github/workflows/ci-budget.yml` — le job `ci-budget` lance
  `node scripts/check-budget.mjs` sur chaque PR ; le check `ci-budget` est
  aussi l'un des checks requis par la file Mergify. Un workflow qui sort en
  code non nul fait échouer le job.
- `.github/workflows/ci.yml` — le job `ci` lance en plus les tests du
  contrôle lui-même (`scripts/check-budget.test.ts`), pour qu'une régression
  du garde-fou soit vue avant qu'elle ne coûte une PR.

Lancer le contrôle à la main, sans CI :

```
node scripts/check-budget.mjs          # le dépôt courant
node scripts/check-budget.mjs /chemin   # un autre dépôt (dépôt témoin)
```

Les tests du contrôle :

```
npx vitest run --config scripts/vitest.scripts.config.ts scripts/check-budget.test.ts
```

`vitest.config.ts` est gelé et ne ramasse que `packages/*|apps/*` ; c'est
pourquoi le banc des scripts a son propre fichier de configuration
(`scripts/vitest.scripts.config.ts`), qui ne le touche pas.

## La sortie réelle sur le dépôt aujourd'hui

```
$ node scripts/check-budget.mjs
  ✓ .github/workflows/build.yml — 3 job(s), hors PR
  ✓ .github/workflows/ci-budget.yml — 1 job(s), PR
  ✓ .github/workflows/ci.yml — 1 job(s), PR
  ✓ .github/workflows/couche0.yml — 1 job(s), PR
  ✓ .github/workflows/deploy.yml — 2 job(s), hors PR
  ✓ .github/workflows/nightly.yml — 2 job(s), hors PR
  ✓ .github/workflows/pr-auto-merge.yml — 2 job(s), PR
  ✓ .github/workflows/sonde.yml — 1 job(s), hors PR
  ✓ .github/workflows/stale-base-guard.yml — 1 job(s), PR
  ✓ .github/workflows/triage-rouge.yml — 1 job(s), hors PR
budget CI : 10 workflow(s), 15 job(s), 0 erreur(s) — 5 min par job de PR
```

Code de sortie : **0**. Le dépôt tient la règle.

Le job `triage` de `triage-rouge.yml` est le seul hors PR à dépasser 5
minutes (25 minutes, triage et relance d'un agent) ; il porte sa justification
sur la ligne du `timeout-minutes`, comme la règle l'exige. Le job `e2e` de
`build.yml` est le seul en `continue-on-error` ; il est hors PR, où la
tolérance à l'échec est admise.

## Ce qui a remplacé quoi

Le garde-fou était un script Python (`.github/ci-budget/check_timeouts.py`)
qui lisait les mêmes workflows mais ne connaissait ni `continue-on-error`, ni
la justification d'un budget long : deux implémentations de la même règle
peuvent diverger, et c'est ce qui arrive. Il est remplacé par le contrôle
Node, seul porteur de la règle ; le job `ci-budget` appelle désormais
`scripts/check-budget.mjs`.
