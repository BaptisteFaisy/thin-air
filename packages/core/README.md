# `@thin-air/core`

Le contrat public du moteur Thin Air : la musique (gammes, justesse, aimant),
les événements (`MusicEvent`, la couture des deux horloges), la géométrie de
jeu, et la mesure d'un tableau d'échantillons. Tout est du **TypeScript pur**,
calculé sur des nombres — aucune dépendance, pas même `zod`.

## Ce que ce paquet exige

- **Node ≥ 22** et **TypeScript en mode strict** (`strict`, ESM `"type": "module"`).
- Aucune dépendance d'exécution.

## Ce qu'il fait

- Convertit une position `u` en hauteur MIDI, une position `v` en gain ;
- fabrique et trie des `MusicEvent` (`noteOn`, `noteOff`, `control`) ;
- mesure un `Float32Array` déjà rendu : fréquence dominante, écart en
  centièmes, crête, RMS, silence final (`measureNotes`, `peakDb`, `finalSilenceMs`…) ;
- expose `DEFAULT_SETTINGS` et `SAMPLE_RATE` (48 000 Hz).

## Ce qu'il ne fait PAS

- **Aucun son** (AIR-N-02) : pas de lecteur, pas de périphérique, pas de volume.
- **Aucun navigateur**, aucun accès DOM.
- **Aucune horloge lue** : pas de `Date.now()`, pas de `Math.random()` sans
  graine — le rendu et la mesure sont déterministes au bit près (AIR-N-09).
- **Aucune synthèse** : produire les échantillons revient à `@thin-air/audio`.
- **Aucune validation de fichier** : c'est `@thin-air/schema`.

## Exemple complet (vérifié)

On forge un `la 440` (MIDI 69) comme une sinusoïde de 0,5 s, puis on le mesure.
Aucun son n'est émis : ce n'est qu'un tableau de nombres.

```ts
import { SAMPLE_RATE, measureNotes, midiToFreq, noteName, peakDb } from "@thin-air/core";

const midi = 69; // le la 440
const frequence = midiToFreq(midi);
const dureeS = 0.5;
const echantillons = new Float32Array(Math.round(dureeS * SAMPLE_RATE));
for (let i = 0; i < echantillons.length; i++) {
  echantillons[i] = 0.5 * Math.sin((2 * Math.PI * frequence * i) / SAMPLE_RATE);
}

const [note] = measureNotes(echantillons, [{ t: 0, midi, untilT: dureeS }], { sampleRate: SAMPLE_RATE });
console.log(`${noteName(midi)} attendue ${frequence.toFixed(2)} Hz, mesurée ${note.measuredHz.toFixed(2)} Hz`);
console.log(`écart : ${note.cents.toFixed(2)} centièmes — crête : ${peakDb(echantillons).toFixed(1)} dB`);
```

Sortie réelle (Node 22, exécuté le 2026-11-11) :

```
A4 attendue 440.00 Hz, mesurée 440.00 Hz
écart : 0.00 centièmes — crête : -6.0 dB
```

Reproduction — dans le dépôt : `npx tsx exemple.ts` ; après publication :
`npm i @thin-air/core` puis `npx tsx exemple.ts`.

## Où est le reste

- La signature `MusicEvent` et les types partagés : `packages/core/src/types.ts`.
- Les frontières entre les trois paquets : `docs/bibliotheque.md`.
- Le contrat de construction : `docs/CONTRACT.md`.