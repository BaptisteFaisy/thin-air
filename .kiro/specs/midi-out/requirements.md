---
spec: midi-out
parcours: "Quick Spec (option)"
exigences: [AIR-F-41]
proprietes: []
sections: ["§7.12", "annexe D"]
---

# midi-out — Exigences

**Parcours : Quick Spec (option)** — AIR-F-41 est priorité **S**, et Web MIDI
manque dans Safari : la fonction est détectée et masquée quand elle manque.

## Critère (EARS)

- **AIR-F-41 (S)** — OÙ le navigateur le permet, le système DOIT envoyer notes
  et réglages vers une sortie MIDI, selon §7.12.

## Ce que §7.12 impose

- Web MIDI existe dans **Chrome, Edge et Opera** ; **Safari** ne le propose pas.
  La fonction est détectée, et **masquée** quand elle manque — pas d'erreur, pas
  de bouton grisé sans explication (annexe D : tableau de compatibilité à
  vérifier).
- Notes avec leur force ; glissé par la molette de hauteur ; volume et brillance
  par des contrôleurs continus, **limités à cent messages par seconde**.
- **L'aimant est forcé à 1** tant que l'utilisateur n'a pas déclaré l'étendue de
  la molette de son synthétiseur : un glissé de trois octaves ne tient pas dans
  le réglage courant de deux demi-tons.

## Ce que cette spec ne fait pas

Elle ne remplace pas l'export MIDI d'une session (AIR-F-39, spec `loop-export`) :
l'un joue en direct vers un instrument externe, l'autre écrit un fichier.
