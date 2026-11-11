# stage-ui — Conception

## Deux surfaces, pas une

**La scène** est un canevas en deux dimensions, redessiné à chaque image de
l'écran : mains, zones, cordes, traces, réponse au geste. Elle est purement
visuelle, sans interaction : elle ne reçoit ni clic ni focus.

**Les réglages** sont des contrôles HTML ordinaires, **hors du canevas** :
`input`, `select`, `button`, avec leur étiquette. C'est ce qui rend AIR-N-06
possible sans effort — un réglage dans un canevas doit être redessiné, étiqueté,
rendu focusable et relié à un lecteur d'écran à la main, et on le fait toujours
mal. Un contrôle HTML a tout cela gratuitement.

## Le retard, dessiné comme un tableau

Un tableau de composantes (attente d'image, analyse, traitement, sortie audio,
caméra) avec, à côté de chaque nombre, sa nature : « mesuré » ou « estimé ».
Pas un total seul : un total cache d'où vient le retard, et c'est justement la
composante qu'on peut réduire qu'il faut montrer. La caméra est toujours
« estimée » — aucun navigateur ne l'expose.

`wirelessWarnMs` (100 ms) déclenche un encart : « casque sans fil ? une sortie
filaire ajoute 150 à 250 ms de moins ». C'est une phrase utile, pas une
avertissement générique.

## Réponse au geste (AIR-F-51)

Chaque note produit une réponse visible **à l'endroit du geste** : une corde
qui vibre, une zone qui s'illumine, un anneau qui s'élargit. Sans elle, jouer
devant une image masquée (AIR-F-52, le défaut) serait jouer dans le noir. La
réponse suit la règle « pas plus de trois clignotements par seconde » : elle
varie en intensité, pas en tout-ou-rien.

## Mouvement (AIR-N-06)

`prefers-reduced-motion` coupe les animations de la scène (traînées, anneaux)
et garde la réponse statique (une corde colorée reste colorée). Le réglage est
lu une fois au chargement et suit les changements.

## Ce que la scène ne fait jamais

- Elle ne décide de rien : elle lit l'état (`MusicEvent`, `GestureEvent`,
  `Features`) et dessine. Aucune logique musicale dans un composant React.
- Elle ne déclenche aucune analyse : la boucle d'image est dans `vision`
  (`capture-vision`). Deux boucles donneraient deux analyses par image.
- Elle n'affiche pas l'image de la caméra par défaut (AIR-F-52) — réglage
  `showCamera`, faux dans `defaults.ts`.
