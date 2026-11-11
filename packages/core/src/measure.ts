/**
 * Mesures sur un tableau d'échantillons : la preuve sans écoute (cahier §6.2,
 * §13). Propriétés : AIR-P-13 (plafond), 14 (justesse), 15 (silence final),
 * 16 (pas de marches).
 */
import type { NoteMeasurement, RenderReport } from "./types.js";
import { todo } from "./internal.js";

export interface MeasureOptions {
  readonly sampleRate: number;
  /** Fenêtre d'analyse de la fréquence, en secondes (10 ms par défaut). */
  readonly windowS?: number;
  readonly ceilingDb?: number;
}

/** Amplitude de crête, en dB pleine échelle (0 dB = 1,0). */
export function peakDb(samples: Float32Array | readonly number[]): number {
  void samples;
  return todo("measure.peakDb", "A4");
}

export function rmsDb(samples: Float32Array | readonly number[]): number {
  void samples;
  return todo("measure.rmsDb", "A4");
}

/** Fréquence dominante d'une fenêtre, par autocorrélation ou Goertzel. */
export function dominantFreq(
  samples: Float32Array | readonly number[],
  sampleRate: number,
  from: number,
  to: number,
): number {
  void samples; void sampleRate; void from; void to;
  return todo("measure.dominantFreq", "A4");
}

/** Fréquence mesurée fenêtre par fenêtre : la courbe du glissé (AIR-P-16). */
export function freqEnvelope(
  samples: Float32Array | readonly number[],
  options: MeasureOptions,
): readonly { readonly t: number; readonly hz: number }[] {
  void samples; void options;
  return todo("measure.freqEnvelope", "A4");
}

/** Instants d'attaque : passage au-dessus d'un seuil relatif. */
export function attackTimes(
  samples: Float32Array | readonly number[],
  sampleRate: number,
  thresholdDb?: number,
): readonly number[] {
  void samples; void sampleRate; void thresholdDb;
  return todo("measure.attackTimes", "A4");
}

/** Durée du silence final, en ms : dernier instant au-dessus de `belowDb`. */
export function finalSilenceMs(
  samples: Float32Array | readonly number[],
  sampleRate: number,
  belowDb?: number,
): number {
  void samples; void sampleRate; void belowDb;
  return todo("measure.finalSilenceMs", "A4");
}

/**
 * Mesure note par note d'un rendu : pour chaque note attendue, la fréquence
 * réellement mesurée pendant son palier et l'écart en centièmes.
 */
export function measureNotes(
  samples: Float32Array | readonly number[],
  notes: readonly { readonly t: number; readonly midi: number; readonly untilT: number }[],
  options: MeasureOptions,
): readonly NoteMeasurement[] {
  void samples; void notes; void options;
  return todo("measure.measureNotes", "A4");
}

/** Le rapport complet écrit par `bench render` (annexe B). */
export function buildReport(input: {
  readonly take: string;
  readonly instrument: string;
  readonly samples: Float32Array | readonly number[];
  readonly sampleRate: number;
  readonly notes: readonly NoteMeasurement[];
  readonly maxVoices: number;
}): RenderReport {
  void input;
  return todo("measure.buildReport", "A4");
}
