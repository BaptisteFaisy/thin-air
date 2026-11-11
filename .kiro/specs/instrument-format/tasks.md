# instrument-format — Tâches

## Conception d'abord

- [x] Forme du fichier : une seule de `range` / `strings` / `zones`
- [x] Positions normalisées, hauteurs en MIDI ou en degrés, jamais en hertz
- [x] Trois couches de validation, une seule liste de clés
- [x] Les six instruments écrits et vérifiés (lot A7, `instruments/`)

## Implémentation

- [ ] `packages/schema/src/instrument.ts` — schéma Zod, `parseInstrument`, refus en entier (AIR-F-43, AIR-P-19)
- [ ] `stringifyInstrument` — aller-retour stable, clés triées (AIR-P-19)
- [ ] `instrumentToFragment` / `instrumentFromFragment` — base64url dans le fragment (AIR-F-45)
- [ ] `packages/core/src/instrument.ts` — lecture d'un fichier validé, gestes → `MusicEvent`
- [ ] Éditeur : dupliquer, changer gamme, fondamentale, étendue, cordes, zones, aimant, son (AIR-F-44)
- [ ] `it.todo("AIR-P-19 … — dépend du lot A4")` tant que le schéma manque
