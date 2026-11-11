# synth-engine — Tâches

## Conception d'abord

- [x] Un moteur pur, deux habillages (Node et worklet)
- [x] Ordre de la chaîne et plafond dur à −1 dB
- [x] Karplus-Strong dans un worklet, même classe hors ligne
- [x] Rampe exponentielle échantillon par échantillon (τ = 20 ms)
- [x] Réverbération en réseau de retards, écart au §7.9 noté au journal

## Implémentation

- [ ] `dsp/voice.ts` — `osc`, `pluck`, `fm`, `drum`, réglages par rampe
- [ ] `dsp/limiter.ts` — limiteur puis plafond dur (AIR-F-28)
- [ ] `dsp/reverb.ts` — réseau de retards, réglable et désactivable (AIR-F-30)
- [ ] `worklets/pluck` — AudioWorklet (AIR-F-29)
- [ ] `offline/render.ts` et `offline/wav.ts` — rendu dans un tableau, écriture WAV
- [ ] `measure.ts` — fréquence d'un palier, crête, niveau moyen, attaques, silence final
- [ ] AIR-P-13, 14, 15, 16 dans `packages/audio/src/**/*.test.ts`, graines consignées
- [ ] `no-audio-asset-guard` reste vert : aucun fichier sonore n'entre dans le dépôt
