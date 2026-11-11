/**
 * La courbe du son pour le mode physique (AIR-F-53) : une forme d'onde
 * synthétisée, décrite par ses points. Aucun échantillon audio n'est produit,
 * seulement un dessin (AIR-N-02).
 */
import type { InstrumentSound } from "@thin-air/core";

export interface WavePoint {
  readonly x: number;
  readonly y: number;
}

export const WAVE_POINTS = 64;

function forme(valeur: number, sound: InstrumentSound): number {
  const phase = valeur - Math.floor(valeur);
  switch (sound.wave ?? "sine") {
    case "triangle":
      return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    case "sawtooth":
      return 2 * phase - 1;
    case "square":
      return phase < 0.5 ? 1 : -1;
    default:
      return Math.sin(2 * Math.PI * phase);
  }
}

/** Une période de la forme d'onde, avec l'harmonique 2 quand l'instrument en a. */
export function wavePath(sound: InstrumentSound, points = WAVE_POINTS): readonly WavePoint[] {
  const total = Math.max(2, Math.round(points));
  const seconde = sound.second ?? 0;
  return Array.from({ length: total }, (_, index) => {
    const valeur = index / (total - 1);
    const amplitude = forme(valeur, sound) + seconde * forme(valeur * 2, sound);
    const norme = amplitude / (1 + Math.abs(seconde));
    return { x: valeur, y: 0.5 - 0.45 * norme };
  });
}

/** Une corde pincée : même forme, amortie sur la durée (Karplus-Strong, §7.9). */
export function pluckPath(sound: InstrumentSound, points = WAVE_POINTS): readonly WavePoint[] {
  const decay = sound.decay ?? 0.996;
  return wavePath(sound, points).map((point, index) => {
    const attenuation = Math.pow(decay, index * 8);
    return { x: point.x, y: 0.5 + (point.y - 0.5) * attenuation };
  });
}

export function pathFor(sound: InstrumentSound): readonly WavePoint[] {
  return sound.engine === "pluck" ? pluckPath(sound) : wavePath(sound);
}

/** Points → attribut `points` d'une polyligne SVG, dans une boîte donnée. */
export function toPolyline(points: readonly WavePoint[], width: number, height: number): string {
  return points
    .map((point) => `${(point.x * width).toFixed(2)},${(point.y * height).toFixed(2)}`)
    .join(" ");
}
