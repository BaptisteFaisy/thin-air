/**
 * Les quatre moteurs de synthèse (cahier §7.8, §7.9). Tout est synthétisé :
 * aucun fichier sonore n'est embarqué (AIR-F-25).
 */
import { todo } from "@thin-air/core/internal";

/** Une période de forme d'onde, en table d'ondes de `size` points. */
export function buildWaveTable(
  wave: "sine" | "triangle" | "sawtooth" | "square",
  second: number,
  size?: number,
): Float32Array {
  void wave; void second; void size;
  return todo("audio.buildWaveTable", "A4");
}

/**
 * Karplus-Strong : ligne à retard bouclée dont la longueur fixe la note
 * (326,9 échantillons pour ré 146,83 Hz à 48 kHz). Un module audio à part,
 * parce que dans le graphe ordinaire un retard bouclé ne descend pas sous
 * 128 échantillons (2,67 ms), donc aucune note au-dessus de 375 Hz.
 */
export function pluckDelayLength(freqHz: number, sampleRate: number): number {
  void freqHz; void sampleRate;
  return todo("audio.pluckDelayLength", "A4");
}

/** Bruit de départ de la corde, déterministe pour une graine donnée. */
export function pluckExcitation(length: number, seed: number): Float32Array {
  void length; void seed;
  return todo("audio.pluckExcitation", "A4");
}

/** Générateur pseudo-aléatoire déterministe (mêmes échantillons à chaque run). */
export function makeNoise(seed: number): () => number {
  void seed;
  return todo("audio.makeNoise", "A4");
}
