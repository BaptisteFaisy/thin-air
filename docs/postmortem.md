# Post-mortem du chantier — Thin Air

Ce que le chantier a coûté, ce qu'il a appris, ce qui reste vrai. Écrite le
2026-11-12, dans le worktree `v8-postmortem`, branche `lot/v8-postmortem`.

**D'où viennent les faits.** Trois sources, citées partout où elles sont
utilisées :

- `docs/journal.md` — le récit du chantier, jour par jour ;
- `docs/submission.md` — le tableau des défauts attrapés et l'annexe des
  commandes qui ont produit les chiffres ;
- `docs/recette.md` — l'état des vingt-deux propriétés et des lignes chiffrées.

Pour les incidents d'infrastructure, qui ne sont écrits nulle part dans le
dépôt : les **notes de chantier de la machine** du 2026-11-11 et du 2026-11-12
(hors dépôt), que ce document cite explicitement, et les traces vérifiables
dans le dépôt lui-même (titres et corps de PR, messages de commit).

**Règle de rédaction.** Aucun chiffre n'est inventé : les nombres viennent
d'une commande exécutée (section 4 les liste toutes) ou d'un document cité. Le
journal n'est pas recopié — il est cité, et le récit est écrit ailleurs.

---

## 1. Les défauts

### 1.1 Ce que les tests ont attrapé

Huit défauts, tous trouvés en exécutant quelque chose, jamais en relisant le
code. Les six premiers sont dans le tableau de `docs/submission.md` (« What the
tests caught »), qui porte pour chacun la cause en une ligne ; ici on ajoute
comment il a été trouvé et ce qui l'aurait évité.

**1. Le miroir absent des prises de synthèse.**
Symptôme : la prise `slow-rise` faisait *descendre* la hauteur au lieu de la
monter, et le thérémine ne donnait qu'une note (midi 70) au lieu des huit
attendues.
Cause : `apps/bench/src/synth.ts` avait sa propre conversion `u → x`, sans le
miroir du §7.4 — une deuxième implémentation de la même convention.
Trouvé : la recette rejoue les exemples chiffrés du cahier (§18), via
`npx tsx apps/bench/src/cli.ts events --take takes/reference/slow-rise.json
--instrument instruments/phantom.json` (commande reprise dans `docs/recette.md`).
Corrigé : la conversion est déléguée à `takeGen.uToImageX` / `vToImageY`, une
seule implémentation dans le dépôt, plus un test d'aller-retour.
L'aurait évité : la règle « une logique = une implémentation » appliquée à la
lettre — `apps/bench/src/synth.ts` ne pouvait pas refaire une conversion que
`core` possédait déjà.

**2. Le balayage qui suivait la paume au lieu de l'index.**
Symptôme : le balayage de cordes donnait les cordes 4, 5, 6, 7 au lieu de 3,
4, 5, 6.
Cause : `sweepTake` plaçait le centre de la paume là où le §7.14 déplace le
bout de l'index — un décalage d'une corde.
Trouvé : la même relecture chiffrée de la recette (`events` sur la prise
`harp-sweep.json`), le cahier donnant les numéros attendus.
Corrigé : `sweepTake` compense maintenant par `indexTipOffsetU`, *mesuré* et
non deviné ; résultat, cordes 3, 4, 5, 6 et notes 57, 60, 62, 65.
L'aurait évité : des critères d'acceptation pris dans les nombres du cahier,
pas dans une description en mots.

**3. Le réglage `magnet` refusé (`typeof null === "object"`).**
Symptôme : `--settings '{"magnet":1}'` était rejeté ; aucun nombre ne pouvait
passer.
Cause : le validateur comparait au *type de la valeur par défaut*, or `magnet`
vaut `null` par défaut et `typeof null` est `"object"` en JavaScript.
Trouvé : la commande de recette ci-dessus, exécutée avec un réglage non
défaut — le cas n'était couvert par aucun test.
Corrigé : les réglages « nombre ou `null` » sont traités comme tels.
L'aurait évité : un test de validateur par *forme* de valeur (nombre, `null`,
chaîne, booléen) et non par réglage par défaut.

