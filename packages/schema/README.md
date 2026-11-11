# `@thin-air/schema`

La validation par schéma des fichiers Thin Air : un instrument
(`thin-air-instrument/1`) et une prise (`thin-air-take/1`). Elle repose sur
`zod` et refuse **en entier** tout fichier invalide, avec une raison lisible —
jamais de valeur par défaut silencieuse (cahier §11.2, AIR-F-43, AIR-P-19).

## Ce que ce paquet exige

- **Node ≥ 22** et **TypeScript strict** (ESM).
- `zod` (déclaré en dépendance) ; les types partagés viennent de
  `@thin-air/core` (import de type uniquement).

## Ce qu'il fait

- `parseInstrument(json)` / `parseTake(json)` : un `ParseResult` soit
  `{ ok: true, value }`, soit `{ ok: false, reasons }` (au moins une raison) ;
- `instrumentToFragment` / `encodeTake` : le passage inverse, quand il existe.

## Ce qu'il ne fait PAS

- **Aucun son**, aucun navigateur, aucun accès au système de fichiers : la
  fonction reçoit du JSON déjà lu (`unknown`), c'est vous qui le lisez.
- **Aucune réparation** : une altération est refusée entière, jamais corrigée.

## Exemple complet (vérifié)

Un instrument valide est accepté ; le même avec un champ inconnu est refusé en
entier, la raison nommée.

```ts
import { parseInstrument } from "@thin-air/schema";

const json = {
  format: "thin-air-instrument/1",
  name: "Drone",
  pointer: "palm",
  scale: { root: 33, steps: [0, 3, 7, 10] },
  range: { low: 33, high: 44 },
  snap: 1,
  voices: 2,
  controls: [{ feature: "u", to: "pitch" }],
  sound: { engine: "osc", wave: "sawtooth", detuneCents: 5, attackMs: 500, releaseMs: 800 },
};

const lu = parseInstrument(json);
console.log(lu.ok ? `accepté : ${lu.value.name}, ${lu.value.voices} voix` : `refusé : ${lu.reasons.join(" ; ")}`);

const altere = parseInstrument({ ...json, couleur: "bleu" });
console.log(altere.ok ? "accepté" : `refusé EN ENTIER : ${altere.reasons.join(" ; ")}`);
```

Sortie réelle (Node 22, exécuté le 2026-11-11) :

```
accepté : Drone, 2 voix
refusé EN ENTIER : couleur: unexpected field — refused as a whole
```

Reproduction — dans le dépôt : `npx tsx exemple.ts` ; après publication :
`npm i @thin-air/schema` puis `npx tsx exemple.ts`.

## Où est le reste

- La règle commune « refus en entier » : `packages/schema/src/common.ts`.
- La frontière paquet par paquet : `docs/bibliotheque.md`.