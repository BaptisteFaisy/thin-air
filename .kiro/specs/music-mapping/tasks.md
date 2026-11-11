# music-mapping — Tâches

- [x] `SCALES` — les huit gammes du §7.7 dans `music.ts`
- [ ] `midiToFreq` / `freqToMidi` — la note 69 vaut 440 Hz, +12 double (AIR-P-04)
- [ ] `degreeToMidi` — `r + 12⌊k/n⌋ + s[k mod n]`
- [ ] `pitchFromU` — affine croissante en `u` (AIR-P-03)
- [ ] `quantizeToScale` — pure et croissante ; l'hystérésis vit à côté, pas dedans (AIR-P-03)
- [ ] Bornage à l'étendue **avant** la quantification (AIR-P-05)
- [ ] `applyMagnet` — combinaison convexe `m + a(q − m)` (AIR-F-19)
- [ ] `dbFromV` / `gainFromV` / `dbToGain` / `gainToDb` — courbe `db48`, silence sous 5 % (AIR-F-20)
- [ ] Noms de notes pour l'affichage et le rapport de rendu
- [ ] `music.test.ts` — AIR-P-03, 04, 05 par fast-check, graines consignées
