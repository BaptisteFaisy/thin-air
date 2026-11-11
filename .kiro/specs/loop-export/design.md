# loop-export — Conception

## Ce qui est enregistré : des événements, jamais du son

Une couche (`LoopLayer`) porte l'instrument, les `MusicEvent` et un booléen
`muted`. Rien d'autre : pas d'échantillons, pas de courbe audio. Les réglages
continus sont enregistrés comme des `control` à la cadence des images (§7.10),
ce qui permet de les rejouer en changeant d'instrument.

Conséquence : l'export audio **n'est pas** un enregistrement, c'est un rendu
hors ligne — le même moteur que les tests (AIR-F-38), donc le même son, et une
preuve gratuite.

## La boucle, en temps

```text
durée d'une mesure = 60 / tempo × beatsPerBar
durée de la boucle = durée d'une mesure × bars
```

À 90 par minute et quatre temps : 2,666… s ; quatre mesures : 10,666… s, soit
512 000 échantillons à 48 000 Hz. Le nombre d'échantillons se calcule en
entier (`Math.round(durée × fs)`), et le rendu s'arrête à cet entier : c'est
ce qui rend « exactement la durée de ses mesures » (AIR-P-17) vérifiable au
lieu d'approximatif.

## Compensation du retard (AIR-F-35)

Chaque instant enregistré est avancé de `measuredTotalMs + cameraLatencyMs`,
puis ramené **dans** la boucle par un modulo positif. Deux pièges :

- le modulo de JavaScript rend un reste négatif pour un dividende négatif : un
  événement du début de boucle, avancé de 105 ms, sortirait à `−0,105 s` ;
  d'où `((t % T) + T) % T` ;
- avancer peut faire passer un événement de la fin d'une boucle au début de la
  précédente : il reste dans la même boucle, il change seulement de position.
  C'est ce que veut dire « en restant dans la boucle ».

## Calage (AIR-F-37)

`t' = t + force × (grille(t) − t)`, avec `grille` à la croche ou à la double
croche et `force` de 0 à 1. Force 0 : `t' = t` exactement (aucun changement,
pas un changement infinitésimal). Force 1 : `t' = grille(t)`. La grille se
mesure depuis le début de la boucle, pas depuis un instant absolu.

## Export MIDI (AIR-F-39, AIR-P-18)

Un fichier MIDI à une piste par couche. Les instants deviennent des ticks sur
une division de 96 par noire — une valeur qui divise exactement 4 temps et les
croches et doubles croches. Relire le fichier doit redonner les mêmes notes à
une unité de temps près : c'est AIR-P-18, et c'est une propriété d'aller-retour,
donc un test.

## Décision : aucune donnée de temps absolue

`LoopLayer` ne porte pas d'horodatage absolu, seulement des instants relatifs à
la boucle. Une session rouverte doit sonner pareil, quelle que soit l'heure :
c'est AIR-N-09 appliqué au stockage. Le champ `calibratedAt` de `PlayRect` est
la seule date du modèle, et elle ne sert qu'à l'affichage.
