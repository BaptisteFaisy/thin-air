# `.kiro/` — specs, steering, hooks, agents

Ce dossier fait partie du produit livré (recette §18 : « `/.kiro` présent à la
racine et non ignoré ») : il raconte comment l'instrument a été construit, et
il porte les règles que l'agent suit pendant qu'il écrit.

| Dossier | Contenu |
|---|---|
| `specs/` | Une spec par lot du cahier §14.1 : `requirements.md`, `design.md`, `tasks.md` |
| `steering/` | Les règles toujours chargées (`product`, `tech`, `structure`, `testing`, `no-sound`, `privacy`) et celles à `fileMatch` (`two-clocks`, `music-theory`, `mediapipe`, `honest-latency`), plus `release.md` en inclusion manuelle |
| `hooks/hooks.json` | Les huit gardes du cahier §14.3, toutes de type commande (aucun crédit consommé) |
| `agents/` | `luthier`, `seam-reviewer`, `wording-reviewer` |

## Les douze specs (§14.1)

| Spec | Parcours | Ce qu'elle couvre |
|---|---|---|
| `capture-vision` | Quick Spec | AIR-F-01 à 04, 06 |
| `play-space` | Quick Spec | AIR-F-05, 08, 09 ; AIR-P-01, 22 |
| `filtering` | Exigences d'abord | AIR-F-13, 15 ; AIR-P-02 |
| `gestures` | Exigences d'abord | AIR-F-12, 14, 16, 17 ; AIR-P-06, 07, 08, 21 |
| `music-mapping` | Exigences d'abord | AIR-F-18 à 20 ; AIR-P-03, 04, 05 |
| `instrument-format` | Conception d'abord | AIR-F-21, 43, 44 ; AIR-P-19 |
| `seam-and-voices` | Conception d'abord (§7.9 en entrée) | AIR-F-24, 26, 27 ; AIR-P-09 à 12 |
| `synth-engine` | Conception d'abord | AIR-F-25, 28, 29, 30 ; AIR-P-13 à 16 |
| `loop-export` | Exigences d'abord | AIR-F-34 à 40 ; AIR-P-17, 18 |
| `takes-bench` | Exigences d'abord | AIR-F-47 à 49 ; AIR-P-20 |
| `stage-ui` | Conception d'abord | AIR-F-31 à 33, 51 à 53 ; AIR-N-06 |
| `midi-out` | Quick Spec (option) | AIR-F-41 |

Chaque `requirements.md` porte son parcours en tête de front matter et cite les
identifiants d'exigences plutôt que de les réécrire. `gestures` et
`seam-and-voices` sont relues l'une contre l'autre : quatre délais s'y croisent
(grâce de 150 ms, relâchement de 300 ms sans image, maintien de 400 ms,
réarmement de 80 ms) et la question « que devient une note quand la main
disparaît pendant un maintien » est tranchée par écrit dans
`specs/gestures/design.md`, puis vérifiée dans les critères de
`specs/seam-and-voices/requirements.md`.

## Les huit hooks (§14.3)

| Hook | Déclencheur | Garde |
|---|---|---|
| `no-sound-guard` | `PreToolUse`, matcher `shell` | `scripts/hooks/no-sound-guard.mjs` |
| `core-properties` | `PostFileWrite` sur `packages/core/**` | `scripts/hooks/core-properties.mjs` |
| `render-check` | `PostFileWrite` sur `packages/audio/**`, `instruments/**` | `scripts/hooks/render-check.mjs` |
| `instrument-schema-guard` | `PostFileWrite` sur `instruments/**` | `scripts/hooks/instrument-schema-guard.mjs` |
| `take-privacy-guard` | `PostFileWrite` sur `takes/**` | `scripts/hooks/take-privacy-guard.mjs` |
| `no-audio-asset-guard` | `PostFileWrite`, tout fichier | `scripts/hooks/no-audio-asset-guard.mjs` |
| `wording-guard` | `PostFileWrite` sur `apps/web/**` | `scripts/hooks/wording-guard.mjs` |
| `journal-reminder` | `PostSpecTask` | `scripts/hooks/journal-reminder.mjs` |

Toutes les actions sont de type `command` : elles ne consomment pas de crédits.
Le `matcher` est une chaîne (nom d'outil, ou motif de chemin unique) ou une
liste de motifs ; une liste vide signifie « tous ». Les mêmes gardes sont
lancées en intégration continue par `node scripts/hooks/run-all-guards.mjs`,
qui découvre tout fichier `*-guard.mjs` de `scripts/hooks/` : une garde
ajoutée sous ce nom est prise en compte sans rien déclarer.

## Le journal du hook `no-sound-guard` — où le trouver

Chaque invocation de garde écrit une ligne JSON dans **`out/hook-log.jsonl`**
(à la racine du dépôt). `out/` est ignoré par git (`.gitignore`) : le journal
ne salit pas le diff, et il est joint à la soumission comme pièce de la recette
§18 (« le journal du hook `no-sound-guard` est joint »).

Chaque ligne porte : `garde`, `evenement` (`refus`, `acceptation`,
`aucune-commande`, `repli`), la commande ou la raison, et `at` (horodatage
ISO). Compter les refus est immédiat :

```bash
grep '"garde":"no-sound-guard"' out/hook-log.jsonl | grep '"evenement":"refus"' | wc -l
```

## Le champ de la commande, dans `tool_input` (annexe D)

Le cahier marque « à vérifier » le nom exact du champ qui porte la commande
dans le JSON que Kiro dépose sur l'entrée standard du hook. `no-sound-guard`
accepte donc **les trois formes** — `tool_input.command`, `tool_input.cmd`,
`tool_input.input` — et une entrée qui serait une chaîne nue. Ce choix est
écrit dans `scripts/hooks/lib/io.mjs` (`commandeDeLaChargeUtile`) : une fois le
premier déclenchement réel observé, la liste se réduira au champ confirmé.

## Les gardes qui dépendent d'un autre lot

`render-check` (banc d'essai et prises de référence : lot B3) et
`core-properties` (bancs de `packages/core`, lots A1 à B2) **sortent 0 et
disent « repli »** tant que leur banc n'existe pas, ou tant que le squelette
lève `TODO(module)`. Un repli est écrit dans le journal : il ne fabrique jamais
de fausse preuve en silence.
