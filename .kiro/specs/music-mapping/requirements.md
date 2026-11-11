---
spec: music-mapping
parcours: "Exigences d'abord"
exigences: [AIR-F-18, AIR-F-19, AIR-F-20]
proprietes: [AIR-P-03, AIR-P-04, AIR-P-05]
sections: ["§7.7", "§5.3", "§13.2"]
---

# music-mapping — Exigences

**Parcours : Exigences d'abord** — les trois propriétés de la musique sont
écrites avant le code, parce qu'elles décident de la forme des fonctions.

## Critères (EARS)

- **AIR-F-18** — Le système DOIT proposer les gammes de §7.7, le choix de la
  fondamentale et de l'étendue.
- **AIR-F-19** — Le système DOIT appliquer l'aimant de §7.7, réglable de 0 à 1,
  avec une **valeur par défaut par instrument** (champ `snap` du fichier).
- **AIR-F-20** — Le volume DOIT suivre l'échelle en décibels de §7.7
  (`dB = −48 × (1 − v)`, silence sous 5 % de hauteur).
- **AIR-P-03** — Pour tout instrument, si `u₁ ≤ u₂` alors la hauteur en `u₁`
  est inférieure ou égale à la hauteur en `u₂`, avec ou sans aimant.
- **AIR-P-04** — La note 69 vaut 440 Hz ; ajouter 12 double la fréquence.
- **AIR-P-05** — Avec l'aimant à 1, toute note émise appartient à la gamme et à
  l'étendue, pour toute prise.

## Les huit gammes (§7.7) et la gamme de saison

Pentatonique majeure `0,2,4,7,9` · pentatonique mineure `0,3,5,7,10` ·
mineure naturelle `0,2,3,5,7,8,10` · mineure harmonique `0,2,3,5,7,8,11` ·
mineure hongroise `0,2,3,6,7,8,11` · majeure `0,2,4,5,7,9,11` · par tons
`0,2,4,6,8,10` · chromatique `0..11`.

Ré mineur harmonique, fondamentale 50 : ré 146,83 Hz, mi 164,81, fa 174,61,
sol 196,00, la 220,00, si bémol 233,08, do dièse 277,18, ré 293,66.

## La marge, qui est une exigence de confort (§5.3)

Un tremblement résiduel de 0,5 % de la largeur de la zone déplace la note de
**18 centièmes**, ce qui s'entend. D'où la marge de 15 % (`noteHysteresis`) sur
les frontières de notes : elle appartient à cette spec, pas à `gestures`, même
si elle se lit sur la hauteur.
