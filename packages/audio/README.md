# `@thin-air/audio`

Le moteur sonore de Thin Air, à deux faces (cahier §7.9, §11.1) :

- **`dsp/` + `offline/`** : calcul pur, dans Node, sans navigateur ni
  périphérique audio. C'est ce qui rend un `Float32Array` puis l'écrit en WAV.
- **`graph/` + `worklets/`** : le même calcul branché sur Web Audio pour le jeu
  direct. Les voix sont les mêmes classes, échantillon par échantillon.

Pour un tiers qui veut **rendre sans navigateur**, seule la face hors ligne
compte : elle n'a **aucune dépendance au DOM** et importe proprement dans Node.

## Ce que ce paquet exige

- **Node ≥ 22** et **TypeScript strict** (ESM).
- `@thin-air/core` (même version), déclaré en dépendance.

## Ce qu'il fait

- `renderEvents(events, options)` : synthétise une liste de `MusicEvent` en un
  `Float32Array` (mélange des voix → réverbération → gain → plafond), borné en
  voix et déterministe au bit près ;
- `encodeWav(samples, sampleRate)` / `decodeWav(bytes)` : WAV 16 bits mono ;
- les moteurs de voix (`osc`, `pluck`, `fm`, `drum`) via `createVoice`.

## Ce qu'il ne fait PAS

- **Aucun son émis**, jamais (AIR-N-02) : pas de `AudioContext` ouvert, pas de
  haut-parleur, pas de réglage de volume système. Les échantillons restent dans
  un tableau (ou un fichier que VOUS écrivez).
- **Aucune horloge lue** : hors ligne, `t` est l'instant de la prise, pas
  `Date.now()`.

## Exemple complet (vérifié)

Une note tenue (MIDI 69) est rendue, mesurée, puis écrite en WAV dans `/tmp`.
Rien n'est écouté.

```ts
import { writeFileSync } from "node:fs";
import type { Instrument, MusicEvent } from "@thin-air/core";
import { DEFAULT_SETTINGS, finalSilenceMs, measureNotes, peakDb } from "@thin-air/core";
import { encodeWav, renderEvents } from "@thin-air/audio";

const instrument: Instrument = {
  format: "thin-air-instrument/1",
  name: "Exemple",
  pointer: "palm",
  scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 11] },
  range: { low: 45, high: 81 },
  snap: 1,
  voices: 1,
  sound: { engine: "osc", wave: "sine", second: 0.15, attackMs: 60, releaseMs: 250, glideMs: 30 },
};

const evenements: readonly MusicEvent[] = [
  { type: "noteOn", t: 0, voice: "v1", midi: 69, velocity: 0.8 },
  { type: "noteOff", t: 1, voice: "v1" },
];

const rendu = renderEvents(evenements, {
  instrument,
  masterGainDb: DEFAULT_SETTINGS.masterGainDb,
  ceilingDb: DEFAULT_SETTINGS.ceilingDb,
  reverb: DEFAULT_SETTINGS.reverb,
  maxVoices: DEFAULT_SETTINGS.maxVoices,
  paramTauMs: DEFAULT_SETTINGS.paramTauMs,
});

const [note] = measureNotes(rendu.samples, [{ t: 0, midi: 69, untilT: 1 }], { sampleRate: rendu.sampleRate });
console.log(`mesurée ${note.measuredHz.toFixed(2)} Hz — écart ${note.cents.toFixed(2)} centièmes`);
console.log(`crête ${peakDb(rendu.samples).toFixed(1)} dB — silence final ${finalSilenceMs(rendu.samples, rendu.sampleRate)} ms`);
console.log(`${rendu.samples.length} échantillons à ${rendu.sampleRate} Hz (${rendu.durationS.toFixed(2)} s), voix max ${rendu.maxVoices}`);
writeFileSync("/tmp/thin-air-exemple.wav", encodeWav(rendu.samples, rendu.sampleRate));
console.log("WAV écrit : /tmp/thin-air-exemple.wav — aucun son émis");
```

Sortie réelle (Node 22, exécuté le 2026-11-11) :

```
mesurée 440.00 Hz — écart 0.00 centièmes
crête -14.1 dB — silence final 404.5 ms
98400 échantillons à 48000 Hz (2.05 s), voix max 1
WAV écrit : /tmp/thin-air-exemple.wav — aucun son émis
```

Reproduction — dans le dépôt : `npx tsx exemple.ts` ; après publication :
`npm i @thin-air/audio` puis `npx tsx exemple.ts`.

## Où est le reste

- Le lot hors ligne et les garanties : `packages/audio/src/offline/`.
- La frontière paquet par paquet : `docs/bibliotheque.md`.