**4. La fréquence moyenne mesurée sur une voix continue.**
Symptôme : le rapport de rendu annonçait 390 Hz là où un sol à 196 Hz était
attendu — un nombre qui ne voulait rien dire.
Cause : le rapport moyennait sur toute la voix ; or un thérémine est une voix
continue dont la hauteur glisse, et `noteOn → noteOff` ne fait qu'un palier de
4 200 ms.
Trouvé : la lecture du rapport (`render` puis `bench-out/report.json`) contre
les fréquences du cahier.
Corrigé : le rapport découpe la voix à chaque contrôle de hauteur
(`noteSteps`) et mesure chaque palier après une garde de 80 ms ; écart
maximal obtenu **3,05 centièmes** pour une tolérance de 5 (`docs/recette.md`).
L'aurait évité : une protocole de mesure écrit *par palier* — une moyenne sur
une voix qui glisse est fausse par construction.

**5. La note de zone jamais libérée (`leave` en phase « end »).**
Symptôme : quitter une zone du chœur ne relâchait pas la note — une note
coincée.
Cause : le geste `leave` arrive en phase « end », et le mapping `hold` n'agissait
qu'en phase « start ».
Trouvé : la chaîne de bout en bout, sur la prise figée
`takes/reference/hand-leaves-mid-note.json` (ligne « aucune voix active à la
fin » de `docs/recette.md`).
**Ce que les tests n'ont pas attrapé :** la propriété AIR-P-09 (« aucune note
coincée ») était verte — `end()` relâche tout à la fin de la prise, donc le
test unitaire voyait un état propre.
Corrigé : le mapping `hold` traite aussi la phase « end ».
L'aurait évité : tester l'état *au milieu* de la prise, pas seulement à la fin.

**6. L'instant qui reculait d'un ulp.**
Symptôme : un événement daté *juste avant* le précédent — interdit par
AIR-P-11.
Cause : le calcul de rampe pouvait retomber à un ulp près sous le dernier
instant émis (arrondi en virgule flottante).
Trouvé : la propriété AIR-P-11 (`schedule.test.ts`, `instrument.test.ts`), qui
est exacte et non approximative.
Corrigé : `ordonner` (`packages/core/src/instrument.ts`) ramène tout instant
inférieur au dernier émis à celui-ci.
L'aurait évité : imposer la monotonie par construction (clamp dès l'écriture
d'`ordonner`) plutôt que de la laisser au test — la propriété, elle, est
exacte et sans tolérance, ce qui est précisément la raison pour laquelle un
ulp ne lui échappe pas.

**7. Le pincement déclenché par une vitesse non finie.**
Symptôme : deux images au même horodatage faisaient apparaître un pincement.
Cause : il en résultait un `NaN`, et `NaN < seuil` est faux en JavaScript —
le seuil ne protégeait plus.
Trouvé : les tests, pas la relecture (journal, première journée).
Corrigé : la vitesse non finie est traitée avant comparaison.
L'aurait évité : des cas de test dégénérés (deux images identiques).

**8. Les rôles échangés au croisement des mains.**
Symptôme : les deux mains échangeaient leur rôle en se croisant.
Cause : l'appariement se faisait par seule proximité.
Trouvé : les tests ; AIR-P-21 exige désormais le côté anatomique comme clé
principale, la proximité ne départageant que deux mains du même côté.
L'aurait évité : la clé d'identité du cahier posée *avant* le code
d'appariement.

### 1.2 Ce que les tests n'ont pas attrapé

Sept défauts que les tests de code ne pouvaient pas voir : ce sont les gardes,
la CI, ou une relecture ciblée qui les ont trouvés.

