# midi-out — Conception

## Le limiteur de débit fait partie de la conception

Cent messages par seconde, pas plus (§7.12). Un `control` à la cadence des
images (60 par seconde) tient déjà dans le budget ; un glissé plus un volume
plus une brillance le dépasseraient. Décision : un **seau à jetons** par canal
de contrôleur (capacité 100, recharge 100 par seconde) : au-delà, le message le
plus récent remplace le plus ancien en attente plutôt que d'être empilé — un
contrôleur continu n'a de valeur que récent.

## L'aimant forcé, et pourquoi c'est une sécurité

Un fichier d'instrument à `snap: 0,6` envoie un glissé continu sur la molette de
hauteur. Un synthétiseur dont la molette est réglée sur ±2 demi-tons produira
un effet de vibrato involontaire au lieu d'une mélodie. Décision : tant que
l'étendue de la molette n'est pas déclarée, `snap` est traité comme 1 — des
notes franches, une par note MIDI. Une fois l'étendue déclarée (en demi-tons),
le glissé reprend, borné à cette étendue.

## La détection, sans dégrader le reste

`navigator.requestMIDIAccess` est testé une fois, au chargement, dans un
`try`. Absent ou refusé : la section MIDI n'est pas rendue du tout. Le reste de
l'application ne connaît pas MIDI : `packages/core/src/midi.ts` expose
l'écriture de fichier (AIR-F-39) et les messages (AIR-F-41) ; `apps/web` décide
seulement de les brancher.

## Ce qui n'est pas fait ici

Aucune sélection de canal, aucun programme, aucune banque : ce sont des réglages
de synthétiseur, pas de l'instrument. Le canal par défaut est le 1.
