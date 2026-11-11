/**
 * Plafond (AIR-F-28, AIR-P-13) : la sortie ne dépasse jamais `ceilingDb`.
 *
 * Hors ligne, un limiteur à attaque immédiate et relâchement lent : le gain
 * appliqué ne dépasse jamais celui que l'échantillon exige, donc la borne est
 * tenue par construction, et un plafond dur rattrape toute dérive d'arrondi.
 * En direct, le graphe met un compresseur réglé en limiteur, puis le même
 * plafond — la mesure (AIR-P-13) porte sur le rendu hors ligne.
 */

/** Relâchement du limiteur, en échantillons (≈ 42 ms à 48 kHz). */
const RELACHEMENT_ECHANTILLONS = 2000;
const COEF_RELACHEMENT = 1 / RELACHEMENT_ECHANTILLONS;

/** dB pleine échelle → amplitude linéaire. */
export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

export function applyCeiling(samples: Float32Array, ceilingDb: number): void {
  const plafond = dbToLinear(ceilingDb);
  if (!(plafond > 0)) {
    samples.fill(0);
    return;
  }
  let gain = 1;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i] ?? 0;
    const absolu = Math.abs(x);
    const requis = absolu > plafond ? plafond / absolu : 1;
    // Attaque immédiate vers le bas, relâchement lent vers le haut : le gain
    // reste toujours ≤ `requis`, donc |sortie| ≤ plafond (preuve par récurrence).
    gain = requis < gain ? requis : gain + (requis - gain) * COEF_RELACHEMENT;
    const y = x * gain;
    samples[i] = y > plafond ? plafond : y < -plafond ? -plafond : y;
  }
}

export function applyMasterGain(samples: Float32Array, gainDb: number): void {
  const gain = dbToLinear(gainDb);
  for (let i = 0; i < samples.length; i++) samples[i] = (samples[i] ?? 0) * gain;
}
