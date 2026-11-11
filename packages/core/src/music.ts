/**
 * Musique : hauteurs, gammes, aimant, volume (cahier §7.7).
 * Propriétés : AIR-P-03 (monotonie), AIR-P-04 (fréquences), AIR-P-05 (gamme).
 */
import type { InstrumentRange, ScaleName } from "./types.js";
import { todo } from "./internal.js";

/** Les huit gammes du cahier §7.7. */
export const SCALES: Readonly<Record<ScaleName, readonly number[]>> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** f = 440 × 2^((m − 69) / 12). */
export function midiToFreq(midi: number): number {
  void midi;
  return todo("music.midiToFreq", "A3");
}

export function freqToMidi(freqHz: number): number {
  void freqHz;
  return todo("music.freqToMidi", "A3");
}

/** Le degré k donne root + 12 × ⌊k / n⌋ + steps[k mod n]. */
export function degreeToMidi(root: number, steps: readonly number[], degree: number): number {
  void root; void steps; void degree;
  return todo("music.degreeToMidi", "A3");
}

/** Note de la gamme la plus proche, avec la marge d'hystérésis de §7.6. */
export function quantizeToScale(
  midi: number,
  root: number,
  steps: readonly number[],
  hysteresis?: number,
): number {
  void midi; void root; void steps; void hysteresis;
  return todo("music.quantizeToScale", "A3");
}

/** m' = m + a × (q(m) − m). */
export function applyMagnet(midi: number, snapped: number, amount: number): number {
  void midi; void snapped; void amount;
  return todo("music.applyMagnet", "A3");
}

/** Hauteur continue : m(u) = low + (high − low) × u. */
export function pitchFromU(u: number, range: InstrumentRange): number {
  void u; void range;
  return todo("music.pitchFromU", "A3");
}

/** dB = −48 × (1 − v) ; sous 5 % de hauteur, silence. */
export function dbFromV(v: number): number {
  void v;
  return todo("music.dbFromV", "A3");
}

/** Amplitude linéaire 0..1 depuis v, selon la courbe demandée. */
export function gainFromV(v: number, curve?: "linear" | "db48"): number {
  void v; void curve;
  return todo("music.gainFromV", "A3");
}

export function dbToGain(db: number): number {
  void db;
  return todo("music.dbToGain", "A3");
}

export function gainToDb(gain: number): number {
  void gain;
  return todo("music.gainToDb", "A3");
}

/** Nom anglais de la note, pour l'écran et le mode physique (AIR-F-53). */
export function noteName(midi: number): string {
  void midi;
  return todo("music.noteName", "A3");
}

/** Écart en centièmes de demi-ton entre deux fréquences. */
export function centsBetween(expectedHz: number, measuredHz: number): number {
  void expectedHz; void measuredHz;
  return todo("music.centsBetween", "A3");
}

/** Bornes de l'étendue, dans l'ordre (low ≤ high). */
export function clampToRange(midi: number, range: InstrumentRange): number {
  void midi; void range;
  return todo("music.clampToRange", "A3");
}
