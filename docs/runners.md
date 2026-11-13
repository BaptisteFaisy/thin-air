# Runners — inventaire, règle et réinscription

Les runners self-hosted du compte vivent sur une machine partagée (le r630).
Un runner n'est pas un dossier jetable : c'est une inscription côté GitHub, un
dossier de 1,1 Go, une unité systemd et un dossier de travail. Le 12 novembre,
deux runners ont été perdus parce que leurs dossiers avaient été supprimés.
Ce document dit ce qu'on a, ce qu'on ne casse pas, et comment on réinscrit.

## L'inventaire

| Nom | Dépôt | Machine | Dossier |
|---|---|---|---|
| `r630-thin-air-04` | `Tradoooo/thin-air` | r630 (`100.124.18.48`) | `~/actions-runner-thin-air-04` |

État mesuré le 12 novembre 2026 :

- GitHub : `gh api repos/Tradoooo/thin-air/actions/runners` renvoie **un**
  runner, `r630-thin-air-04`, `online`, `busy=false`, étiquettes
  `self-hosted,Linux,X64,thin-air-worker,ci-node`.
- Sur la machine : `~/actions-runner-thin-air-04` existe, avec `run.sh`,
  `.runner` (agent `r630-thin-air-04`, dépôt `Tradoooo/thin-air`, dossier
  de travail `_work04`) et `.credentials`.

Le pool du r630 est **partagé** : 57 dossiers `actions-runner-*` pour une
vingtaine de dépôts. Chaque dépôt n'a que les siens, et deux dossiers
(`actions-runner-rayon-impact-02` et `actions-runner-rayon-impact-03`) étaient
sans `run.sh` ni `.runner` : des couvertures vides, inertes, sans inscription
côté GitHub.

Le tableau ci-dessus fait foi : `scripts/check-runner-safety.mjs` le relit et
refuse de tourner s'il ne correspond pas à l'inventaire qu'il connaît.

## La règle : on ne supprime pas un dossier de runner sans vérifier qu'il est réinscriptible

1. **Un dossier de runner ne se supprime pas sur un coup de tête.** Avant de
   le toucher, vérifier que la réinscription est possible : l'archive
   `~/runner.tgz` est là, un jeton d'enregistrement s'obtient, et l'unité
   systemd se recrée. Un dossier supprimé sans cette vérification, c'est un
   runner à reconstruire, réinscrire, et revérifier — pour un dépôt qui n'a
   plus, entre-temps, de runner.
2. **Les deux runners perdus.** Trois des quatre runners déplacés à 16:13
   avaient disparu à 16:48 — dossiers et unités systemd — au moment exact où
   un autre agent enregistrait `r630-thin-air-01..04` (postmortem §2.2). Le
   geste de déplacement d'un dépôt à un autre et le geste d'enregistrement
   s'étaient marché dessus. Les dossiers ont été recréés à 17:05 depuis
   `~/runner.tgz`.
3. **Un dépôt ne touche pas aux runners d'un autre dépôt.** Le dossier
   `actions-runner-<dépôt>-<n>` appartient à un dépôt et à un seul. Ni son
   `_work`, ni son unité, ni son identité GitHub ne se déplacent pour le
   compte d'un autre dépôt. C'est aussi pourquoi le déplacement se fait par
   `repo-bootstrap/deplace-runner.sh`, qui désenregistre avant d'enregistrer.
4. **Les unités orphelines sont un signal, pas un détail.** Un dossier de
   runner supprimé alors que son unité systemd reste « active » laisse une
   unité qui tourne dans le vide. Les purger, puis réenregistrer.
5. **Revérifier plus tard, pas au moment du geste.** Après un déplacement :
   `gh api repos/<dépôt>/actions/runners`, puis la même commande un quart
   d'heure après. Un runner « online » n'est pas un runner qui écoute — seul
   `_diag/` le dit.

## Le nettoyage du workspace : ce qui est permis

Le `git clean -ffdx` d'une étape de CI nettoie le workspace du runner. Il
peut devenir une catastrophe : un motif trop large efface tout ce qui n'est
pas suivi, et un dossier de runner en fait partie. Depuis ce lot, chaque
étape de nettoyage des workflows exclut **explicitement** les dossiers de
runner :

