# Rapport de mesure — exemple rempli (gabarit de commande)

Ce document est un **exemple réel** : les nombres ci-dessous sont la sortie du
script `oeuvre` lancé sur le gabarit `takes/pieces/modele-commande.json`,
recopiée telle quelle. Rien n'y est inventé, rien n'y est arrondi à la main.

C'est ce que nous renvoyons à un compositeur après réception de sa pièce : la
preuve, sans écoute, que l'œuvre est jouable et dans les bornes de la commande
(`docs/commande-oeuvre.md`).

## La commande lancée

```bash
npx tsx apps/bench/src/oeuvre.ts --session takes/pieces/modele-commande.json
```

Code de sortie : **0** (conforme).

## La sortie imprimée, recopiée

```text
pièce : takes/pieces/modele-commande.json
boucle : 10,667 s × 6 tours = 64,000 s
durée : 3072000 échantillons à 48000 Hz
crête : −26,24 dB (plafond −1,00 dB) — conforme
voix maximales : 8 au total (par couche : Harp 8)
notes par couche : Harp 48 — 48 au total
WAV : out/oeuvre-modele-commande.wav (6144044 octets)
aucun son émis : rendu hors ligne dans un fichier (AIR-N-02)
rapport : out/oeuvre-modele-commande.report.json
durée visée : 60–180 s — tenue
commande : tempo 90, 4 mesure(s), 1 couche(s) jouée(s) — conforme
```

Le chemin du WAV est affiché en absolu par le script (le chemin résolu sur la
machine qui rend) ; il est raccourci ici en relatif à la racine du dépôt. Le
nombre d'octets, lui, est recopié tel quel.

## Le rapport écrit, recopié

`out/oeuvre-modele-commande.report.json` :

```json
{
  "source": "takes/pieces/modele-commande.json",
  "tempo": 90,
  "bars": 4,
  "beatsPerBar": 4,
  "loopSeconds": 10.666666666666666,
  "tours": 6,
  "ceilingDb": -1,
  "peakConforme": true,
  "dureeCibleS": {
    "min": 60,
    "max": 180
  },
  "dureeConforme": true,
  "mesures": {
    "take": "takes/pieces/modele-commande.json",
    "instrument": "Harp",
    "sampleRate": 48000,
    "samples": 3072000,
    "durationS": 64,
    "notes": [],
    "peakDb": -26.236357198588497,
    "rmsDb": -44.03017406887446,
    "maxVoices": 8,
    "silenceAfterMs": 252.58333333333331
  },
  "couches": [
    {
      "id": 1,
      "instrument": "Harp",
      "notes": 48,
      "maxVoices": 8
    }
  ],
  "couchesMuettes": 0,
  "notesTotal": 48
}
```

## Ce que chaque nombre prouve

| Nombre | Valeur mesurée | Ce qu'il prouve |
|---|---|---|
| Durée exacte | **3 072 000 échantillons** à 48 000 Hz (64,000 s) | la pièce tient la durée visée (1 à 3 min) ; 6 tours de 10,667 s |
| Crête | **−26,24 dB** | sous le plafond de −1 dB (cahier §7.9) : aucune saturation |
| Niveau moyen | **−44,03 dB** | le gabarit est volontairement discret : une seule couche de harpe |
| Voix simultanées | **8** au maximum | dans la limite des 8 voix de la couche Harp |
| Notes | **48** (8 par tour × 6 tours) | chaque événement de la session a bien été joué |
| Silence final | **252,58 ms** | la queue de résonance s'éteint avant la fin du fichier |
| Couches muettes | **0** | aucune couche livrée vide |

Le champ `notes` du bloc `mesures` est vide ici : la justesse note par note se
mesure prise par prise avec `bench render` (cahier §13), pas sur un mélange
polyphonique. Le rapport de l'œuvre porte les nombres de la pièce entière.

## Ce que ce rapport ne prouve pas

Il ne dit rien de la musique : ni si c'est beau, ni si la forme tient, ni si le
timbre convient. Aucun agent et aucune CI n'écoutent (AIR-N-02). L'écoute reste
une séance humaine, avec la grille de `docs/seance-ecoute.md`.

## Reproduire

```bash
npx tsx apps/bench/src/oeuvre.ts --session takes/pieces/modele-commande.json
npx tsx apps/bench/src/oeuvre.ts --help
npx tsx apps/bench/src/oeuvre.ts --session votre-piece.json --tours 3 --no-wav
```

Le rendu est **déterministe** : deux passages sur la même session donnent les
mêmes nombres et les mêmes échantillons. Aucun fichier sonore n'est versionné
— `out/` est ignoré par git, et la garde `no-audio-asset-guard` refuse tout
échantillon dans le dépôt.
