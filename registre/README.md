# Registre d'instruments

Un instrument de Thin Air est un **fichier** (cahier §6.2, AIR-F-43), pas du
code. Ce dossier est le modèle d'un registre partageable : un simple dépôt git
(ou un dossier local) contenant des fichiers `*.json` au format
`thin-air-instrument/1`. Aucun serveur, aucun compte, aucune exécution de code
tiers — la validation est faite par le schéma, ici et chez celui qui importe.

## Arborescence attendue

```text
registre/
├── README.md            ce fichier
└── instruments/
    ├── exemple-harpe-douze.json
    └── exemple-nappe-cinq-zones.json
```

Les sous-dossiers sont parcourus récursivement ; `.git` et `node_modules` sont
ignorés. Un fichier qui n'est pas un instrument est simplement refusé, avec sa
raison.

## Règles de validité

Le schéma est **strict** : un champ inconnu fait refuser le fichier en entier,
avec la raison (jamais de valeur par défaut silencieuse). Les règles de
cohérence vérifiées sont celles de `packages/schema/src/instrument.ts` : gamme
triée sans doublon dans [0, 11], étendue ordonnée, au moins un de `range`,
`strings` ou `zones`, identifiants de zones uniques avec exactement `midi` **ou**
`degree`, et moteur sonore cohérent (`pluck` exige `decay`, `fm` exige `fmRatio`,
`drum` exige `noiseMs` et `toneHz`, `osc` interdit ces champs).

Pour vérifier un fichier avant de le proposer :

```bash
npx tsx scripts/registre.mjs registre/instruments --markdown
```

## Proposer un instrument

1. Dupliquer un exemple, le modifier.
2. Le valider avec la commande ci-dessus : un refus affiche la raison exacte.
3. Ouvrir une PR sur ce dépôt avec le fichier et sa **phrase d'origine** dans le
   corps (c'est la règle du projet : un instrument naît d'une phrase, §14.4).

## Licence

Les instruments sont des données, sous licence MIT comme le reste du dépôt ;
l'attribution de l'auteur est demandée (le nom de l'instrument et la phrase
d'origine suffisent).

## Reprendre un instrument ailleurs

Le fragment de partage produit par `scripts/registre.mjs` tient dans le fragment
d'une adresse (AIR-F-45) : il s'ouvre directement dans le site, sans serveur et
sans requête. Le registre n'est donc qu'un confort de découverte — il n'est
nécessaire à rien.
