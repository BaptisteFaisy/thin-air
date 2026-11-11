/**
 * `bench compare <rapport> <référence>` : tolérances de la section 13.
 * Code de sortie non nul en cas d'écart — c'est ce que regarde la CI.
 *
 *  5 centièmes de demi-ton (justesse rendue, AIR-P-14)
 *  une image près, soit 33 ms à 30 images/s (instants de note)
 *  crête et niveau moyen : ±0,5 dB
 *  silence final : ±100 ms (AIR-P-15)
 */
import type { NoteMeasurement, RenderReport } from "@thin-air/core";

import { formatWithUnit, pad } from "./format.js";

export interface Tolerances {
  /** 5 centièmes de demi-ton (cahier §7.14). */
  readonly cents?: number;
  readonly peakDb?: number;
  readonly rmsDb?: number;
  /** Une image près, soit 33 ms à 30 images/s. */
  readonly noteTimeMs?: number;
  readonly silenceAfterMs?: number;
}

export interface ComparisonDiff {
  readonly field: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly tolerance?: number;
  /** Unité de `expected`, `actual` et `tolerance` : « s », « ms », « dB », « cents », « Hz ». */
  readonly unit?: string;
}

/** Les tolérances de la section 13, quand l'appelant n'en donne pas. */
export const DEFAULT_TOLERANCES: Required<Tolerances> = {
  cents: 5,
  peakDb: 0.5,
  rmsDb: 0.5,
  noteTimeMs: 33,
  silenceAfterMs: 100,
};

function sameNumber(expected: number, actual: number, tolerance: number): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return Object.is(expected, actual);
  return Math.abs(actual - expected) <= tolerance;
}

function exact(diffs: ComparisonDiff[], field: string, expected: unknown, actual: unknown, unit?: string): void {
  if (Object.is(expected, actual)) return;
  diffs.push(unit === undefined ? { field, expected, actual } : { field, expected, actual, unit });
}

function near(
  diffs: ComparisonDiff[],
  field: string,
  expected: number,
  actual: number,
  tolerance: number,
  unit?: string,
): void {
  if (sameNumber(expected, actual, tolerance)) return;
  diffs.push({ field, expected, actual, tolerance, ...(unit === undefined ? {} : { unit }) });
}

/**
 * La tolérance en hertz qui correspond à `cents` centièmes, à cette fréquence :
 * 5 centièmes valent 0,57 Hz pour le sol à 196 Hz (cahier §7.14).
 */
export function hzTolerance(cents: number, hz: number): number {
  return Math.abs(hz) * (Math.pow(2, cents / 1200) - 1);
}

/**
 * Une note : instant (une image près), hauteur exacte, justesse en centièmes.
 *
 * L'écart en centièmes fait foi et il est le seul publié quand il dépasse la
 * tolérance ; la fréquence mesurée n'est signalée à part que si elle contredit
 * les centièmes du rapport (une incohérence interne), pour ne pas doubler
 * chaque écart d'une ligne qui dit la même chose.
 */
function compareNote(
  diffs: ComparisonDiff[],
  index: number,
  expected: NoteMeasurement,
  actual: NoteMeasurement,
  tol: Required<Tolerances>,
): void {
  const prefix = `notes[${index}]`;
  near(diffs, `${prefix}.t`, expected.t, actual.t, tol.noteTimeMs / 1000, "s");
  exact(diffs, `${prefix}.midi`, expected.midi, actual.midi);
  // Les tables du cahier arrondissent au centième de hertz.
  near(diffs, `${prefix}.expectedHz`, expected.expectedHz, actual.expectedHz, 0.05, "Hz");
  near(diffs, `${prefix}.cents`, expected.cents, actual.cents, tol.cents, "cents");
  if (!sameNumber(expected.cents, actual.cents, tol.cents)) return;
  near(
    diffs,
    `${prefix}.measuredHz`,
    expected.measuredHz,
    actual.measuredHz,
    hzTolerance(tol.cents, expected.expectedHz),
    "Hz",
  );
}

/** Les listes de notes : même nombre, même ordre, puis note par note. */
function compareNotes(
  diffs: ComparisonDiff[],
  expected: readonly NoteMeasurement[],
  actual: readonly NoteMeasurement[],
  tol: Required<Tolerances>,
): void {
  if (expected.length !== actual.length) {
    diffs.push({ field: "notes", expected: expected.length, actual: actual.length, unit: "notes" });
  }
  const common = Math.min(expected.length, actual.length);
  for (let index = 0; index < common; index += 1) {
    const left = expected[index];
    const right = actual[index];
    if (left !== undefined && right !== undefined) compareNote(diffs, index, left, right, tol);
  }
}

/** Les nombres du rapport, puis les notes. Rend la liste des écarts. */
export function compareReports(
  actual: RenderReport,
  expected: RenderReport,
  tolerances?: Tolerances,
): readonly ComparisonDiff[] {
  const tol: Required<Tolerances> = { ...DEFAULT_TOLERANCES, ...(tolerances ?? {}) };
  const diffs: ComparisonDiff[] = [];
  exact(diffs, "take", expected.take, actual.take);
  exact(diffs, "instrument", expected.instrument, actual.instrument);
  exact(diffs, "sampleRate", expected.sampleRate, actual.sampleRate, "Hz");
  exact(diffs, "samples", expected.samples, actual.samples, "échantillons");
  near(diffs, "durationS", expected.durationS, actual.durationS, 1 / Math.max(expected.sampleRate, 1), "s");
  near(diffs, "peakDb", expected.peakDb, actual.peakDb, tol.peakDb, "dB");
  near(diffs, "rmsDb", expected.rmsDb, actual.rmsDb, tol.rmsDb, "dB");
  exact(diffs, "maxVoices", expected.maxVoices, actual.maxVoices);
  near(diffs, "silenceAfterMs", expected.silenceAfterMs, actual.silenceAfterMs, tol.silenceAfterMs, "ms");
  compareNotes(diffs, expected.notes, actual.notes, tol);
  return diffs;
}

/** Vrai si tout est dans les tolérances : le code de sortie 0 de la CI. */
export function isConforming(diffs: readonly ComparisonDiff[]): boolean {
  return diffs.length === 0;
}

function renderValue(value: unknown, unit?: string): string {
  if (typeof value === "number") return formatWithUnit(value, unit);
  if (typeof value === "string") return `« ${value} »`;
  return JSON.stringify(value) ?? String(value);
}

function renderGap(diff: ComparisonDiff): string {
  if (typeof diff.expected !== "number" || typeof diff.actual !== "number") return "";
  const gap = diff.actual - diff.expected;
  return `  écart ${gap >= 0 ? "+" : "−"}${formatWithUnit(Math.abs(gap), diff.unit)}`;
}

function renderLine(diff: ComparisonDiff): string {
  const tete = `✗ ${pad(diff.field, 20)}`;
  const corps = `attendu ${renderValue(diff.expected, diff.unit)} · obtenu ${renderValue(diff.actual, diff.unit)}`;
  const tolerance =
    diff.tolerance === undefined ? "" : `  tolérance ${formatWithUnit(diff.tolerance, diff.unit)}`;
  return `${tete}${corps}${renderGap(diff)}${tolerance}`;
}

/** Le compte rendu ligne à ligne : attendu / obtenu / écart / tolérance. */
export function formatComparison(diffs: readonly ComparisonDiff[]): string {
  if (diffs.length === 0) return "conforme : aucun écart au-delà des tolérances.";
  const lignes = [`${diffs.length} écart(s) :`];
  for (const diff of diffs) lignes.push(renderLine(diff));
  return lignes.join("\n");
}
