# capture-vision — Tâches

- [x] Contrat : `DetectedHand`, `TakeFrame`, `Take` dans `packages/core/src/types.ts`
- [ ] `packages/vision/src/camera.ts` — permission, `audio: false`, arrêt propre (AIR-F-01, AIR-F-56)
- [ ] `packages/vision/src/landmarker.ts` — `detectForVideo` synchrone, mesure d'`inferenceMs`, deux mains, seuils 0,5
- [ ] `packages/vision/src/source.ts` — trois sources : caméra, pointeur, rejeu (AIR-F-02)
- [ ] Une image, une analyse : compteur d'analyses par image dans un test (AIR-F-03)
- [ ] `apps/web` : le clic « Start » fait les deux gestes (caméra et moteur audio)
- [ ] Conseil à trois secondes sans main, seulement si l'image change (AIR-F-06)
- [ ] Essai de bout en bout avec un fichier vidéo en guise de caméra (AIR-N-10)
- [ ] Vérifier le côté sur `takes/reference/left-hand-only` (§7.3, annexe D)
