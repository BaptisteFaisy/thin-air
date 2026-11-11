# instrument-format — Conception

## La forme est un choix unique, pas un empilement

`range`, `strings` et `zones` sont **exclusifs** : un instrument continu
(Phantom, Drone) a une étendue ; un instrument à cordes (Harp) a un nombre de
cordes ; un instrument à zones (Choir, Bells, Grid drums) a des rectangles.
Un fichier qui en porte deux décrit deux instruments à la fois, et le moteur
devrait choisir : c'est exactement le genre d'ambiguïté qu'un format doit
refuser.

## Ce qui est un nombre, ce qui est une référence

- Les hauteurs sont des **numéros MIDI absolus** (`midi`) ou des **degrés de la
  gamme** (`degree`), jamais des hertz : un instrument change de fondamentale
  sans réécrire ses zones.
- Les positions sont normalisées dans la zone de jeu (`u`, `v` de 0 à 1), pas
  en pixels : le même fichier marche sur toutes les caméras.
- Les correspondances (`FeatureMap`) nomment une mesure (`u`, `v`, `pinch`,
  `open`, `speedU`, `speedV`), une cible (`pitch`, `gain`, `cutoff`, `vibrato`),
  une courbe (`linear`, `db48`) et ses bornes (`from`, `into`). Une
  correspondance ne contient pas de code : c'est une donnée, donc elle se
  partage (`AIR-F-45`).
- Les gestes (`GestureMap`) nomment un geste et une action (`pluck`, `damp`,
  `mute`, `hold`, `strike`) — la même liste que `GestureAction` du contrat.

## La règle du fichier (Phantom comme exemple, §11.4)

```json
{ "hand": "pitch", "feature": "pinch", "to": "vibrato",
  "from": [0.4, 0.1], "into": [0, 40] }
```

`from` est l'intervalle **d'entrée** lu dans l'ordre décroissant (une pince
fermée vaut 0,1, une pince ouverte 0,4) et `into` l'intervalle de sortie (0 à
40 centièmes). Les deux paires sont obligatoires et distinctes : la validation
refuse une paire aux bornes égales.

## Validation en trois couches

| Couche | Qui | Ce qu'elle apporte |
|---|---|---|
| 1. Structure | `scripts/hooks/instrument-schema-guard.mjs` | clés connues, types, bornes, formes exclusives — utilisable sans dépendance, donc dès le premier jour |
| 2. Schéma | `packages/schema/src/instrument.ts` (Zod, lot A4) | la même règle, typée, avec `ParseResult` et les raisons |
| 3. Rendu | `render-check` (banc, lot B3) | un fichier valide qui sonne faux est un instrument faux : les rapports le disent |

Les trois couches partagent la même liste de clés (`lib/instrument-schema.mjs`
la tient) : une deuxième liste écrite ailleurs serait une duplication, et deux
listes divergent toujours.

## Le lien (AIR-F-45)

L'instrument tient dans le fragment d'une adresse. Puisque le format est du
JSON compact et que les six fichiers font moins de 2 Ko, un encodage base64url
du JSON suffit ; le fragment n'est jamais envoyé à un serveur (AIR-N-01), ce
qui est le comportement naturel d'un `#`.

## Les six instruments, et ce qu'ils ont en commun

Tous portent `"format": "thin-air-instrument/1"`, un `snap`, un nombre de voix
au plus égal à `maxVoices` (8), et un `sound` dont le moteur est un des quatre
du type (`osc`, `pluck`, `fm`, `drum`). C'est la propriété vérifiée par le banc
`instruments.test.ts` du lot A7.