**9. Le README qui citait les mots interdits.**
Symptôme : le garde de vocabulaire a refusé le README — en refusant sa propre
justification, qui citait l'expression interdite du §5.4 pour l'expliquer.
Cause : la règle était décrite en citant les mots qu'elle interdit.
Trouvé : la garde `wording-guard` (elle tourne dans la CI et en local).
Corrigé : la règle est décrite sans citer les mots.
L'aurait évité : écrire la règle *en termes de ce qu'il faut dire*.

**10. Le verrou npm désynchronisé des espaces de travail.**
Symptôme : `npm ci` refusait de tourner — donc **aucune** PR ne pouvait rendre
de verdict.
Cause : le verrou ne correspondait pas aux espaces de travail déclarés.
Trouvé : `npm ci` dans la CI, avant tout lot (journal, « Ce que la CI a
refusé »).
Corrigé : avant le chantier.
L'aurait évité : `npm ci` exécuté une fois sur la machine, hors CI, dans la
branche de départ.

**11. Le changement de mode de fichier non déclaré.**
Symptôme : une PR a été refusée alors que son code était correct.
Cause : npm avait posé un mode `100644 → 100755` sur un fichier ; la section
`## Scope` de la PR ne le mentionnait pas, et `couche0` compte les modes.
Trouvé : la garde `couche0` (contrôle de périmètre).
Corrigé : le mode est déclaré ; les artefacts d'outils ne sont plus posés
par les lots de code.
L'aurait évité : `git diff --summary` dans la PR, ou une garde qui signale
tout changement de mode.

**12. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`.**
Symptôme : le premier run de la PR d'outillage a dépassé le budget de 5
minutes.
Cause : Playwright est une dépendance de développement dont le script
d'installation télécharge les navigateurs — et les runners les téléchargent à
chaque `npm ci`.
Trouvé : le dépassement de budget mesuré par `ci-budget`.
Corrigé : `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` coupe ce téléchargement dans les
trois workflows qui installent les dépendances ; les preuves de bout en bout
tournent sur le poste, pas dans la CI des PR (commit `3ab1915`).
L'aurait évité : la règle « les dépendances de développement ne téléchargent
rien » écrite dans le contrat de construction avant d'ajouter Playwright.

**13. Le trou dans le garde `no-sound-guard`.**
Symptôme : un navigateur de test lancé avec une configuration JSON
`{"headless": false}` passait le garde — donc avec écran, contraire au §14.3.
Cause : les marques d'écran ne couvraient que les formes nues
(`headless: false`).
Trouvé : le test du garde lui-même, lancé en processus enfant (commit
`c1c92e2`).
Corrigé : les formes JSON sont ajoutées aux marques ; le refus de l'écran
prime toujours sur le son coupé (commit `052ce33`).
L'aurait évité : tester un garde comme on teste du code — c'est du code.

**14. La garde des prises qui refusait les sessions.**
Symptôme : la garde de vie privée refusait la session de boucle (format
`thin-air-session/1`) placée sous `takes/pieces/`.
Cause : la garde exigeait le format de prise pour tout `.json` du dossier.
Trouvé : la garde, sur le dépôt lui-même.
Corrigé : la garde écarte les sessions et continue d'exiger le format de prise
pour tout le reste de `takes/` (commit `b5edfc9`).
L'aurait évité : lire la spec des formats avant d'écrire la garde.

**15. Le contrôle des origines qui subissait le code tiers.**
Symptôme : le premier run de `deploy.yml` sur `main` a échoué sur
`https://odml.pa.googleapis.com`, trouvé dans le paquet MediaPipe découpé par
Vite.
Cause : c'est l'adresse que MediaPipe utilise quand on lui donne un *nom* de
modèle à télécharger ; le site lui donne un chemin local, donc elle n'est
jamais résolue — mais un contrôle purement textuel ne peut pas le prouver.
Trouvé : le premier run du workflow de publication.
Corrigé : le code tiers servi est exclu du contrôle des origines — la liste
des fichiers exclus est imprimée à chaque run — et reste couvert par le
contrôle des fichiers sonores (commit `ef30888`).
L'aurait évité : la question « qu'est-ce que mon contrôle prouve
exactement ? » écrite dans la spec du workflow.

