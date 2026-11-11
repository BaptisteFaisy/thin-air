# seam-and-voices — Conception

## L'entrée : §7.9, recopié sans le réécrire

> Trois règles, sans exception.
>
> 1. **On ne fixe jamais directement un réglage audio pendant qu'une voix
>    sonne.** Chaque mise à jour passe par une rampe :
>    `param.setTargetAtTime(valeur, instant, τ)`, avec τ de 20 ms.
> 2. **Tout événement est daté sur l'horloge du son.** Une note porte un
>    instant, `currentTime` plus 5 ms d'avance. La boucle programme ses notes
>    par avance : un minuteur passe toutes les 25 ms et programme les 100 ms
>    qui viennent.
> 3. **Les voix sont bornées et toujours relâchées.** Huit voix au plus ;
>    au-delà, la plus ancienne est reprise. Si aucune image n'a été analysée
>    depuis 300 ms, toutes les voix sont relâchées.

## Conséquence 1 : qui décide de l'instant

`packages/core/src/schedule.ts` **ne lit jamais `Date.now()`** : il reçoit
l'instant présent et l'avance, et rend des événements datés. En jeu direct,
l'appelant donne `currentTime + lookaheadMs` (5 ms) ; en rendu hors ligne,
l'appelant donne l'instant de la prise. Une seule fonction, deux appelants :
c'est ce qui rend AIR-P-12 (déterminisme) vérifiable — si `schedule` lisait
l'horloge murale, le rendu hors ligne ne serait pas reproductible au bit près.

## Conséquence 2 : qui décide des voix

`voices.ts` est un **allocateur** pur : il reçoit un `noteOn` et un instant,
il rend éventuellement un `noteOff` de reprise (la plus ancienne voix) puis le
`noteOn`. Il ne connaît ni `AudioContext` ni paramètre. L'état est une liste
triée par instant de début puis par ordre d'apparition — **jamais** l'ordre
d'un `Map`, qui dépend de l'ordre d'insertion et piégerait la reproductibilité
(AIR-N-09, AIR-P-12).

`voice` dans `MusicEvent` est une **chaîne** et non un numéro : cela permet à un
instrument d'avoir des voix nommées (`"pitch"`, `"volume"`, `"harp:3"`), et à
l'allocateur de dire « reprends la voix `harp:3` » plutôt que « la troisième ».

## Conséquence 3 : le changement d'instrument (AIR-F-24)

Un changement d'instrument n'émet pas de `noteOff` sec : il émet un
`control gain` à 0 sur chaque voix active, avec une rampe de 20 ms, **puis**
les `noteOff` à l'instant de fin de rampe. Sans cet ordre, on entend un
claquement — c'est précisément ce que `AIR-F-24` interdit, et ce qu'un
`noteOff` seul produit.

## Conséquence 4 : la reprise (AIR-F-27)

À `maxVoices` voix actives, un nouveau `noteOn` reprend **la plus ancienne**
(par instant de début, puis par ordre d'apparition). Décision : la voix reprise
est relâchée avec l'extinction de l'instrument, pas coupée net ; le nouveau
`noteOn` porte donc un instant postérieur d'au moins l'extinction, sinon deux
sons se superposeraient sur la même voix. C'est ce qui garde AIR-P-10 vraie à
l'échantillon près : le nombre de voix **actives** (attaque comprise) ne
dépasse jamais 8.

## Conséquence 5 : aucune note coincée (AIR-P-09)

Trois mécanismes, du plus précis au plus brutal, et ils se cumulent :

1. chaque `noteOn` produit un `noteOff` par construction (`gestures` émet
   toujours les deux phases) ;
2. la fin d'une prise ferme toutes les notes ouvertes, à `t_dernière_image +
   graceMs + extinction` ;
3. `stallReleaseMs` (300 ms sans image) ferme tout, à l'instant courant.

Le test de la propriété utilise `takes/reference/hand-leaves-mid-note` et
vérifie `maxVoices` actif à la fin du rapport (recette §18).

## Le désaccord avec `gestures`, et comment il est tenu

`gestures` tranche le cas « main qui disparaît pendant un maintien » : le
verrou tombe avec la main, à la fin du délai de grâce de 150 ms. Cette spec
n'ajoute rien : elle exige seulement qu'aucune voix ne reste active après
`grâce + extinction`. Les deux specs sont donc compatibles — et c'est écrit
dans les deux sens, parce que §14.1 demande explicitement de chercher la
contradiction entre elles deux.
