/**
 * Les prises de référence du cahier §13.3, et les nombres de la recette §18.
 *
 * Une prise est une donnée, pas une formule : chaque forme ci-dessous est
 * fabriquée par un générateur de `@thin-air/core` (`takeGen.ts`, lot B1) et
 * figée en JSON dans `takes/reference/`. Ce fichier ne porte que les
 * positions choisies et les valeurs attendues, recopiées du cahier pour
 * qu'elles ne se perdent pas.
 */
import type { Take } from "@thin-air/core";

import { synthTake, withVolumeHand } from "./synth.js";

/** Une prise de référence : son fichier, son instrument, sa forme. */
export interface ReferenceTakeSpec {
  /** Nom du fichier, sans extension : `slow-rise.json`. */
  readonly name: string;
  readonly description: string;
  /** Chemin de l'instrument, propriété du lot A7. */
  readonly instrument: string;
  /** Durée attendue, en secondes. */
  readonly durationS: number;
  readonly build: () => Take;
}

/** Géométrie de l'exemple du thérémine (cahier §7.14). */
export const THEREMIN_GEOMETRY = {
  /** Étendue de l'instrument Phantom, en notes MIDI (110 à 880 Hz). */
  lowMidi: 45,
  highMidi: 81,
  /** La main de hauteur va de `u` 0,30 à 0,60 en trois secondes. */
  fromU: 0.3,
  toU: 0.6,
  durationS: 3,
  /** La main de volume reste à `v` 0,75, soit −12 dB. */
  volumeV: 0.75,
  /** Marge d'hystérésis de la note, 15 % de l'écart entre deux voisines. */
  hysteresis: 0.15,
  /** Cadence de la prise. */
  fps: 30,
} as const;

/** Les huit notes du thérémine, telles que le cahier les donne. */
export const THEREMIN_NOTES: readonly {
  readonly passage: string;
  /** Seuil franchi, en note continue ; `null` pour la note de départ. */
  readonly thresholdMidi: number | null;
  readonly u: number;
  readonly t: number;
  readonly hz: number;
}[] = [
  { passage: "départ sur sol", thresholdMidi: null, u: 0.3, t: 0, hz: 196.0 },
  { passage: "sol → la", thresholdMidi: 56.3, u: 0.314, t: 0.139, hz: 220.0 },
  { passage: "la → si bémol", thresholdMidi: 57.65, u: 0.351, t: 0.514, hz: 233.08 },
  { passage: "si bémol → do dièse", thresholdMidi: 59.95, u: 0.415, t: 1.153, hz: 277.18 },
  { passage: "do dièse → ré", thresholdMidi: 61.65, u: 0.463, t: 1.625, hz: 293.66 },
  { passage: "ré → mi", thresholdMidi: 63.3, u: 0.508, t: 2.083, hz: 329.63 },
  { passage: "mi → fa", thresholdMidi: 64.65, u: 0.546, t: 2.458, hz: 349.23 },
  { passage: "fa → sol", thresholdMidi: 66.3, u: 0.592, t: 2.917, hz: 392.0 },
];

/** Géométrie de l'exemple de la harpe (cahier §7.14). */
export const HARP_GEOMETRY = {
  strings: 16,
  fromU: 0.2,
  toU: 0.45,
  durationS: 0.5,
  /** Force attendue d'un pincement à 0,5 largeur par seconde : 0,5 / 3. */
  velocity: 0.17,
  fps: 30,
} as const;

/** Les quatre notes de la harpe, telles que le cahier les donne. */
export const HARP_NOTES: readonly {
  readonly string: number;
  readonly u: number;
  readonly t: number;
  readonly name: string;
  readonly hz: number;
}[] = [
  { string: 3, u: 0.219, t: 0.038, name: "la", hz: 220.0 },
  { string: 4, u: 0.281, t: 0.163, name: "do", hz: 261.63 },
  { string: 5, u: 0.344, t: 0.288, name: "ré", hz: 293.66 },
  { string: 6, u: 0.406, t: 0.413, name: "fa", hz: 349.23 },
];

/** La boucle de la recette : quatre mesures à 90 battements par minute. */
export const LOOP_RECIPE = {
  tempo: 90,
  bars: 4,
  beatsPerBar: 4,
  sampleRate: 48_000,
  /** 16 temps à 90 battements par minute : 10,667 s, soit 512 000 échantillons. */
  samples: 512_000,
  durationS: (4 * 4 * 60) / 90,
} as const;

/** Position d'image d'une note dans une étendue linéaire (`m(u) = low + (high − low)·u`). */
export function uForMidi(midi: number, lowMidi: number, highMidi: number): number {
  return (midi - lowMidi) / (highMidi - lowMidi);
}