### 1.3 Ce qu'aucun contrôle ne peut attraper

- **La licence du fichier de modèle** : établie pour le code (Apache 2.0),
  elle ne l'est pas pour `hand_landmarker.task`. Aucun test ne peut établir
  une licence ; seule une source officielle — ou une main humaine qui ouvre
  la carte du modèle — le peut (journal, lot N1 ; la ligne reste ouverte dans
  `docs/recette.md`).
- **L'infrastructure** : file bloquée, runners disparus, fournisseur figé.
  Aucun de ces trois événements ne se voit dans un diff. C'est le sujet de la
  section 2.
- **La fiabilité d'un verdict de CI** : un run « zombie » (queued, 0 job) ne
  crée aucun check-run — les checks requis manquent *à jamais* et la PR reste
  bloquée ; à l'inverse, un run rouge sur 63 fichiers peut venir de la
  saturation des runners et non du code. Un verdict de CI n'est pas une
  preuve de correction tant que son origine n'est pas établie.

---

## 2. Les incidents d'infrastructure

### 2.1 La file GitHub Actions bloquée au niveau du compte

Ce qui s'est passé, dans l'ordre, avec les mesures.

**Le symptôme côté dépôt.** Les runs restaient `queued` et ne déclenchaient
aucun job (`total_count: 0`), alors que les runners étaient annoncés
`online` et `busy=false`. Sur ce dépôt, la trace est dans le titre de la PR
#52 : « *wip(n3-poids): travail repris et sauvé (file Actions bloquée, checks en
attente)* », mergée à 2026-11-11T22:25:00.000Z.

**La mesure, au niveau du compte.** Notes de chantier du 2026-11-11T21:50:00.000Z :
mes jobs restaient `queued` avec 4 runners `online/idle` et une machine à
charge 2. Cause mesurée : les autres dépôts du compte avaient respectivement
**16, 16, 20, 13, 10, 8, 7, 5 et 3** runs `queued` chacun, et presque aucun
`in_progress` (`gh api repos/<r>/actions/runs?status=queued`). Rien à faire
côté dépôt : attendre. Conclusion retenue : **le premier réflexe est de
vérifier un autre dépôt du compte**, pas de chercher une cause locale. La même
soirée, GitHub a publié « *major — Partial System Outage* » sur sa page
d'état ; dans une autre fenêtre, la page d'état était verte alors que tous les
dépôts du compte étaient touchés de la même façon.

**Le redémarrage qui ne change rien.** Redémarrer les runners
(`systemctl --user restart actions-runner-*.service`) ne débloquait rien tant
que la panne était chez GitHub : la cause n'était pas locale. Le même geste,
lui, était le remède d'un *autre* incident, purement local : les journaux
`~/actions-runner-<repo>-01/_diag/Runner_*.log` montraient `SocketException
(125)` puis « *Back off 8 812 seconds before next retry* » — le listener se
reculait de 9 000 000 ms pendant que l'API continuait d'annoncer le runner en
ligne. Un runner « online » n'est pas un runner qui écoute : seul `_diag/` le
dit.

**Les runs zombies (2026-11-12).** Runs au statut `queued`, **0 job**,
non annulables (« *cannot cancel a run that is completed* »), non rejouables
(« *workflow is already running* ») : ils ne créent **aucun check-run**, donc
les checks requis manquent à jamais et les PR restent `blocked`. Bilan de la
mission de déblocage : **11 PR** à remettre au vert. Contournement retenu :
relancer le workflow à la main sur la tête de branche
(`gh workflow run <wf>.yml --ref <branche-head>`), et ré-armer `couche0` avec
`-f pr=<n>`.

