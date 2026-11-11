/**
 * Réverbération calculée, réglable et désactivable (AIR-F-30).
 * Réponse générée au démarrage — aucun fichier sonore — puis réseau de
 * retards à réinjection : le même calcul hors ligne et en direct.
 */
import { todo } from "@thin-air/core/internal";

export interface ReverbOptions {
  readonly sampleRate: number;
  /** 0 = sec, 1 = très humide. */
  readonly amount: number;
  readonly decayS?: number;
  readonly seed?: number;
}

export interface Reverb {
  process(input: Float32Array, out: Float32Array): void;
  reset(): void;
}

export function createReverb(options: ReverbOptions): Reverb {
  void options;
  return todo("audio.createReverb", "A4");
}

/** Réponse impulsionnelle générée (un bruit qui s'éteint). */
export function generateImpulseResponse(sampleRate: number, seconds: number, decay: number, seed?: number): Float32Array {
  void sampleRate; void seconds; void decay; void seed;
  return todo("audio.generateImpulseResponse", "A4");
}
