---
inclusion: fileMatch
fileMatchPattern: "{packages/audio/**,packages/core/src/schedule.ts,packages/core/src/loop.ts,packages/core/src/voices.ts}"
---

# La couture — de 30 gestes à 48 000 échantillons par seconde (§7.9)

À gauche, l'horloge des images (30 à 60 par seconde) ; à droite, celle du son
(48 000 échantillons par seconde). Entre les deux, un type : `MusicEvent`,
daté en secondes sur l'horloge du son. Trois règles, sans exception.

## 1. Jamais de réglage fixé directement pendant qu'une voix sonne

Chaque mise à jour passe par une rampe :

```ts
param.setTargetAtTime(valeur, instant, 0.02);   // τ = paramTauMs = 20 ms
```

Sans cela le réglage avance par marches, trente fois par seconde, et le son
grésille. La preuve n'est pas une écoute : c'est la propriété **AIR-P-16** —
pour un glissé lent sans aimant, la fréquence mesurée par fenêtres de 10 ms ne
fait aucun saut supérieur à celui d'une rampe idéale, à une tolérance près.
`seam-reviewer` relit le code audio et cherche les réglages fixés sans rampe.

## 2. Tout événement est daté sur l'horloge du son

- Une note porte un instant : `currentTime` du moteur audio **plus l'avance**
  (`lookaheadMs` = 5 ms).
- La boucle programme par avance : un minuteur passe toutes les **25 ms** et
  programme les **100 ms** qui viennent, parce que les minuteurs du navigateur
  ne sont pas assez précis pour le rythme (§7.9). Un `setTimeout` ne cale
  jamais une note.
- En rendu hors ligne, `t` est l'instant de la prise : le même code produit la
  même liste d'événements (AIR-P-12).
- Les instants ne décroissent jamais et aucun événement ne précède l'image qui
  l'a causé (**AIR-P-11**).

## 3. Les voix sont bornées et toujours relâchées

- Huit voix au plus (`maxVoices`) ; au-delà, **la plus ancienne est reprise**
  (AIR-F-27, AIR-P-10).
- Si aucune image n'a été analysée depuis **300 ms** (`stallReleaseMs`) —
  onglet masqué, caméra figée — **toutes les voix sont relâchées** (AIR-F-16).
- Une main qui n'est plus vue tient ses valeurs **150 ms** (`graceMs`), puis
  ses notes sont relâchées (AIR-F-15). Toute note commencée a une fin
  (**AIR-P-09** : aucune voix active après la dernière image, le délai de
  grâce et l'extinction).

## La chaîne de sortie

```text
 voix 1 ┐
 voix 2 ┼─► mélange ─► réverbération ─► gain général ─► limiteur ─► sortie
  …     ┘              (calculée)      (−12 dB)        (plafond −1 dB)
```

- Réverbération **calculée**, jamais un fichier sonore (AIR-F-25). Le journal
  de bord note l'écart au §7.9 : un réseau de retards à réinjection plutôt
  qu'une convolution, parce que le même calcul doit tourner hors ligne et en
  direct.
- Limiteur : un compresseur réglé en limiteur, puis un plafond à −1 dB
  (`ceilingDb`). Le plafond se vérifie sur **chaque** rendu de test
  (**AIR-P-13**).
- Corde pincée : Karplus-Strong, une ligne à retard bouclée — 326,9
  échantillons pour le ré à 146,83 Hz à 48 000 par seconde. Elle vit dans un
  module audio à part (AudioWorklet) : dans le graphe ordinaire, un retard
  pris dans une boucle ne descend pas sous un bloc de 128 échantillons
  (2,67 ms), donc aucune note au-dessus de 375 Hz ne serait possible (§7.9).
- Moteur audio ouvert avec la consigne de retard « interactif ». Le retard
  affiché est la somme de `baseLatency` et `outputLatency` ; la seconde
  n'existe que dans les navigateurs récents — à défaut, l'écran dit que la
  mesure est **partielle** (`LatencyReport.partial`).