**Le job orphelin.** Pendant la panne, un run `ci` dont les douze étapes étaient
`success` restait `in_progress` (runner redémarré trop tard pour remonter la
fin). Ni `gh run cancel`, ni `force-cancel`, ni la suppression de
l'enregistrement du runner ne le débloquaient : il gardait son groupe de
concurrence `ci-<n>`, et toute la CI du dépôt restait derrière lui.

**Les pièges de la reprise.** Deux, mesurés le même jour :

- les runs restés en file depuis la panne se réveillaient et **annulaient les
  runs frais** via `concurrency` (`cancel-in-progress`) : le check requis
  passait en `cancelled` alors que le code était bon. Remède : annuler
  d'abord les runs `queued` périmés, *puis* `gh run rerun` ;
- la saturation des runners produit un faux rouge : « *vitest-worker Timeout
  calling fetch* » sur 63 fichiers n'est pas un défaut de code, mais de la
  saturation — `gh run rerun <run-id> --failed` quand la machine respire.

**La file qui s'affame elle-même.** Le workflow `pr-auto-merge` ouvrait une
matrice « sweep » d'un job par PR ouverte, y compris sur les branches
`mergify/merge-queue/**` ; avec 4 workers, le balayeur mangeait les runners et
le `ci` du lot attendait 1 200 000 ms. Palliatif : `gh workflow disable
pr-auto-merge.yml` pendant que la file passe, puis `enable`. Mergify est de
toute façon le seul pilote de merge du dépôt.

### 2.2 Les runners passés `offline`

**La collision entre agents.** Le pool de runners du r630 est partagé, sans
coordination. Trois des quatre runners déplacés à 2026-11-12T15:13:00.000Z avaient disparu à
2026-11-12T15:48:00.000Z — dossiers et unités systemd — au moment exact où un autre agent
enregistrait `r630-thin-air-01..04`. Ils ont été recréés à 2026-11-12T16:05:00.000Z depuis
`~/runner.tgz`. Le déplacement des runners d'un dépôt au repos, acté au
journal (« *runners auto-hébergés déplacés depuis des dépôts au repos* »), est
donc à l'origine du heurt.

**La règle qui en découle :** après un déplacement, revérifier
`gh api repos/<repo>/actions/runners` — et le revérifier plus tard, pas au
moment du geste.

**Les unités orphelines.** Un autre cas observé : des dossiers de runner
supprimés alors que les unités systemd restaient « active ». Les purger, puis
ré-enregistrer.

**État mesuré ce jour.** `gh api repos/BaptisteFaisy/thin-air/actions/runners`
renvoie **un** runner en ligne, `r630-thin-air-04` (`busy=true` au moment de la
mesure) : le dépôt n'a plus qu'un runner pour ses checks.

### 2.3 Les figeages du fournisseur de modèle sur les sous-agents

**Le phénomène.** Sur le fournisseur `combo/cheap` partagé ce jour-là, des
sous-agents se figeaient : aucune activité pendant 1 800 000 ms, dernier outil
appelé à l'heure du lancement, aucun fichier écrit. Les proportions
observées, notées le 2026-11-11 sur des chantiers voisins utilisant le même
fournisseur :

