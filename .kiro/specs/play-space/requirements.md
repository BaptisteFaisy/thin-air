---
spec: play-space
parcours: "Quick Spec"
exigences: [AIR-F-05, AIR-F-08, AIR-F-09]
proprietes: [AIR-P-01, AIR-P-22]
sections: ["§7.4", "§13.2"]
---

# play-space — Exigences

**Parcours : Quick Spec** (deux formules et un rectangle).

## Critères (EARS)

- **AIR-F-05** — Le système DOIT afficher et interpréter les mains en miroir.
- **AIR-F-08** — Sans calibration, la zone de jeu DOIT être les **80 % centraux**
  de l'image (`defaultPlayRect` : 0,1 à 0,9 sur les deux axes).
- **AIR-F-09** — QUAND l'utilisateur lance la calibration, le système DOIT
  relever la portée de ses mains selon §7.4 — huit secondes, du 5ᵉ au 95ᵉ
  centile sur chaque axe, élargi de 5 % — en déduire la zone de jeu, la
  conserver sur l'appareil, et permettre de la refaire ou de l'annuler.
- **AIR-P-01** — Pour tout point, `u` et `v` sont entre 0 et 1, et `u` ne
  décroît pas quand la main va vers la droite de l'écran.
- **AIR-P-22** — Pour tout nuage de positions, le rectangle obtenu en contient
  au moins 90 %, respecte la taille minimale et reste dans l'image.

## Détail de §7.4 à respecter

- Proportions corrigées du rapport largeur sur hauteur de l'image.
- Le centre de la paume est la moyenne des points 0, 5, 9, 13 et 17.
- L'échelle de la paume `s` est la distance du poignet à la base du majeur.
- Hors du rectangle, les valeurs sont bornées et un indicateur « bord »
  s'allume. Un côté de moins de 20 % de l'image fait proposer de recommencer
  ou de garder la zone par défaut.