```yaml
run: git clean -ffdx -e node_modules -e 'actions-runner-*' -e '_work*'
```

Règle simple, appliquée partout : un motif de nettoyage qui ne protège pas
explicitement les dossiers de runner est refusé.

## La réinscription — pourquoi « already configured »

Le 12 novembre, la réinscription d'un runner a échoué sur le message
« already configured » de `config.sh`. Ce message a une cause précise, et
elle est trompeuse.

**Pourquoi.** `config.sh` refuse de configurer un dossier qui porte déjà une
identité de runner : les fichiers `.runner`, `.credentials`,
`.credentials_rsaparams`, `.agent`. « already configured » ne veut pas dire
« ce runner est déjà dans le bon dépôt » ; il veut dire « ce dossier
appartient déjà à un runner, je ne le réinscris pas ». Après un déplacement
de dépôt, ou après une recréation à la main, le `.runner` résiduel pointe
encore vers l'ancien dépôt (ou porte le nom d'un autre agent) : le
reconfigurer échoue, et l'erreur ne parle que de configuration, jamais du
dépot. C'est pour cela que le geste du 12 novembre s'est arrêté là.

**La marche à suivre correcte.**

1. Arrêter l'unité du runner :
   `systemctl --user stop actions-runner-<dossier>.service`
2. Retirer l'identité résiduelle, dans le dossier du runner :
   `rm -f .runner .runner_migrated .credentials .credentials_rsaparams .agent`
3. Si le dossier a été déplacé, réparer les liens **absolus** `bin/` et
   `externals/` : ils pointent encore vers l'ancien emplacement et le
   listener ne démarre pas.
4. Enregistrer, avec un jeton d'enregistrement du dépôt
   (`gh api -X POST repos/Tradoooo/thin-air/actions/runners/registration-token`) :
   `./config.sh --url https://github.com/Tradoooo/thin-air --token <jeton> --name r630-thin-air-04 --labels thin-air-worker,ci-node --work _work04 --unattended --replace`
5. Recréer l'unité systemd utilisateur (`ExecStart=$HOME/actions-runner-<dossier>/run.sh`,
   `WorkingDirectory` le dossier du runner, `Restart=always`) et l'activer.
6. Revérifier l'inscription : `gh api repos/Tradoooo/thin-air/actions/runners`,
   puis **plus tard** (règle §2.2 ci-dessus).

`repo-bootstrap/deplace-runner.sh` fait déjà les étapes 1 à 6 dans cet ordre —
c'est lui qu'il faut utiliser pour déplacer un runner, pas un `config.sh`
lancé à la main.

## Ce que le contrôle automatique vérifie désormais

`scripts/check-runner-safety.mjs` (Node pur, sans dépendance) constate deux
choses et **ne touche à rien** : il ne supprime rien, ne redémarre rien, ne
réinscrit rien.

1. **Le dépôt.** Chaque étape de workflow qui nettoie (`git clean`,
   `rm -rf`) est listée, puis jugée. Sont refusés : un `git clean` sans
   exclusion, et tout motif qui vise `~`, `$HOME`, `..`, `_work*` ou
   `actions-runner-*`. Un motif qui protège les runners mais oublie de le dire
   est signalé comme avis.
2. **Les runners.** Pour chaque runner de l'inventaire, le dossier doit
   exister avec son `run.sh` et son `.runner`. La vérification se fait en SSH
   **en lecture seule** (un `test -d` et deux `test -f` par dossier), et
   seulement si la machine est joignable ; sinon le contrôle le dit et ne
   conclut rien. Un runner disparu fait sortir le contrôle en 1.

```bash
node scripts/check-runner-safety.mjs                # dépôt + runners (SSH, lecture seule)
node scripts/check-runner-safety.mjs --hors-reseau  # dépôt seul — c'est ce que fait la CI
```

Dans la CI, la partie dépôt est une garde du projet
(`scripts/hooks/runner-safety-guard.mjs`) : la CI n'a pas le droit de faire
du réseau (AIR-N-01), donc elle ne regarde que les motifs de nettoyage. La
constatation des runners, elle, se fait à la main, sur la machine.
