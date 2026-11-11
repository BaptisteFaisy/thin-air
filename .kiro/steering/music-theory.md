---
inclusion: fileMatch
fileMatchPattern: "{packages/core/src/music.ts,instruments/**}"
---

# Musique — formules, gammes, centièmes, décibels (§7.7)

## Numéro de note et fréquence

```text
f = 440 × 2^((m − 69) / 12)          m = 69 + 12 × log2(f / 440)
```

Un demi-ton multiplie la fréquence par 1,05946 ; une octave la double.
**AIR-P-04** : la note 69 vaut 440 Hz, ajouter 12 double la fréquence.

## Gammes — une liste d'écarts en demi-tons dans l'octave

| Gamme | Écarts |
|---|---|
| Pentatonique majeure | 0, 2, 4, 7, 9 |
| Pentatonique mineure | 0, 3, 5, 7, 10 |
| Mineure naturelle | 0, 2, 3, 5, 7, 8, 10 |
| Mineure harmonique | 0, 2, 3, 5, 7, 8, 11 |
| Mineure hongroise | 0, 2, 3, 6, 7, 8, 11 |
| Majeure | 0, 2, 4, 5, 7, 9, 11 |
| Par tons | 0, 2, 4, 6, 8, 10 |
| Chromatique | 0 à 11 |

Le degré `k` donne la note `fondamentale + 12 × ⌊k / n⌋ + gamme[k mod n]`.
La gamme de saison est **ré mineur harmonique**, fondamentale 50 :
ré 146,83 Hz, mi 164,81, fa 174,61, sol 196,00, la 220,00, si bémol 233,08,
do dièse 277,18, ré 293,66.

## Hauteur continue, aimant, marge

```text
m(u) = m_bas + (m_haut − m_bas) × u          (la fréquence croît de façon
                                              exponentielle avec la position)
m'   = m + a × (q(m) − m)                    a = snap, de 0 à 1
```

À `a = 1`, des notes franches ; à `a = 0`, un glissé pur. `q(m)` est la note de
la gamme retenue avec la marge d'hystérésis de §7.6 : la hauteur doit dépasser
la frontière entre deux notes voisines de **15 %** de leur écart
(`noteHysteresis`) pour que la note change. Sans cet écart, une main hésitante
ferait basculer la note dix fois par seconde (**AIR-P-06** : au plus un
changement de note pour un tremblement inférieur à la marge).

**AIR-P-03** : si `u₁ ≤ u₂`, la hauteur en `u₁` est inférieure ou égale à celle
en `u₂`, avec ou sans aimant. **AIR-P-05** : avec l'aimant à 1, toute note
émise appartient à la gamme et à l'étendue.

## Volume — l'oreille entend des rapports

```text
dB = −48 × (1 − v)        v = 1 → 0 dB ; v = 0,75 → −12 dB ; v = 0,5 → −24 dB
                          v < 0,05 → silence
```

C'est la courbe `db48` du champ `curve` d'une correspondance (§7.7). Le volume
général est à −12 dB par défaut, le plafond à −1 dB (`masterGainDb`,
`ceilingDb`).

## Centièmes de demi-ton

Un centième vaut 1/100 de demi-ton : `cents = 1200 × log2(f_mesurée /
f_attendue)`. La tolérance du banc est de **5 centièmes** (0,57 Hz pour le sol
à 196 Hz) ; le vibrato du Phantom va jusqu'à **40 centièmes**, 5,5 fois par
seconde. Un tremblement résiduel de 0,5 % de la largeur de la zone déplace la
note de 18 centièmes, ce qui s'entend (§5.3) : d'où l'aimant et la marge.

## Noms des notes

Les noms s'écrivent en français dans les textes du projet et en anglais dans
l'interface (AIR-N-14) : do ré mi fa sol la si bémol / C D E F G A B. Le
numéro MIDI reste la seule référence dans le code : `69 = la 440 Hz`.
