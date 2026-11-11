---
inclusion: always
---

# Arborescence et frontières

```text
.
├── .kiro/          specs, steering, hooks, agents — livré avec le produit
├── apps/web/       le site (scène, boucle, réglages, calibration, éditeur)
├── apps/bench/     le banc d'essai : événements, rendu, rapport (§11.6)
├── packages/core/  pur : space, filter, features, gestures, music,
│                   instrument, voices, schedule, loop, midi, measure
├── packages/audio/ graphe, voix, module de corde, rendu hors ligne
├── packages/vision/ caméra, modèle, lecture et écriture des prises
├── packages/schema/ instrument, prise, session (Zod)
├── instruments/    les six instruments-fichiers (§7.8)
├── takes/          prises de référence et prises de synthèse (§13.3)
├── scripts/hooks/  les gardes appelées par les hooks et par la CI
└── docs/           cahier des charges, contrat, journal, mesures de retard
```

## Frontières

`docs/CONTRACT.md` est la seule autorité sur qui écrit quoi. Un lot ne touche
pas aux fichiers d'un autre, ni à `package.json`, `package-lock.json`,
`tsconfig*.json`, `vitest.config.ts`, `.github/`. Les signatures exportées du
squelette sont figées : on implémente les corps, on ne renomme pas un export,
on ne change pas un type de `packages/core/src/types.ts`. Un besoin de
changement de contrat se dit dans le compte rendu, il ne se fait pas.

## Taille et duplication

- Aucun fichier de code au-delà de **500 lignes**, aucune fonction au-delà de
  **50 lignes** : découper en modules plutôt que laisser grossir.
- **Aucune duplication** : une logique = une implémentation. Les gardes
  partagent leurs utilitaires dans `scripts/hooks/lib/` ; la musique, les
  mesures et les défauts viennent de `@thin-air/core`.
- Une valeur de réglage ne vit nulle part ailleurs que dans
  `packages/core/src/defaults.ts` (§7.13). Un instrument peut en surcharger
  une part dans son champ `defaults`, jamais la redéfinir.

## Où va quoi

- Un nombre du cahier (seuil, délai, fréquence) va dans `defaults.ts` ou dans
  le fichier d'instrument, pas dans le code qui s'en sert.
- Un test vit à côté du code qu'il contrôle (`*.test.ts`).
- Une décision qui s'écarte du cahier va dans `docs/journal.md`.
