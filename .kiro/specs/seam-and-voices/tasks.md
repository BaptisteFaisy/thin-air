# seam-and-voices — Tâches

## Conception d'abord

- [x] §7.9 recopié comme entrée de la conception
- [x] Décision : `schedule` ne lit jamais l'horloge murale
- [x] Décision : l'allocateur est pur, l'ordre est trié, pas celui d'un `Map`
- [x] Décision : changement d'instrument = rampe de gain puis `noteOff` (AIR-F-24)
- [x] Décision : trois mécanismes cumulés contre la note coincée (AIR-P-09)

## Implémentation

- [ ] `schedule.ts` — datation `instant + lookahead`, fenêtre de 100 ms programmée toutes les 25 ms (AIR-F-26)
- [ ] `voices.ts` — allocateur borné, reprise de la plus ancienne (AIR-F-27, AIR-P-10)
- [ ] `voices.ts` — ordre total (instant, ordre d'apparition), jamais un `Map` (AIR-P-12)
- [ ] `voices.ts` — fondu au changement d'instrument (AIR-F-24)
- [ ] `voices.ts` — relâchement à 300 ms sans image (AIR-F-16)
- [ ] `it.todo` pour AIR-P-09/10/11/12 tant que le rendu (lot A5) manque
