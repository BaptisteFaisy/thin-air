# Prises de référence (cahier §13.3)

Sept prises fixes, chacune fabriquée par un générateur de `@thin-air/core`
(`takeGen.ts`, lot B1) et figée ici en JSON. Ce sont elles qui portent la
recette du §18 : le banc les rejoue, personne ne les écoute.

| Fichier | Ce qu'elle contient | Instrument | Durée |
|---|---|---|---|
| `left-hand-only.json` | une seule main gauche levée — fixe la convention de côté (§7.3) | Phantom | 2 s |
| `two-hands-cross.json` | deux mains qui se croisent sans disparaître (AIR-P-21) | Phantom | 2 s |
| `slow-rise.json` | l'exemple du thérémine (§7.14) : `u` de 0,30 à 0,60 en 3 s, volume à 0,75 | Phantom | 3 s |
| `harp-sweep.json` | l'exemple de la harpe (§7.14) : index de `u` 0,20 à 0,45 en 0,5 s | Harp | 0,5 s |
| `tremor-at-boundary.json` | tremblement de 0,004 en `u` autour du seuil sol → la (AIR-P-06) | Phantom | 3 s |
| `hand-leaves-mid-note.json` | la main sort du cadre en plein milieu d'une note (AIR-P-09) | Phantom | 1,5 s |
| `fast-jab.json` | traversée de quatre cordes en un quart de seconde | Harp | 0,25 s |

## Les produire

```sh
npx tsx apps/bench/src/make-reference-takes.ts            # écrit takes/reference/
npx tsx apps/bench/src/make-reference-takes.ts --check    # vérifie sans réécrire
```

`--check` rend 1 dès qu'un fichier ne correspond plus à ce que le générateur
produit : une prise qui dérive ne passe pas inaperçue.

## État

Ces fichiers ne sont pas encore écrits : les générateurs de `takeGen.ts`
(lot B1) sont, à la date de ce lot, encore des `todo(...)`. Le script le dit
prise par prise et rend 1. Dès que le lot B1 est livré, la même commande les
écrit, sans autre changement.

## Poids (cahier §7.11)

126 nombres par image (2 mains × 21 points × 3 coordonnées), soit environ
26 Ko par seconde en JSON brut et 7,6 Ko par seconde en entiers de 16 bits.
`bench synth` mesure le poids réel du fichier écrit et signale l'écart au-delà
d'un facteur 2 — il ne le corrige pas en silence.
