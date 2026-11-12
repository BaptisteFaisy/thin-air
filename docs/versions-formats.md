# Les formats de fichiers, versionnés et datés

Trois formats sortent du dépôt : l'instrument (`thin-air-instrument/1`), la
prise (`thin-air-take/1`), la séance (`thin-air-session/1`). Chacun porte un
numéro, et ce numéro veut dire quelque chose : il dit ce qu'un lecteur d'il y
a six mois peut encore lire.

- Politique en vigueur depuis le 2026-11-12.
- Fenêtre de lecture : **6 mois** après la date de dépréciation.

## La règle

1. **Un format incompatible crée un nouveau numéro.** Ce qui est incompatible
   est écrit noir sur blanc : un champ supprimé ou renommé, un type qui change,
   une valeur qui change de sens, une validation qui devient plus stricte. Un
   lecteur d'un format ancien qui ouvre un fichier du format nouveau doit
   pouvoir dire « je ne connais pas ce format » plutôt que « j'ai mal lu ».
2. **Un ajout compatible garde le numéro.** Un champ optionnel, une valeur
   d'énumération dont le défaut est l'ancien comportement : le fichier reste
   lisible par les lecteurs d'avant, donc le numéro ne bouge pas.
3. **L'ancien format reste lu pendant la fenêtre de lecture**, six mois à
   compter de la date de dépréciation. Passé ce délai, le lecteur le refuse.
   Le lecteur qui écrit, lui, écrit toujours le format le plus récent.
4. **La dépréciation s'écrit à trois endroits**, et aux trois :
   - le **registre** ci-dessous (statut, date de dépréciation, date de fin de
     lecture) ;
   - le **changelog** (`CHANGELOG.md`, section `Changed`) ;
   - le **schéma** : la constante `*_FORMAT` de `packages/schema/src/vocab.ts`
     reste exportée et acceptée pendant toute la fenêtre, puis disparaît au
     moment où le registre et le changelog disent que la fenêtre est finie.
5. **Une dépréciation n'est jamais un oubli.** Elle s'annonce avant qu'elle
   ne coûte : le registre porte la date, le changelog porte l'annonce, et le
   contrôleur `scripts/check-format-versions.mjs` refuse qu'une des trois
   manque.

## Le registre

Une section par format, dans l'ordre du vocabulaire. Le contrôleur lit ce
registre : une constante du vocabulaire sans section ici est un échec, et une
section ici sans constante dans le vocabulaire est un échec aussi — c'est le
signe qu'une fenêtre de lecture s'est terminée sans que l'ancien format
parti.

### `thin-air-instrument/1`

- Statut : actuel
- Déclaré par : `INSTRUMENT_FORMAT` (`packages/schema/src/vocab.ts`)

### `thin-air-take/1`

- Statut : actuel
- Déclaré par : `TAKE_FORMAT` (`packages/schema/src/vocab.ts`)

### `thin-air-session/1`

- Statut : actuel
- Déclaré par : `SESSION_FORMAT` (`packages/schema/src/vocab.ts`)

## Écrire une dépréciation

Exemple, pour la forme :

```markdown
### `thin-air-take/2`

- Statut : déprécié
- Déprécié le : 2027-02-15
- Fin de lecture : 2027-08-15
- Déclaré par : `TAKE_FORMAT` (`packages/schema/src/vocab.ts`)
```

Le format `/2` ci-dessus est un exemple de forme, pas un format du dépôt :
tant qu'aucune constante `TAKE_FORMAT` ne vaut `thin-air-take/2`, le
contrôleur refuse cette section. Un format qui n'existe pas encore ne se
déprécie pas ; il se crée, et il est écrit dans le registre avec son statut
« actuel ».

Quand la fenêtre se ferme, trois gestes vont ensemble, dans le même lot :

1. la constante `*_FORMAT` qui vaut l'ancien numéro disparaît du vocabulaire ;
2. la section du registre disparaît ;
3. le changelog dit que la fenêtre est finie.

Le contrôleur refuse un dépôt où un seul des trois a été fait : c'est le
moyen de ne pas laisser un format lu par personne et annonce par personne.

## Comment vérifier

```bash
node scripts/check-format-versions.mjs            # le dépôt, code 0 ou 1
node --test scripts/check-format-versions.test.mjs # les cas du contrôleur
```

Le contrôleur lit trois fichiers et n'écrit rien : le vocabulaire
(`packages/schema/src/vocab.ts`), le registre (`docs/versions-formats.md`) et
le changelog (`CHANGELOG.md`). Il ne lit aucun code TypeScript — il lit le
fichier source, comme il le ferait à la ligne — et il ne fait aucune requête
ni aucun son (AIR-N-01, AIR-N-02).

La version du paquet, elle, ne suit pas cette règle : elle reste en `0.x`
tant que l'API n'est pas stabilisée. Les deux numéros sont distincts, et le
changelog dit lequel est lequel.
