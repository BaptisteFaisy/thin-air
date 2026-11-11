---
spec: synth-engine
parcours: "Conception d'abord"
exigences: [AIR-F-25, AIR-F-28, AIR-F-29, AIR-F-30]
proprietes: [AIR-P-13, AIR-P-14, AIR-P-15, AIR-P-16]
sections: ["§7.9", "§13.1", "§13.2"]
---

# synth-engine — Exigences

**Parcours : Conception d'abord** — le moteur est une conception (un seul code,
deux habillages), pas une liste de fonctionnalités.

## Critères (EARS)

- **AIR-F-25** — Tous les sons DOIVENT être synthétisés ; le système NE DOIT
  embarquer **aucun fichier sonore**.
- **AIR-F-28** — La sortie DOIT passer par un limiteur et ne jamais dépasser le
  plafond de **−1 dB** ; le volume général DOIT être réglable, à **−12 dB** par
  défaut.
- **AIR-F-29** — La corde pincée DOIT être synthétisée dans un module audio
  dédié (AudioWorklet), selon §7.9.
- **AIR-F-30 (S)** — Le système DOIT offrir une réverbération **calculée**,
  réglable et désactivable.
- **AIR-P-13** — Pour toute liste d'événements dans les bornes de voix, la
  crête du rendu ne dépasse pas −1 dB.
- **AIR-P-14** — Pour toute note de l'étendue tenue une demi-seconde, la
  fréquence mesurée est à **5 centièmes** près de la fréquence attendue.
- **AIR-P-15** — Une fois toutes les voix relâchées, le niveau passe sous
  −60 dB en **800 ms** sans réverbération, en **deux secondes** avec.
- **AIR-P-16** — Pour un glissé lent sans aimant, la fréquence mesurée par
  fenêtres de 10 ms ne fait aucun saut supérieur à celui d'une rampe idéale, à
  une tolérance près.
