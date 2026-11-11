# stage-ui — Tâches

## Conception d'abord

- [x] Séparation scène (canevas) / réglages (contrôles HTML hors canevas)
- [x] Retard en tableau de composantes, chacune « mesurée » ou « estimée »
- [x] Réponse au geste, sans clignotement au-delà de trois fois par seconde
- [x] `prefers-reduced-motion` respecté

## Implémentation

- [ ] `App.tsx` — écrans : accueil, scène, boucle, réglages, calibration, éditeur (§12.1)
- [ ] Scène : mains, zones ou cordes, réponse au geste (AIR-F-51)
- [ ] Retard par composante, avec la nature de chaque valeur (AIR-F-31, AIR-N-12)
- [ ] Encart « sortie filaire » au-delà de 100 ms (AIR-F-32)
- [ ] `showCamera` faux par défaut, réglage pour l'afficher (AIR-F-52)
- [ ] « Show the physics » : fréquence, nom de la note, forme du son (AIR-F-53)
- [ ] Les huit états du §12.2, chacun avec son texte
- [ ] Contrôle automatique d'accessibilité sans erreur ; tout au clavier (AIR-N-06, recette §18)
- [ ] `wording-guard` vert sur tout `apps/web` (AIR-F-33)
