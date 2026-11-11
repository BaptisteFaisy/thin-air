---
spec: stage-ui
parcours: "Conception d'abord"
exigences: [AIR-F-31, AIR-F-32, AIR-F-33, AIR-F-51, AIR-F-52, AIR-F-53]
proprietes: []
sections: ["§5.4", "§11.8", "§12", "§13.4"]
---

# stage-ui — Exigences

**Parcours : Conception d'abord** — la scène est un dessin continu, les réglages
sont des contrôles ordinaires : cette séparation est une conception, pas une
préférence, et elle décide de l'accessibilité (AIR-N-06).

## Critères (EARS)

- **AIR-F-31** — Le système DOIT afficher le retard **par composante**, en
  distinguant ce qui est mesuré de ce qui est estimé.
- **AIR-F-32** — SI la sortie audio déclarée dépasse **100 ms**, ALORS le
  système DOIT le signaler et conseiller une sortie filaire.
- **AIR-F-33** — Les libellés DOIVENT respecter le tableau de §5.4.
- **AIR-F-51** — Le système DOIT dessiner les mains, les zones ou les cordes,
  et une réponse visible à l'endroit du geste pour chaque note.
- **AIR-F-52** — L'image de la caméra NE DOIT pas être affichée par défaut ; un
  réglage DOIT permettre de l'afficher.
- **AIR-F-53 (S)** — OÙ le mode « Show the physics » est actif, le système DOIT
  afficher la fréquence, le nom de la note et la forme du son.
- **AIR-N-06** — WCAG 2.2 AA pour tous les réglages ; tout se règle au clavier ;
  respect de « moins de mouvement » ; aucun clignotement au-delà de trois fois
  par seconde.

## Le retard, tel que l'écran le dit (§5.2, §5.4)

> « analyse 12 ms, traitement 2 ms, sortie audio 21 ms ; caméra non mesurable,
> estimée entre 30 et 70 ms »

Toute valeur porte **« mesuré »** ou **« estimé »** (AIR-N-12). Si
`outputLatency` manque, l'écran dit que la mesure est partielle
(`LatencyReport.partial`). Les mots du tableau §5.4 sont interdits — le garde
`wording-guard.mjs` les refuse.

## États à traiter (§12.2)

Caméra refusée · aucune main depuis trois secondes · main perdue pendant une
note · sortie sans fil · onglet masqué · moteur audio suspendu par le
navigateur · calibration en cours · calibration refusée (trop petite).
