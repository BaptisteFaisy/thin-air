# La pièce — `seance-1min`

La pièce de démonstration vit dans un fichier : `takes/pieces/seance-1min.json`,
une `Session` du format `thin-air-session/1`, validée par `parseSession`
(`@thin-air/schema`). Elle n'est jamais écoutée pendant sa construction — elle
est rendue hors ligne, mesurée, et les nombres sont recopiés ici (AIR-N-02).

## Ce que c'est

- **Boucle** : 90 battements par minute, 4 mesures de 4 temps → 10,667 s. La
  pièce rejoue cette boucle **6 fois** : 64,000 s, « environ une minute ».
- **Tonalité** : ré mineur harmonique (cahier §7.7) — ré, mi, fa, sol, la,
  si bémol, do dièse. Une seule note échappe à la gamme : aucune ; toutes les
  hauteurs (classes 2, 4, 5, 7, 9, 10, 1 mod 12) y appartiennent, et chaque
  attaque tombe sur la double croche (k/6 s ; 166,7 ms à 90 bpm).
- **Quatre couches**, nommées d'après les instruments du dépôt (`instruments/`).
  Chaque couche est un fichier d'instrument rendu par le moteur de
  `@thin-air/audio`, et la boucle qui déroule les événements vient de
  `@thin-air/core` (`loopEventsAt`) : rien n'est recopié.

| Couche | Instrument | Rôle dans la pièce | Notes / tour |
|---|---|---|---|
| 1 | `Drone` | Basse tenue ; glisse ré 2 → si♭ 1 → la 1, rattrapée en ré 2 au tour | 1 |
| 2 | `Choir` | Accords tenus, deux voix : i (ré m) – i (ré m) – VI (si♭) – V (la) | 6 |
| 3 | `Harp` | Arpèges des mesures 3 et 4, une corde par temps (si♭ puis la) | 8 |
| 4 | `Phantom` | Mélodie thérémine, une voix par note, queues de release qui se chevauchent | 13 |

Harmonie, en ré mineur harmonique : **i – i – VI – V**. La cadence do♯ → ré en
fin de boucle referme la pièce « fantôme » : la dernière note de la boucle est
la première de la suivante.

## Les nombres mesurés

Rendus par `npx tsx apps/bench/src/piece.ts`, recopiés tels quels :

| Mesure | Valeur |
|---|---|
| Boucle | 10,667 s × 6 tours |
| Durée totale | 3 072 000 échantillons à 48 000 Hz (64,000 s) |
| Crête | **−7,94 dB** (plafond −1,00 dB) — conforme |
| Voix maximales (borne supérieure) | **15** — Drone 1, Choir 4, Harp 8, Phantom 2 |
| Notes | Drone 6, Choir 36, Harp 48, Phantom 78 — **168** au total |
| Fichier produit | `out/piece.wav` — 6 144 044 octets |

## La commande pour reproduire

```bash
npx tsx apps/bench/src/piece.ts           # rend out/piece.wav et imprime les nombres
npx tsx apps/bench/src/piece.ts --help    # toutes les options
npx tsx apps/bench/src/piece.ts --tours 1 --no-wav   # un seul tour, sans WAV
```

Le rendu est **déterministe** : aucun aléa, aucune horloge lue ; deux passages
produisent des échantillons identiques au bit près (testé). Aucun son n'est émis
(AIR-N-02) : tout est calculé dans des tableaux, écrit dans `out/` (ignoré par
git), jamais joué.

## Ce qui reste humain

Ni l'agent ni la CI n'écoutent ni ne regardent la pièce (AIR-N-02) : la machine
calcule des échantillons et des nombres, jamais une expérience. Trois gestes
restent donc à une personne humaine (Baptiste, ou une oreille / un œil de
confiance), et eux seuls :

- **Écouter** la pièce rendue (`out/piece.wav`, ou l'export WAV depuis la page)
  et remplir la grille des dix questions — le kit est `docs/seance-ecoute.md`,
  dont le tableau reste vide jusqu'à la séance.
- **Filmer** la vidéo de démonstration (moins de trois minutes) : préparation,
  preuves à l'écran par plan et mots à ne jamais dire dans `docs/video-kit.md`.
- **Publier** le billet et le post social : brouillons à relire par Baptiste
  dans `docs/blog-brouillon.md` et `docs/social-brouillon.md` — aucune
  publication automatique.

Les nombres ci-dessus sont la preuve machine ; l'écoute et l'image sont la
preuve humaine, et l'une ne se déduit jamais de l'autre.
