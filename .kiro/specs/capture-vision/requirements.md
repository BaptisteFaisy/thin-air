---
spec: capture-vision
parcours: "Quick Spec"
exigences: [AIR-F-01, AIR-F-02, AIR-F-03, AIR-F-04, AIR-F-06]
proprietes: []
sections: ["§7.2", "§7.3", "§14.1"]
---

# capture-vision — Exigences

**Parcours : Quick Spec** (petit, borné : une image, une analyse, deux mains).

## Critères (EARS)

- **AIR-F-01** — QUAND l'utilisateur clique « Start », le système DOIT demander
  la caméra, **sans audio**, et ouvrir le moteur audio. Avant ce clic, le
  système NE DOIT ni activer la caméra ni émettre un son.
- **AIR-F-02** — SI la caméra est refusée ou absente, ALORS le système DOIT
  proposer le jeu au pointeur et au clavier, avec le même moteur.
- **AIR-F-03** — Le système DOIT analyser chaque nouvelle image **une fois et
  une seule**, avec son horodatage.
- **AIR-F-04** — Le système DOIT suivre deux mains, leur attribuer un rôle, et
  conserver ce rôle par continuité tant que la main n'a pas disparu plus d'une
  demi-seconde.
- **AIR-F-06** — SI aucune main n'est reconnue pendant trois secondes alors que
  l'image change, ALORS le système DOIT conseiller plus de lumière ou plus de
  recul.
- **AIR-N-01** — Aucune image ne quitte le navigateur ; le modèle est servi par
  le site lui-même.
- **AIR-F-56 (X)** — Aucune demande d'accès au microphone.
- **AIR-F-57 (X)** — Aucun envoi d'image ni de prise vers un serveur.

## Ce qui n'est pas dans cette spec

Le filtrage (`filtering`), les gestes (`gestures`), le repère de jeu
(`play-space`). Le côté annoncé par le modèle est vérifié par la prise
`left-hand-only` (§7.3, recette §18).
