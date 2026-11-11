/**
 * Musique : hauteurs, gammes, aimant, volume (cahier §7.7).
 * Propriétés : AIR-P-03 (monotonie), AIR-P-04 (fréquences), AIR-P-05 (gamme).
 *
 * Tout est pur et sans horloge (AIR-N-09). Les formules viennent du cahier :
 *   f = 440 × 2^((m − 69) / 12)          m = 69 + 12 × log2(f / 440)
 *   degré k → root + 12 × ⌊k / n⌋ + steps[k mod n]
 *   m(u) = low + (high − low) × u        dB = −48 × (1 − v)
 *   m' = m + a × (q(m) − m)              centièmes = 1200 × log2(f2 / f1)
 */
import type { InstrumentRange, ScaleName } from "./types.js";
import { todo } from "./internal.js";

/** Les huit gammes du cahier §7.7 — une seule source de vérité. */
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

/** La gamme de saison du cahier : ré mineur harmonique (§7.7). */
export const SEASON_SCALE = { root: 50, steps: SCALES.harmonicMinor } as const;

const LA4 = 69;
const A4_HZ = 440;
/** Plancher de niveau : en dessous, on considère le silence (−∞ interdit). */
export const SILENCE_DB = -120;
/** Sous 5 % de hauteur, silence (§7.7). */
export const VOLUME_FLOOR_V = 0.05;

/** f = 440 × 2^((m − 69) / 12). */
export function midiToFreq(midi: number): number {
  if (!Number.isFinite(midi)) return 0;
  return A4_HZ * 2 ** ((midi - LA4) / 12);
}

export function freqToMidi(freqHz: number): number {
  if (!Number.isFinite(freqHz) || freqHz <= 0) return 0;
  return LA4 + 12 * Math.log2(freqHz / A4_HZ);
}

/** Le degré k donne root + 12 × ⌊k / n⌋ + steps[k mod n] — valable pour k < 0. */
export function degreeToMidi(root: number, steps: readonly number[], degree: number): number {
  const n = steps.length;
  if (n === 0) return root;
  const octave = Math.floor(degree / n);
  const index = degree - octave * n; // toujours dans [0, n[
  const ecart = steps[index] ?? 0;
  return root + 12 * octave + ecart;
}

/** Degré de la note la plus proche, dans la gamme, pour une hauteur donnée. */
export function nearestDegree(midi: number, root: number, steps: readonly number[]): number {
  const n = steps.length;
  if (n === 0) return 0;
  const approx = Math.round(((midi - root) / 12) * n);
  let meilleur = approx;
  let ecart = Math.abs(degreeToMidi(root, steps, approx) - midi);
  for (const delta of [-2, -1, 1, 2]) {
    const candidat = approx + delta;
    const distance = Math.abs(degreeToMidi(root, steps, candidat) - midi);
    if (distance < ecart) {
      ecart = distance;
      meilleur = candidat;
    }
  }
  return meilleur;
}

/**
 * Note de la gamme la plus proche (sans état).
 *
 * `hysteresis` n'a de sens qu'avec la note précédente en mémoire : une fonction
 * pure ne peut pas la connaître. Il est accepté ici pour garder un seul point
 * d'entrée, et c'est `ScaleSnapper` qui applique la marge du §7.6.
 */
export function quantizeToScale(
  midi: number,
  root: number,
  steps: readonly number[],
  hysteresis?: number,
): number {
  void hysteresis;
  return degreeToMidi(root, steps, nearestDegree(midi, root, steps));
}

/** Note de la gamme juste au-dessus (strictement). */
export function scaleNoteAbove(midi: number, root: number, steps: readonly number[]): number {
  const degre = nearestDegree(midi, root, steps);
  let suivant = degreeToMidi(root, steps, degre + 1);
  if (suivant <= midi) suivant = degreeToMidi(root, steps, degre + 2);
  return suivant;
}

/** Note de la gamme juste en dessous (strictement). */
export function scaleNoteBelow(midi: number, root: number, steps: readonly number[]): number {
  const degre = nearestDegree(midi, root, steps);
  let precedent = degreeToMidi(root, steps, degre - 1);
  if (precedent >= midi) precedent = degreeToMidi(root, steps, degre - 2);
  return precedent;
}

/**
 * Le seuil de changement de note (§7.6) : la frontière entre deux notes
 * voisines, déplacée de `hysteresis` fois leur écart dans le sens du
 * mouvement. En montant : milieu + marge ; en descendant : milieu − marge.
 */
