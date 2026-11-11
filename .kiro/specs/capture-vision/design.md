# capture-vision — Conception

## La décision centrale : l'analyse ne dépend pas du dessin

Une seule boucle, celle de l'image : `requestVideoFrameCallback` si le
navigateur le propose, sinon la surveillance du temps de la vidéo à chaque
rafraîchissement d'écran (§7.2 — présence à vérifier, annexe D). Chaque image
nouvelle déclenche **une** analyse, horodatée. Le dessin de la scène est un
consommateur, jamais un déclencheur : sans cela deux boucles s'ajouteraient et
une image serait analysée deux fois (AIR-F-03).

## Forme du résultat

`packages/vision` rend des `DetectedHand` (`side`, `score`, `points[21]`), que
`packages/core` transforme en `TakeFrame`. La frontière est un tableau de
points, jamais une image : c'est ce qui rend la prise possible (AIR-F-47) et
la vie privée tenable (AIR-N-01).

## Caméra, sans audio

`getUserMedia({ video: { width: 640, height: 480, frameRate: { ideal: 60, min: 24 }, facingMode: "user" }, audio: false })`.
Le `audio: false` est explicite : il n'est pas un défaut qu'un navigateur
pourrait changer. Le clic sur « Start » fait les deux gestes à la fois —
permssion caméra et ouverture du moteur audio — parce que les navigateurs
refusent tout son avant un geste de l'utilisateur (AIR-F-01).

## Repli sans caméra

Une source de points unique : `camera` ou `pointer` (souris, doigt) ou
`replay` (prise rejouée). Le reste de la chaîne ne sait pas d'où viennent les
points — c'est ce qui rend AIR-F-02 presque gratuit, et ce qui donne le
fantôme (AIR-F-50) et le banc d'essai (§13.1) sans code de plus.

## Aucune main reconnue

Un compteur d'images sans main, remis à zéro à la première main vue. À trois
secondes **et** si l'image change (le modèle répond, il ne voit rien), l'écran
conseille plus de lumière ou plus de recul (AIR-F-06). Si l'image ne change
pas, c'est la caméra qui est figée : c'est le cas du relâchement de §7.9
règle 3, pas un conseil d'éclairage.