- **9 sur 12** agents figés sur un chantier (12 lancés d'un coup) ;
- **environ 4 sur 12** figés sur un autre ;
- **1 sur 1** figé sur un troisième (5 outils en 20 000 ms, 0 fichier écrit), repris
  à la main en ~1 500 000 ms ;
- **7 agents** sans un seul fichier écrit en 2 400 000 ms sur un quatrième,
  annulés et refaits à la main en ~3 600 000 ms.

**Ce que cela a coûté sur ce dépôt.** Quatre lots ont dû être repris à la
main par l'intégrateur, et deux PR ont été ouvertes en « wip » par lui :

| Trace | Lot |
|---|---|
| commit `c86ec78` | lot B2, mapping des gestes en événements |
| commit `726dc7f` | lot n7, prises |
| commit `7a7fdc1` | lot n3, poids du modèle |
| commit `590eff6` | lot w10, pièce de démonstration |
| PR #52 | « *travail repris et sauvé (file Actions bloquée, checks en attente)* » |
| PR #53 | « *travail repris et sauvé* » |

Le corps de la PR #52 dit le reste : « *Lot interrompu par une panne du
fournisseur de modèle, repris et poussé par l'intégrateur. Le typecheck passe
en local.* » — la preuve disponible était le typage local, pas un verdict de
CI, parce que la file était bloquée au même moment (§2.1). Les deux incidents
se sont superposés sur la même heure.

**Le temps, compté sans inventer.** Sur 13 lots (A1–A8 et B1–B5,
`docs/CONTRACT.md`), 4 ont exigé une reprise manuelle. Le chantier complet a
occupé **28 800 000 ms** d'horloge mur (premier commit
2026-11-11T14:45:25.000Z, dernier 2026-11-11T22:02:36.000Z, `docs/submission.md`), en parallèle d'autres chantiers qui partageaient
le même fournisseur et les mêmes runners. Le lendemain, remettre au vert les
PR restantes a demandé une mission entière (11 PR).

**Les règles sorties de là, le jour même.** Au plus 4 à 6 agents en vol ;
brief écrit dans un fichier et prompt court ; « écrire le premier fichier dans
les 3 premières actions » ; un commit local après chaque fichier ; et, après
900 000 ms sans fichier écrit, reprendre la main. Un agent figé n'est pas
perdu s'il a commité : on pousse sa branche et on ouvre la PR à sa place.

---

## 3. Ce que ça change pour la prochaine fois

Cinq règles, chacune tirée d'un incident ci-dessus.

**Règle 1 — Le contrat écrit avant le chantier, et une seule implémentation
par logique, nommée dans le contrat.**
Justification : les défauts 1 et 2 sont deux versions de la même convention
écrites à deux endroits ; `docs/CONTRACT.md` (propriété exclusive des
fichiers, signatures figées) est précisément ce qui a permis à 13 lots de
travailler en parallèle sans se marcher dessus. Un lot qui a besoin de la
conversion d'un autre lot l'importe ; il ne la réécrit pas.

**Règle 2 — Vérifier une PR de bout en bout avant d'en ouvrir dix.**
Justification : 11 PR sont restées bloquées par des runs zombies (§2.1) ; le
budget CI a été dépassé au premier run de la PR d'outillage (défaut 12) ; le
contrôle des origines a chuté au premier run du workflow de publication
(défaut 15). Un lot n'est terminé que lorsque ses checks sont *créés*,
*rendus* et *mergés* — pas lorsque le code est écrit.

**Règle 3 — Des lots plus petits, et la main reprise à la main après 15
minutes sans écriture.**
Justification : 9 agents sur 12 figés sur un chantier, 4 sur 12 sur un autre,
4 lots repris sur celui-ci (§2.3). Un agent figé coûte moins cher à annuler
qu'à attendre ; un agent qui a commité reste récupérable.

**Règle 4 — Une garde de périmètre qui compte les modes et les fichiers
générés, et un verrou npm que personne ne touche.**
Justification : une PR refusée pour un mode `100755` non déclaré (défaut 11) ;
un `npm ci` qui ne tourne plus, donc aucune PR sans verdict (défaut 10). Tout
ce qu'un outil pose — verrou, modes, artefacts — est déclaré dans le `## Scope`
ou exclus des lots de code.

