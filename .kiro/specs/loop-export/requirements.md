---
spec: loop-export
parcours: "Exigences d'abord"
exigences: [AIR-F-34, AIR-F-35, AIR-F-36, AIR-F-37, AIR-F-38, AIR-F-39, AIR-F-40]
proprietes: [AIR-P-17, AIR-P-18]
sections: ["§7.10", "§11.5", "§13.2"]
---

# loop-export — Exigences

**Parcours : Exigences d'abord** — la boucle a des chiffres exacts (tempo,
mesures, durées, compensation) et une propriété qui les vérifie ; les critères
s'écrivent avant.

## Critères (EARS)

- **AIR-F-34** — Le système DOIT enregistrer et rejouer une boucle d'une, deux
  ou quatre mesures, au tempo choisi, sur six couches au plus.
- **AIR-F-35** — Le système DOIT avancer les événements enregistrés du **retard
  estimé**, selon §7.10.
- **AIR-F-36** — Le système DOIT permettre de retirer la dernière couche, d'en
  couper une et de tout effacer.
- **AIR-F-37 (S)** — Le système DOIT permettre de caler les événements à la
  croche ou à la double croche, avec une force réglable de 0 à 100 %.
- **AIR-F-38** — Le système DOIT exporter la boucle en fichier **WAV** par un
  rendu hors ligne.
- **AIR-F-39 (S)** — Le système DOIT exporter la boucle en fichier **MIDI**,
  une piste par couche.
- **AIR-F-40 (S)** — Le système DOIT enregistrer et rouvrir une session en JSON.
- **AIR-P-17** — La compensation avance chaque événement exactement du retard
  choisi, en restant dans la boucle ; un calage de force 1 place chaque attaque
  sur la grille, un calage de force 0 ne change rien ; le rendu d'une boucle a
  **exactement** la durée de ses mesures.
- **AIR-P-18** — Écrire une session en fichier MIDI puis la relire redonne les
  mêmes notes, à une unité de temps du fichier près.

## Les chiffres de §7.10, à ne pas arrondir

- 90 battements par minute par défaut (de 60 à 140), quatre temps.
- À 90 : une mesure dure **2,667 s**, quatre mesures **10,67 s**, une double
  croche **166,7 ms**.
- Quatre mesures à 48 000 échantillons par seconde : **exactement 512 000**
  échantillons, soit 10,67 s (recette §18).
- Compensation : la part mesurée plus **50 ms** pour la caméra
  (`cameraLatencyMs`, réglable de 0 à 120). Sans elle, avec 105 ms de retard,
  chaque note tombe en retard de **63 %** d'une double croche.
