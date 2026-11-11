/**
 * Les quatre moteurs de synthèse (cahier §7.8, §7.9). Tout est synthétisé :
 * aucun fichier sonore n'est embarqué (AIR-F-25).
 *
 * Ce module tient les briques déterministes : table d'ondes, longueur de la
 * ligne à retard, excitation d'une corde, bruit à graine. Les moteurs eux-mêmes
 * sont dans `osc.ts`, `pluck.ts`, `fm.ts` et `drum.ts`.
 */

/** Les quatre formes d'onde de la table. */
export type Wave = "sine" | "triangle" | "sawtooth" | "square";

/** Taille par défaut de la table d'ondes (points). */
export const WAVE_TABLE_SIZE = 2048;

/** Une période de forme d'onde, en table d'ondes de `size` points. */
export function buildWaveTable(
  wave: Wave,
  second: number,
  size: number = WAVE_TABLE_SIZE,
): Float32Array {
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const phase = i / size;
    table[i] = waveValue(wave, phase, second);
  }
  return table;
}

/**
 * Valeur d'une forme d'onde pour une phase dans [0, 1).
 * La sinusoïde porte son harmonique 2 d'amplitude `second` ; les trois autres
 * formes sont pures.
 */
function waveValue(wave: Wave, phase: number, second: number): number {
  switch (wave) {
    case "sine": {
      const fondamentale = Math.sin(2 * Math.PI * phase);
      const harmonique2 = Math.sin(4 * Math.PI * phase);
      return (fondamentale + second * harmonique2) / (1 + Math.abs(second));
    }
    case "triangle": {
      const t = phase - Math.floor(phase);
      return 4 * Math.abs(t - 0.5) - 1;
    }
    case "sawtooth": {
      const t = phase - Math.floor(phase);
      return 2 * t - 1;
    }
    case "square": {
      const t = phase - Math.floor(phase);
      return t < 0.5 ? 1 : -1;
    }
  }
}

/**
 * Karplus-Strong : ligne à retard bouclée dont la longueur fixe la note
 * (326,9 échantillons pour ré 146,83 Hz à 48 kHz). Un module audio à part,
 * parce que dans le graphe ordinaire un retard bouclé ne descend pas sous
 * 128 échantillons (2,67 ms), donc aucune note au-dessus de 375 Hz.
 */
export function pluckDelayLength(freqHz: number, sampleRate: number): number {
  if (freqHz <= 0) return 0;
  return sampleRate / freqHz;
}

/** Bruit de départ de la corde, déterministe pour une graine donnée. */
export function pluckExcitation(length: number, seed: number): Float32Array {
  const n = Math.max(0, Math.floor(length));
  const bruit = makeNoise(seed);
  const excitation = new Float32Array(n);
  for (let i = 0; i < n; i++) excitation[i] = bruit();
  return excitation;
}

/**
 * Générateur pseudo-aléatoire déterministe (mêmes échantillons à chaque run) :
 * xorshift32 sur 32 bits, sortie dans [−1, 1). Jamais `Math.random()` (AIR-N-09).
 */
export function makeNoise(seed: number): () => number {
  let etat = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  return () => {
    etat ^= etat << 13;
    etat >>>= 0;
    etat ^= etat >>> 17;
    etat ^= etat << 5;
    etat >>>= 0;
    return (etat / 4294967296) * 2 - 1;
  };
}
