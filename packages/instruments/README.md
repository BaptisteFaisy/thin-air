# `packages/instruments` — le point d'entrée des bancs du lot A7

Ce paquet ne contient aucun code de production : seulement le point d'entrée
Vitest des bancs du lot A7.

Les bancs eux-mêmes vivent à côté de ce qu'ils contrôlent, dans `instruments/`
à la racine (`instruments.test.ts` pour les six instruments-fichiers,
`guards.test.ts` pour les gardes de `scripts/hooks/`). Or `vitest.config.ts`
n'inclut que `packages/*/src/**` et `apps/*/src/**` : sans ce point d'entrée,
`npx vitest run` ne les verrait pas. Le fichier `src/instruments.test.ts`
importe donc les deux bancs, sans rien dupliquer.

Modifier `vitest.config.ts` est interdit à un lot (`docs/CONTRACT.md`) : cette
indirection est la façon la plus petite de rendre les bancs du lot visibles.
