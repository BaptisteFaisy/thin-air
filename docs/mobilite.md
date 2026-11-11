# Les profils de mobilité

Cette page explique les trois profils, en langage clair — pour la personne qui
joue, puis pour l'ergothérapeute qui accompagne.

## En clair, pour la personne qui joue

On ne touche pas l'instrument pour jouer : la caméra suit les mains, et chaque
position devient une note. Par défaut, pour avoir toutes les notes, il faut
aller assez loin — aux quatre coins de l'image. Si l'on joue assis, avec une
portée de bras réduite, ou d'une seule main, ce n'est pas toujours possible.

Les profils règlent plusieurs choses d'un seul geste, pour que tout tienne dans
ce que l'on peut réellement atteindre.

### Assis, portée courte

La zone de jeu se resserre : elle couvre les **40 % centraux** de l'image au
lieu des 80 % par défaut. Plus besoin d'étendre le bras jusqu'au bord pour jouer
la note la plus grave ou la plus aiguë : tout l'instrument tient dans le geste
qu'on a l'habitude de faire, assis.

Les notes, elles, ne changent pas : on garde exactement la même étendue, du plus
grave au plus aigu, simplement atteinte avec un geste plus court.

### Une main

L'instrument devient jouable d'une seule main : la hauteur et le volume se
pilotent de la même main. En plus, le **maintien** s'active : rester 400 ms sur
une note la verrouille, jusqu'au prochain geste. La main peut ainsi se libérer
sans perdre la note qu'elle joue.

Là non plus, aucune note n'est sacrifiée : la même étendue reste disponible,
juste avec une main.

### Mains qui tremblent

Le tremblement léger d'une main fait bouger la note de façon visible et
fatigante. Ce profil **lisse davantage** le signal : une main qui tremble un peu
ne fait plus vaciller la note, tout en gardant la réponse rapide pour les
mouvements volontaires. Si la main quitte un court instant le regard de la
caméra, la note est aussi tenue un peu plus longtemps avant d'être relâchée.

## Pour l'ergothérapeute

Les trois profils traduisent les exigences de la fiche de persona (cahier des
charges §3) en réglages précis et nommés, tous dans la zone de jeu et dans les
paramètres de filtrage :

| Profil | Réglages changés | Ce qui ne change pas |
|---|---|---|
| Assis, portée courte | Zone réduite et centrée (40 %) | Tessiture, réglages sonores, main directrice |
| Une main | Jeu à une main, maintien (400 ms) | Zone, tessiture, filtrage |
| Mains qui tremblent | Lissage renforcé, main tenue 200 ms | Zone, main directrice, maintien |

Détail technique des valeurs :

- **Zone assise** : rectangle centré de largeur 0,4 sur chaque axe (défaut
  0,8, soit les 80 % centraux). Les positions `u` et `v` étant des *fractions*
  de ce rectangle, elles couvrent toujours l'intervalle [0, 1] : la tessiture
  est donc préservée quelle que soit la taille de la zone.
- **Filtrage tremblement** : la coupure minimale passe de 1,5 Hz à 0,8 Hz
  (lissage plus fort à l'arrêt), β passe de 5 à 6 (le geste volontaire reste
  suivi), la coupure du canal de déclenchement passe de 6 Hz à 5 Hz, et la
  grâce de main perdue de 150 ms à 200 ms. C'est le filtre « One Euro » du
  cahier (§7.5), appliqué aux coordonnées.
- **Maintien** : rester 400 ms dans une zone verrouille la note jusqu'au
  prochain passage (exigence AIR-F-12 du cahier).

Tous les profils restent **réversibles** : « Aucun profil » remet la zone par
défaut et les réglages de départ. Chaque réglage appliqué par un profil reste
ensuite ajustable à la main, finement, dans le panneau des réglages.

## Objectifs de conception (extraits du cahier)

- « Sam veut que tout l'instrument tienne dans la zone qu'il atteint, et
  pouvoir jouer d'une seule main » (§3).
- « Zone de jeu réglée sur la portée ; jeu à une main ; maintien ; force du
  filtrage réglable pour les mains qui tremblent » (§12.4).
- « Chaque instrument indispensable doit être jouable d'une seule main »
  (AIR-F-10) ; « rester 400 ms dans une zone doit verrouiller sa note »
  (AIR-F-12).

## Limite assumée

Le cahier (exigence AIR-N-06) dit explicitement qu'une limite n'est **pas**
traitée dans cette édition : **le jeu sans aucun retour visuel**. Une personne
qui ne voit pas du tout l'écran — ni la scène, ni la position de la main, ni le
nom de la note affiché — n'est pas couverte par ces profils ni par le reste de
l'application. Les profils de mobilité améliorent la portée, le nombre de mains
et le tremblement ; ils ne remplacent pas l'aide visuelle. C'est une piste
future, pas un engagement présent.