**Règle 5 — Diagnostiquer l'infrastructure au niveau du compte, et lire les
journaux des runners avant de toucher au code.**
Justification : la file était bloquée pour tout le compte (16, 16, 20, 13, 10,
8, 7, 5, 3 runs en attente ailleurs) pendant que chaque dépôt ressemblait à
un problème local ; « online » ne voulait pas dire « à l'écoute » (`SocketException 125`,
« Back off 8 812 seconds », visible seulement dans `_diag/`) ; les runners
disparaissaient parce que le pool est partagé sans coordination (§2.2).
Ordre de diagnostic : page d'état GitHub → un autre dépôt du compte →
`gh api repos/<r>/actions/runs?status=queued` → journaux `_diag/` → seulement
ensuite, le code.

---

## 4. Ce qui reste vrai malgré tout

Mesuré dans ce worktree le 2026-11-12, commandes exécutées. Les chiffres de la
section « citation » ne sont pas re-mesurés ici : ils sont repris du document
qui les a produits.

### 4.1 Mesuré ici, maintenant

| Grandeur | Valeur | Commande |
|---|---|---|
| PR mergées | **43** | `gh pr list --state merged --limit 300 --json number --jq 'length'` |
| Commits sur `origin/main` | **89** | `git rev-list --count origin/main` |
| Tests | **1 131 passés, 22 `todo`** (1 153 au total), 80 fichiers | `npx vitest run` |
| Propriétés musicales distinctes testées | **22** (AIR-P-01 à AIR-P-22) | `grep -rho 'AIR-P-[0-9]*' packages apps --include='*.test.ts' \| sort -u \| wc -l` |
| Lignes de code `.ts` / `.tsx` / `.mjs` (hors `node_modules`) | **38 069** | `find . -path ./node_modules -prune -o -path './.git' -prune -o -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' \) -print \| xargs wc -l \| tail -1` |
| Fichiers d'instrument | **6** | `ls instruments/*.json \| wc -l` |
| Prises de référence figées | **7** | `ls takes/reference/*.json \| wc -l` |
| Lots repris à la main (commits `wip`) | **4** | `git log --oneline --grep='^wip(' origin/main` |
| PR `wip` mergées | **2** (#52, #53) | `gh pr list --state merged --search "wip in:title" --json number,title` |
| Runners en ligne sur le dépôt | **1** (`r630-thin-air-04`, `busy=true` à la mesure) | `gh api repos/BaptisteFaisy/thin-air/actions/runners --jq '.runners[] \| {name,status,busy}'` |
| Gardes du projet | **toutes vertes** (code de sortie 0) | `node scripts/hooks/run-all-guards.mjs` |

### 4.2 Cités, pas re-mesurés

| Grandeur | Valeur | Source |
|---|---|---|
| Durée du chantier | 28 800 000 ms (2026-11-11T14:45:25.000Z → 2026-11-11T22:02:36.000Z) | `docs/submission.md`, annexe |
| Écart maximal de justesse | 3,05 centièmes (tolérance 5) | `docs/recette.md` |
| Crête du rendu | −35,3 dB (plafond −1 dB) | `docs/recette.md` |
| Silence après la sortie des mains | 723 ms (cible ≤ 800 ms) | `docs/recette.md` |
| Traîne du filtre | 87 ms en moyenne (0 à 110) | `docs/recette.md` |
| Prise brute / compactée | 64–127 Ko/s → 18 Ko/s (une main), 35 Ko/s (deux) | `docs/journal.md` |
| Poids du modèle | 7 819 105 octets (+ 13,93 Mo d'exécution) | `docs/journal.md` |
| Budget CI | 39 000 ms à 161 000 ms par job | `docs/recette.md` |
| Licence du fichier de modèle | **non établie** à ce jour | `docs/journal.md`, lot N1 |

Ces nombres sont ceux du chantier : ils sont dans le dépôt, avec la commande
qui les a produits. Ils n'ont pas bougé parce que le post-mortem n'a rien
changé au code — la seule ligne ajoutée est celle-ci, et le diff se limitera à
`docs/postmortem.md`.
