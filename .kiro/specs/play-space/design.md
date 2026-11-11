# play-space — Conception

## Miroir

L'affichage est en miroir et l'abscisse est retournée : bouger la main droite
vers la droite déplace son repère vers la droite. Une seule fonction fait
l'aller-retour (`space.ts`), et elle est involutive : `mirror(mirror(u)) = u`.
Le retournement est appliqué **une fois**, à l'entrée du repère — jamais à
l'affichage en plus, sinon le site se contredirait (AIR-F-05, AIR-P-01).

## Zone de jeu

```text
u = (x − u0) / (u1 − u0)      v = (v1 − y) / (v1 − v0)      bornés à [0, 1]
```

`v` croît vers le haut (l'image a son origine en haut, l'instrument a la sienne
en bas) : c'est ce qui fait que lever la main augmente le volume. `edge` est
vrai dès que la valeur est bornée — pas quand elle est proche du bord : une
main posée au bord n'est pas une main qui sort.

## Calibration

Huit secondes de relevé, puis par axe le 5ᵉ et le 95ᵉ centile, élargis de 5 %.
Le centile plutôt que le minimum et le maximum : une main qui s'écarte une fois
ne fixe pas la zone de jeu pour toute la séance. La contrainte AIR-P-22 se
vérifie sur le nuage généré : au moins 90 % des points dedans (le 5–95 en
contient 90 % par construction, l'élargissement ne peut que faire mieux), les
bords restant dans [0, 1], et la taille minimale (20 % de l'image par côté)
imposée après coup. Une calibration qui ne la respecte pas n'est pas retenue :
on garde la zone par défaut.

## Ce qui n'est pas décidé ici

Le lissage des positions (`filtering`) et les rôles (`capture-vision`) : le
repère lit des points déjà filtrés.
