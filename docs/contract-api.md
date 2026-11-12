# Le contrat d'API publique — `core`, `audio`, `schema`, `vision`

## La règle

L'API publique de `core`, `audio`, `schema` et `vision` est **figée**.
Toute évolution passe par une modification explicite de `docs/api-surface.json`
**dans la même PR**, avec la raison dans le corps du commit.

`docs/api-surface.json` décrit, pour chaque paquet, la liste de ses exports :
le genre du symbole (`function`, `const`, `interface`, `type`, `class`), le
type écrit dans la source, et une ligne de description. C'est l'état attendu ;
le code est l'état réel. La garde compare les deux.

En clair :

- **retirer** un export, le **renommer**, ou changer **le type** d'un export
  sont des changements de contrat : ils passent par une PR qui modifie
  `docs/api-surface.json` et qui dit pourquoi ;
- **ajouter** un export est possible, mais la même PR doit le déclarer dans
  `docs/api-surface.json`, sinon la garde le refuse ;
- un changement **interne** (le corps d'une fonction, l'algorithme d'un
  filtre, l'implémentation d'un module) ne touche pas au contrat et ne demande
  rien.

La raison de cette règle est simple : les paquets sont construits en parallèle,
et `@thin-air/core` est la couture entre `vision` et `audio`. Un export qui
disparaît sous les pieds d'un autre lot casse la chaîne sans que personne ne
le voie. La garde le rend visible au premier `node scripts/check-api.mjs`.

## Ce que le contrôle interdit

`scripts/check-api.mjs` lit les `index.ts` des paquets, suit les ré-exports
(`export *`, `export { … } from`), et rend trois refus, tous en nommant le
symbole :

| Refus | Ce que ça veut dire |
|---|---|
| `export disparu` | le symbole annoncé par le contrat n'est plus exporté (retiré ou renommé) |
| `export ajouté` | le code exporte un symbole que le contrat ne déclare pas |
| `type changé` | le symbole existe, mais son type n'est plus celui du contrat (signature, annotation, ou forme d'un type) |

Un paquet présent dans `packages/` mais absent du contrat est refusé aussi :
un paquet nouveau doit être déclaré.

La garde sort **1** dès qu'un écart existe, **0** sinon. Elle n'écrit rien,
ne touche à aucun fichier, ne fait aucune requête réseau, et n'ouvre aucun
périphérique audio (AIR-N-01, AIR-N-02).

## La commande

```sh
node scripts/check-api.mjs
```

Sur un dépôt conforme, elle sort 0 et dit ce qui est figé :

```
✓ contrat d'API : 399 exports figés (audio 44, core 186, schema 56, vision 113)
```

Sur un dépôt en écart, elle sort 1 et nomme chaque symbole :

```
✗ core : export disparu — `midiToFreq` n'est plus exporté (contrat : function (midi: number) : number)
✗ vision : type changé — `openCamera` : contrat « function (options?: CaptureOptions) : Promise<MediaStream> » → code « function (options?: CaptureOptions) : Promise<MediaStream | null> »
✗ core : export ajouté — `nouvelleFonction` est exporté par le code mais absent du contrat
```

Deux options servent aux tests et au diagnostic :

- `--racine <dossier>` : vérifie un autre dépôt (c'est ainsi que
  `scripts/check-api.test.ts` travaille sur une fixture) ;
- `--liste` : écrit sur la sortie standard ce que les paquets exportent
  aujourd'hui, tabulation par tabulation — pour relire le contrat à la main
  quand on prépare une évolution.

## La place dans la CI

La commande est une étape de la CI des PR, à côté du typecheck et des tests
propriété. Dans `.github/workflows/ci.yml`, après « Gardes du projet » :

```yaml
      - name: Contrat d'API publique
        run: node scripts/check-api.mjs
```

Le job `ci` a un budget de 5 minutes : cette étape rend la main en une
seconde, elle ne compile rien et ne télécharge rien.

Le test qui couvre la garde lui-même est à côté d'elle, hors du banc gelé
`vitest.config.ts` :

```sh
npx vitest run --config vitest.contrat.config.ts
```

Il fabrique un dépôt témoin et vérifie les trois refus : un export retiré,
un export ajouté, un type modifié.

## Ce qui est figé, aujourd'hui

| Paquet | Exports figés |
|---|---|
| `core` | 186 |
| `audio` | 44 |
| `schema` | 56 |
| `vision` | 113 |
| **Total** | **399** |

Le détail, symbole par symbole, est dans `docs/api-surface.json`.
