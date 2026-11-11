# loop-export — Tâches

- [ ] `loop.ts` — durée de boucle en entiers, 512 000 échantillons à 90/4/4 (AIR-P-17)
- [ ] `loop.ts` — compensation `measuredTotalMs + cameraLatencyMs`, modulo positif (AIR-F-35)
- [ ] `loop.ts` — calage croche / double croche, force 0 et 1 exactes (AIR-F-37)
- [ ] `loop.ts` — six couches au plus, retirer la dernière, couper, effacer (AIR-F-34, AIR-F-36)
- [ ] `midi.ts` — écriture puis relecture, 96 ticks par noire, une piste par couche (AIR-F-39, AIR-P-18)
- [ ] `offline/wav.ts` — export WAV par le moteur de rendu (AIR-F-38)
- [ ] Session `thin-air-session/1` en JSON, sans horodatage absolu (AIR-F-40)
- [ ] `loop.test.ts` — AIR-P-17 par fast-check (force 0 / force 1), graines consignées
- [ ] `it.todo` pour AIR-P-18 tant que `midi.ts` n'est pas écrit (lot A6)
