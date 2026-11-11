# gestures — Tâches

## Exigences d'abord : l'analyse

- [x] Critères EARS écrits pour AIR-F-12, 14, 16, 17
- [x] Tableau des seuils du §7.6 recopié
- [x] **Analyse de contradiction** : les quatre délais, la hiérarchie écrite, la décision sur le verrou de maintien (`design.md`)
- [ ] Relecture croisée avec `seam-and-voices` : la même prise `hand-leaves-mid-note` doit donner le même verdict dans les deux specs
- [ ] Consigner le coût réel de cette spec en crédits (§14.6, annexe D)

## Implémentation

- [ ] `gestures.ts` — machine à états par geste, deux seuils, `phase: start | end` (AIR-F-14)
- [ ] `gestures.ts` — zones : entrée réduite de 10 %, sortie agrandie de 10 %, deux mains dans une zone
- [ ] `gestures.ts` — traversée : changement de côté + vitesse > 0,15, réarmement de 80 ms par corde (AIR-F-17)
- [ ] `gestures.ts` — sortie de main : 150 ms de tenue, puis relâchement (AIR-F-15)
- [ ] `gestures.ts` — relâchement global à 300 ms sans image, onglet masqué compris (AIR-F-16)
- [ ] `gestures.ts` — maintien : 400 ms dans une zone, verrou qui tombe avec la main (AIR-F-12, décision de `design.md`)
- [ ] `roles.ts` — appariement par distance, rôle stable au croisement (AIR-P-21)
- [ ] `takeGen.ts` — tremblement d'amplitude donnée, traversée, sortie de main, images manquantes

## Propriétés

- [ ] AIR-P-06 — marge : au plus un changement de note sous l'amplitude de marge
- [ ] AIR-P-07 — une traversée, une note ; tremblement ⇒ au plus un par 80 ms
- [ ] AIR-P-08 — balayage montant puis descendant, même liste de notes
- [ ] AIR-P-21 — deux mains qui se croisent n'échangent pas leurs rôles
- [ ] `it.todo` tant que `voices` et `schedule` manquent (lot B2) — jamais `it.skip`
