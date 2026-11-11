---
inclusion: fileMatch
fileMatchPattern: "packages/vision/**"
---

# MediaPipe Hand Landmarker — les faits vérifiés (§7.3)

## Ce qu'on utilise

- Paquet **`@mediapipe/tasks-vision`**, tâche **Hand Landmarker**, modèle
  **`hand_landmarker.task`**. Le fichier réunit deux modèles : l'un trouve les
  paumes, l'autre place les points. D'une image à la suite, le second réutilise
  le cadre précédent ; la recherche de paume ne repart que si la main est
  perdue.
- Réglages : **mode vidéo**, **deux mains**, seuils de confiance à leur valeur
  par défaut (**0,5**), calcul sur **processeur graphique avec repli sur
  processeur** (AIR-N-07).
- Le modèle et ses fichiers d'exécution sont **servis par le site lui-même**
  (`public/models/`), pas par un service tiers : rien ne dépend d'un tiers et
  le site fonctionne hors ligne après la première visite (AIR-N-01, AIR-F-54).
  Le poids de ces fichiers fixe le temps du premier chargement — à mesurer
  (annexe D).

## La forme du résultat

Pour chaque main : **21 points** en coordonnées d'image (x et y de 0 à 1, z
relatif au poignet), les mêmes en mètres autour du centre de la main, et un
**côté** (gauche ou droite) avec un score.

| Points | Nom | Usage ici |
|---|---|---|
| 0 | poignet | échelle de la paume |
| 4 | bout du pouce | pince |
| 8 | bout de l'index | pointeur fin, pince |
| 5, 9, 13, 17 | base de l'index, du majeur, de l'annulaire, de l'auriculaire | centre et échelle de la paume |
| 12, 16, 20 | bouts du majeur, de l'annulaire, de l'auriculaire | ouverture de la main |

Le centre de la paume est la moyenne des points 0, 5, 9, 13 et 17 ; l'échelle
de la paume `s` est la distance du poignet à la base du majeur (§7.4). Diviser
par `s` rend la pince et l'ouverture indépendantes de la distance à la caméra.

## Deux pièges connus

- **L'appel `detectForVideo(video, instant)` est synchrone** : il occupe la
  page le temps de l'analyse. Périmètre minimal : sur le fil principal, avec
  mesure du temps (`inferenceMs`). Le déport dans un fil d'exécution séparé
  est souhaitable (AIR-F-07).
- **Le côté annoncé dépend du miroir.** La convention se fixe par un test :
  une prise où seule la main gauche est levée doit donner « gauche »
  (`takes/reference/left-hand-only`, recette §18). À vérifier sur un premier
  essai réel (annexe D).

## Capture et analyse

Chaque image nouvelle est analysée **une fois et une seule**, avec son
horodatage (AIR-F-03) : `requestVideoFrameCallback` si le navigateur le
propose, sinon la surveillance du temps de la vidéo à chaque rafraîchissement
d'écran — présence à vérifier dans les trois navigateurs visés (annexe D).
Image demandée : 640 × 480, 60 images par seconde souhaitées, 24 au minimum,
caméra frontale, **sans audio** (§7.2). Une image plus grande coûte du temps
sans rien apporter.

## Rôles

Une main « de hauteur » et une main « de volume », attribuées d'après le côté.
Une fois attribué, un rôle suit la main par continuité (la paume la plus
proche de sa position précédente) et ne change pas tant que la main n'a pas
disparu plus d'une demi-seconde : deux mains qui se croisent n'échangent pas
leurs rôles (**AIR-P-21**). Le réglage « gaucher » les inverse (AIR-F-11).
