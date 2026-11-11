# music-mapping — Conception

## Trois fonctions, une seule source de vérité

```text
midiToFreq(m)      = 440 × 2^((m − 69) / 12)
degreeToMidi(r, s, k) = r + 12 × ⌊k / |s|⌋ + s[k mod |s|]
pitchFromU(u, range)  = range.low + (range.high − range.low) × u
```

Tout le reste en dérive : la gamme n'est jamais recalculée ailleurs, et un
instrument ne porte que des **données** (`root`, `steps`, `range`), jamais une
formule. C'est ce qui rend l'instrument partageable (`AIR-F-43`) et la
propriété AIR-P-04 vérifiable sur une seule fonction.

## Monotonie (AIR-P-03)

`pitchFromU` est affine croissante en `u` ; l'aimant est une combinaison
convexe `m + a × (q(m) − m)` entre la hauteur continue et une note quantifiée.
Le point délicat est `q`, qui est une fonction en escalier : elle est
croissante par construction si l'ensemble des notes visées est trié et si
l'hystérésis n'est appliquée **qu'en jeu**, jamais dans `q`. Décision :
`quantizeToScale` est une fonction pure et croissante (la note la plus proche,
départage vers le bas) ; la marge de 15 % vit dans une fonction d'état
séparée, appelée par la chaîne de jeu. Sans cette séparation, `q` dépendrait de
son appel précédent et AIR-P-03 tomberait — la monotonie deviendrait fausse
autour des frontières.

## Dans la gamme et l'étendue (AIR-P-05)

À l'aimant 1, la note émise est exactement `q(m)`, donc une note de la gamme.
L'étendue est respectée en **bornant avant** la quantification : `m` est
d'abord borné à `[low, high]`, puis quantifié sur les degrés de la gamme dans
ces bornes. L'ordre compte : quantifier d'abord pourrait sortir de l'étendue
(la note de gamme la plus proche de `high` peut être au-dessus de `high`).

## Volume en décibels (AIR-F-20)

`dBFromV(v) = −48 × (1 − v)`, `gainFromV(v, "db48") = 10^(dB/20)`, silence si
`v < 0,05`. La courbe est nommée dans le fichier d'instrument
(`{"curve": "db48"}`), jamais sous-entendue : `linear` reste le défaut du type,
pour qu'un auteur d'instrument puisse écrire autre chose sans toucher au code.

## Noms de notes

Les noms ne servent qu'à l'affichage (écran, rapport de rendu) : le code ne
manipule que des numéros MIDI. La table des noms est indexée par `m mod 12` et
l'octave par `⌊m / 12⌋ − 1` (le do 4 = 60). Interface en anglais, textes du
projet en français (AIR-N-14).
