/**
 * Accords : fréquence d'une note, écart en centièmes.
 *
 * Le lot `music` (A3) n'est pas encore mergé dans cet arbre : la formule est
 * donc écrite ici, en local, et sera remplacée par `music.midiToFreq` et
 * `music.centsBetween` au moment du merge.
 * // à remplacer par music.midiToFreq quand le lot A3 sera mergé
 */

/** f = 440 × 2^((m − 69) / 12). */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Hz → note MIDI, fractionnaire. */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** Écart en centièmes de demi-ton entre deux fréquences. */
export function centsBetween(expectedHz: number, measuredHz: number): number {
  if (expectedHz <= 0 || measuredHz <= 0) return 0;
  return 1200 * Math.log2(measuredHz / expectedHz);
}
