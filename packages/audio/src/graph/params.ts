/**
 * Règle 1 de §7.9 : jamais de réglage fixé pendant qu'une voix sonne.
 *
 * Toute mise à jour d'un réglage continu passe par une rampe
 * `param.setTargetAtTime(valeur, moment, τ)`, avec τ = `settings.paramTauMs`
 * (20 ms). Sans cela le réglage avance par marches, trente fois par seconde,
 * et le son grésille (AIR-F-26, AIR-P-16, récit §14.6 point 4).
 *
 * Les conversions dB ↔ linéaire et note ↔ fréquence viennent de
 * `@thin-air/core` (`dbToGain`, `midiToFreq`) : une seule implémentation.
 */

/** Le strict minimum d'un `AudioParam` Web Audio : ce dont le moteur a besoin. */
export interface AudioParamLike {
  setTargetAtTime(value: number, startTime: number, timeConstant: number): unknown;
}

/** τ minimal en secondes : en dessous, la rampe redevient une marche. */
export const MIN_TAU_S = 1e-4;

/**
 * Rampe un réglage continu. `tauS` vient de `settings.paramTauMs / 1000`.
 * Une valeur non numérique est ignorée : un réglage invalide ne doit jamais
 * faire grésiller une voix qui sonne (AIR-P-02).
 */
export function rampParam(param: AudioParamLike, value: number, at: number, tauS: number): void {
  if (!Number.isFinite(value) || !Number.isFinite(at)) return;
  param.setTargetAtTime(value, at, Math.max(tauS, MIN_TAU_S));
}

/**
 * Courbe du plafond pour un `WaveShaperNode` : le signal est écrêté à
 * `ceilingLinear` (amplitude linéaire ; −1 dB ≈ 0,891, AIR-F-28, AIR-P-13).
 * Tout ce qui est en dessous passe inchangé : le plafond ne colore pas le son.
 * La conversion dB → linéaire est faite par l'appelant avec `dbToGain` de core.
 */
export function makeCeilingCurve(ceilingLinear: number, points = 2048) {
  const n = Math.max(2, Math.floor(points));
  const ceil = Math.min(Math.max(ceilingLinear, 0), 1);
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.max(-ceil, Math.min(ceil, x));
  }
  return curve;
}

/**
 * τ d'un fondu de relâchement : un relâchement passe aussi par une rampe,
 * jamais par une coupure (AIR-F-24). Trois τ pour atteindre ~95 % du silence.
 */
export function releaseTauS(releaseS: number): number {
  return Math.max(releaseS / 3, MIN_TAU_S);
}
