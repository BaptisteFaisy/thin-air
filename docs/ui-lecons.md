# Les trois leçons, visibles sur le site

`apps/web/src/ui/LessonsPanel.tsx` rend les trois leçons du parcours P5
(§12.1, écran « Physique »). La logique était déjà livrée et testée dans
`apps/web/src/lessons/` ; il ne manquait que l'affichage — c'est ce lot.

## Accès

L'adresse `?lecons=1` ouvre le panneau (route ajoutée dans `App.tsx`, à côté de
`?record=1`). Un lien depuis l'écran d'accueil et depuis l'écran Physique reste à
poser : une ligne dans `apps/web/src/ui/Home.tsx` et une dans
`apps/web/src/ui/PhysicsPanel.tsx`.

## Ce que chaque leçon affiche

| Leçon | Tracé | Nombres en texte |
|---|---|---|
| Le filtre (§7.5) | position brute, canal vif, canal lissé | écart-type du tremblement sur les trois séries, α = 0,24 à l'arrêt et 0,58 à une largeur par seconde |
| Viser juste (§5.3) | écart à la note de la gamme, en centièmes, sur toute la zone | note visée, note jouée et sa fréquence, écart en centièmes, force de l'aimant, les 18 centièmes d'un tremblement de 0,5 % |
| La couture des deux horloges (§7.9) | — (les deux horloges se lisent en nombres) | 30 images/s soit 33,3 ms, 48 000 échantillons/s, 1 600 échantillons entre deux images, avance de programmation 5 ms = 240 échantillons, rampe de 20 ms |

Règle tenue : **tout ce qui est affiché est calculé** par les fonctions de
`lessons/`, aucune valeur n'est écrite en dur dans le composant, et chaque nombre
existe aussi en texte (un dessin seul ne serait pas lu par un lecteur d'écran,
AIR-N-06). Aucune animation continue : le réglage « moins de mouvement » n'a rien
à désactiver.

## Reste à raccorder

Les libellés sont en anglais dans le composant. Les fichiers
`apps/web/src/i18n/lessons.en.ts` et `lessons.fr.ts` sont livrés dans ce lot : il
reste à les déclarer dans `apps/web/src/i18n/index.ts` et à passer l'objet de
messages en prop de `LessonsPanel` (deux lignes). Ce raccordement touche des
fichiers partagés avec le lot de montage en cours, d'où cette note plutôt qu'un
changement direct.