/** Instant auquel une main à vitesse constante atteint `u` (cahier §7.14). */
export function timeForU(u: number): number {
  return ((u - THEREMIN_GEOMETRY.fromU) / (THEREMIN_GEOMETRY.toU - THEREMIN_GEOMETRY.fromU)) * THEREMIN_GEOMETRY.durationS;
}

/** Instant auquel un balayage atteint `u`, pour la harpe. */
export function harpTimeForU(u: number): number {
  return ((u - HARP_GEOMETRY.fromU) / (HARP_GEOMETRY.toU - HARP_GEOMETRY.fromU)) * HARP_GEOMETRY.durationS;
}

/** Position de la corde `i` : `(i + 0,5) / nombre de cordes`. */
export function harpStringU(index: number, count: number = HARP_GEOMETRY.strings): number {
  return (index + 0.5) / count;
}

/** Échantillons d'une durée, arrondis à l'entier le plus proche. */
export function samplesFor(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

/**
 * Les sept prises de référence du cahier §13.3. Aucune n'est inventée ici :
 * chacune est une forme du générateur, avec les positions du cahier.
 */
export const REFERENCE_TAKES: readonly ReferenceTakeSpec[] = [
  {
    name: "left-hand-only",
    description: "une seule main gauche levée — fixe la convention de côté (§7.3)",
    instrument: "instruments/phantom.json",
    durationS: 2,
    build: () => synthTake("left-only", { fps: 30, duration: 2 }),
  },
  {
    name: "two-hands-cross",
    description: "deux mains qui se croisent sans disparaître (AIR-P-21)",
    instrument: "instruments/phantom.json",
    durationS: 2,
    build: () => synthTake("cross", { fps: 30, duration: 2 }),
  },
  {
    name: "slow-rise",
    description: "l'exemple du thérémine (§7.14) : u de 0,30 à 0,60 en 3 s, volume à 0,75",
    instrument: "instruments/phantom.json",
    durationS: THEREMIN_GEOMETRY.durationS,
    build: () => {
      const pitch = synthTake("line", {
        fps: THEREMIN_GEOMETRY.fps,
        duration: THEREMIN_GEOMETRY.durationS,
        fromU: THEREMIN_GEOMETRY.fromU,
        toU: THEREMIN_GEOMETRY.toU,
        fromV: 0.5,
        toV: 0.5,
      });
      return withVolumeHand(pitch, THEREMIN_GEOMETRY.volumeV, "left");
    },
  },
  {
    name: "harp-sweep",
    description: "l'exemple de la harpe (§7.14) : index de u 0,20 à 0,45 en une demi-seconde",
    instrument: "instruments/harp.json",
    durationS: HARP_GEOMETRY.durationS,
    build: () =>
      synthTake("sweep", {
        fps: HARP_GEOMETRY.fps,
        duration: HARP_GEOMETRY.durationS,
        fromU: HARP_GEOMETRY.fromU,
        toU: HARP_GEOMETRY.toU,
      }),
  },
  {
    name: "tremor-at-boundary",
    description: "tremblement autour du seuil sol → la, d'amplitude sous la marge (AIR-P-06)",
    instrument: "instruments/phantom.json",
    durationS: 3,
    build: () =>
      synthTake("tremor", {
        fps: THEREMIN_GEOMETRY.fps,
        duration: 3,
        centerU: THEREMIN_NOTES[1]?.u ?? 0.314,
        centerV: 0.5,
        // 0,004 en u ≈ 0,14 demi-ton : sous les 15 % de 2 demi-tons (0,30).
        amplitude: 0.004,
      }),
  },
  {
    name: "hand-leaves-mid-note",
    description: "la main sort du cadre en plein milieu d'une note tenue (AIR-P-09)",
    instrument: "instruments/phantom.json",
    durationS: 1.5,
    build: () => synthTake("leave", { fps: THEREMIN_GEOMETRY.fps, duration: 1.5, fromU: 0.5, fromV: 0.5, leaveAt: 0.8 }),
  },
  {
    name: "fast-jab",
    description: "un coup bref : traversée de quatre cordes en un quart de seconde",
    instrument: "instruments/harp.json",
    durationS: 0.25,
    build: () =>
      synthTake("sweep", {
        fps: HARP_GEOMETRY.fps,
        duration: 0.25,
        fromU: HARP_GEOMETRY.fromU,
        toU: HARP_GEOMETRY.toU,
      }),
  },
];

/** Une prise de référence par son nom. */
export function referenceTake(name: string): ReferenceTakeSpec | undefined {
  return REFERENCE_TAKES.find((spec) => spec.name === name);
}

/** Les noms des prises de référence, dans l'ordre du cahier. */
export const REFERENCE_TAKE_NAMES: readonly string[] = REFERENCE_TAKES.map((spec) => spec.name);
