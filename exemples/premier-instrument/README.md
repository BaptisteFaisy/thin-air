# Premier instrument — le moteur, en vingt lignes

Je veux sonner une note. Voici comment, avec le moteur de Thin Air
installé comme n'importe quel paquet npm.

## Le programme

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_SETTINGS, measureNotes, peakDb } from "@thin-air/core";
import { encodeWav, renderEvents } from "@thin-air/audio";

const instrument = {
  format: "thin-air-instrument/1",
  name: "Onde",
  pointer: "palm",
  scale: { root: 69, steps: [0, 3, 5, 7, 10] },
  range: { low: 55, high: 84 },
  snap: 1,
  voices: 1,
  sound: { engine: "osc", wave: "sine", attackMs: 20, releaseMs: 200 },
};
const events = [
  { type: "noteOn", t: 0, voice: "v1", midi: 69, velocity: 0.8 },
  { type: "noteOff", t: 1, voice: "v1" },
];

const rendu = renderEvents(events, { instrument, ...DEFAULT_SETTINGS });
const [note] = measureNotes(rendu.samples, [{ t: 0, midi: 69, untilT: 1 }], {
  sampleRate: rendu.sampleRate,
});

mkdirSync("out", { recursive: true });
writeFileSync("out/note.wav", encodeWav(rendu.samples, rendu.sampleRate));
console.log(note.measuredHz.toFixed(2), note.cents.toFixed(2), peakDb(rendu.samples).toFixed(2));
```

Le fichier complet de cet exemple est [`index.ts`](index.ts) : il ajoute les
typages, un nom de sortie lisible et trois lignes d'affichage.

## L'installer

```bash
npm install @thin-air/core @thin-air/audio
```

Les deux paquets sont **source-only** : le consommateur compile le TypeScript
chez lui, donc un lanceur TypeScript est nécessaire (`tsx`, `ts-node`, ou un
bundler). Rien d'autre : pas de navigateur, pas de carte son, pas de réseau.

## L'exécuter

```bash
npx tsx index.ts
```

Sortie réelle (Node 22, dans le dépôt) :

```
fréquence : 440.00 Hz
écart     : 0.00 centièmes
niveau    : -13.92 dB
WAV écrit : out/premier-instrument.wav (aucun son émis)
```

Trois nombres, et un fichier `out/premier-instrument.wav`. **Aucun son n'est
émis** : le moteur calcule des échantillons, il ne touche à aucun périphérique
audio (AIR-N-02).

## Ce que le moteur fait, et ce qu'il ne fait pas

| Il fait | Il ne fait pas |
|---|---|
| Synthétiser des événements `MusicEvent` en `Float32Array` | Aucun son, aucune lecture |
| Écrire un WAV 16 bits mono | Aucun navigateur, aucun DOM |
| Mesurer fréquence, écart en centièmes, crête, silence final | Aucune Web MIDI API |
| Travailler déterministe, au bit près | Aucune analyse de mains, aucune caméra |

Le détail : [`docs/reprendre-le-moteur.md`](../../docs/reprendre-le-moteur.md).

## Dans ce dépôt

Cet exemple vit dans le workspace : il tourne sans installation, parce que
`node_modules/@thin-air/core` pointe déjà sur `packages/core`.

```bash
npx tsx exemples/premier-instrument/index.ts
```

C'est la seule différence avec un projet tiers : là-bas, on installe les
paquets publiés ; ici, le workspace fait déjà le lien.