export function noteBoundary(
  current: number,
  next: number,
  hysteresis: number,
): number {
  const milieu = (current + next) / 2;
  const marge = Math.abs(next - current) * hysteresis;
  return next > current ? milieu + marge : milieu - marge;
}

/**
 * Aimanté avec mémoire : la note ne change que si la hauteur a vraiment passé
 * le seuil. C'est ce qui empêche une main qui hésite de faire basculer la note
 * dix fois par seconde (§7.6, propriété AIR-P-06).
 */
export class ScaleSnapper {
  private note: number | null = null;

  constructor(
    readonly root: number,
    readonly steps: readonly number[],
    readonly hysteresis: number,
  ) {}

  get current(): number | null {
    return this.note;
  }

  reset(): void {
    this.note = null;
  }

  next(midi: number): number {
    const visee = quantizeToScale(midi, this.root, this.steps);
    if (this.note === null) {
      this.note = visee;
      return visee;
    }
    if (visee === this.note) return this.note;
    const voisin = visee > this.note
      ? scaleNoteAbove(this.note, this.root, this.steps)
      : scaleNoteBelow(this.note, this.root, this.steps);
    const seuil = noteBoundary(this.note, voisin, this.hysteresis);
    const passe = visee > this.note ? midi >= seuil : midi <= seuil;
    if (passe) this.note = visee;
    return this.note;
  }
}

/** m' = m + a × (q(m) − m) : 0 = glissé pur, 1 = notes franches (§7.7). */
export function applyMagnet(midi: number, snapped: number, amount: number): number {
  const a = Number.isFinite(amount) ? Math.min(1, Math.max(0, amount)) : 0;
  return midi + a * (snapped - midi);
}

/** Hauteur continue : m(u) = low + (high − low) × u (§7.7). */
export function pitchFromU(u: number, range: InstrumentRange): number {
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  const borne = Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0;
  return low + (high - low) * borne;
}

/** dB = −48 × (1 − v) ; sous 5 % de hauteur, silence (§7.7). */
export function dbFromV(v: number): number {
  const borne = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  if (borne < VOLUME_FLOOR_V) return SILENCE_DB;
  return -48 * (1 - borne);
}

export function dbToGain(db: number): number {
  if (!Number.isFinite(db) || db <= SILENCE_DB) return 0;
  return 10 ** (db / 20);
}

export function gainToDb(gain: number): number {
  if (!Number.isFinite(gain) || gain <= 0) return SILENCE_DB;
  return Math.max(SILENCE_DB, 20 * Math.log10(gain));
}

/** Amplitude linéaire 0..1 depuis v, selon la courbe demandée (§7.7). */
export function gainFromV(v: number, curve: "linear" | "db48" = "db48"): number {
  const borne = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  if (curve === "linear") return borne;
  return dbToGain(dbFromV(borne));
}

const NOMS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/**
 * Nom anglais de la note, pour l'écran et le mode physique (AIR-F-53).
 * Convention : `C4` = 60 (do du milieu), `A4` = 69. Une hauteur non entière
 * est arrondie à la note la plus proche, et l'écart restant est perdu ici :
 * c'est `centsBetween` qui le dit.
 */
export function noteName(midi: number): string {
  if (!Number.isFinite(midi)) return todo("music.noteName", "A3");
  const entier = Math.round(midi);
  const index = ((entier % 12) + 12) % 12;
  const octave = Math.floor(entier / 12) - 1;
  return `${NOMS[index] ?? "C"}${octave}`;
}

/** Écart en centièmes de demi-ton : 1200 × log2(mesurée / attendue). */
export function centsBetween(expectedHz: number, measuredHz: number): number {
  if (!(expectedHz > 0) || !(measuredHz > 0)) return 0;
  return 1200 * Math.log2(measuredHz / expectedHz);
}

/** Bornes de l'étendue, dans l'ordre (low ≤ high). */
export function clampToRange(midi: number, range: InstrumentRange): number {
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  if (!Number.isFinite(midi)) return low;
  return Math.min(high, Math.max(low, midi));
}

/** Toutes les notes de la gamme dans une étendue, dans l'ordre montant. */
export function scaleNotes(
  root: number,
  steps: readonly number[],
  range: InstrumentRange,
): readonly number[] {
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  const notes: number[] = [];
  const debut = Math.floor(((low - root) / 12) * steps.length) - 1;
  const fin = Math.ceil(((high - root) / 12) * steps.length) + 1;
  for (let degre = debut; degre <= fin; degre += 1) {
    const midi = degreeToMidi(root, steps, degre);
    if (midi >= low && midi <= high) notes.push(midi);
  }
  return notes;
}
