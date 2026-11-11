# Les deux leçons : le filtre et les centièmes

Deux écrans pédagogiques (parcours P5, « Show the physics »). Chacun affiche des
nombres **calculés**, jamais une illustration approximative : la logique est pure
et testée, l'affichage ne fait que la tracer.

## Leçon 1 — le filtrage (§7.5)

`apps/web/src/lessons/filterLesson.ts` produit, pour une prise de tremblement à
graine fixe : les positions brutes, lissées et vives prêtes à dessiner, plus les
nombres qui font comprendre le compromis.

| Nombre | Ce qu'il dit | Valeur mesurée |
|---|---|---|
| écart-type brut | le tremblement de la main, en largeurs de zone | 0,0026 |
| écart-type vif | ce qui reste après le canal des déclenchements | 0,0012 |
| écart-type lissé | ce qui reste après le canal des réglages continus | 0,0005 |
| α à l'arrêt | le tableau du cahier annonce 0,24 | 0,24 |
| α à une largeur/s | le tableau annonce 0,58 | 0,58 |

Ce que l'élève voit : le tracé brut tremble, le tracé lissé est presque droit, et
le tracé vif suit de près. Baisser `fcMin` écrase davantage le tremblement (le
test le vérifie) : c'est le réglage exposé pour les mains qui tremblent (§12.4).

## Leçon 2 — viser juste (§5.3)

`apps/web/src/lessons/centsLesson.ts` donne, pour une position de main, une gamme
et une force d'aimant : la note visée (continue), la note de la gamme la plus
proche, la note réellement émise, l'écart en centièmes, la fréquence et le nom.

Ce que l'élève voit : à aimant 1 l'écart est nul partout ; à aimant 0 il monte
jusqu'à **150 centièmes** sur le ré mineur harmonique — parce que cette gamme
contient une seconde augmentée (si♭ → do♯, trois demi-tons). C'est la
démonstration chiffrée de la phrase du cahier : jouer juste dans le vide est très
difficile. Sur la gamme par tons, la borne tombe à 100 centièmes.

Le calcul du §5.3 est vérifié tel quel : 0,5 % de la largeur sur 36 demi-tons
donne 18 centièmes, et 80 cm / 36 demi-tons donne 2,2 cm par demi-ton.

## Ce qui n'est pas encore fait

Les composants d'affichage (SVG) et leur montage dans un écran : voir
`docs/integration-t5.md`, qui donne le branchement exact. La logique, les nombres
et les tests sont livrés.
