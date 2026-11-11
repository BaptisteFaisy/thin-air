/**
 * Rendu hors ligne : les échantillons dans un tableau, plus vite que le
 * temps réel, sans haut-parleur ni périphérique audio (cahier §11.6).
 * C'est le moteur unique des tests et de l'export WAV (AIR-F-38).
 */
import type { Instrument, MusicEvent } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export interface RenderOptions {
  readonly instrument: Instrument;
  readonly sampleRate?: number;
  /** Durée forcée ; sinon dernier événement + extinction + 800 ms. */
  readonly durationS?: number;
  readonly masterGainDb?: number;
  readonly ceilingDb?: number;
  readonly reverb?: number;
  readonly maxVoices?: number;
  readonly paramTauMs?: number;
}

export interface RenderResult {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly durationS: number;
  /** Nombre maximal de voix actives simultanément (AIR-P-10). */
  readonly maxVoices: number;
}

export function renderEvents(events: readonly MusicEvent[], options: RenderOptions): RenderResult {
  void events; void options;
  return todo("audio.renderEvents", "A4");
}

/** Échantillons attendus pour une boucle : exact, pas arrondi (AIR-P-17). */
export function samplesForDuration(durationS: number, sampleRate: number): number {
  void durationS; void sampleRate;
  return todo("audio.samplesForDuration", "A4");
}
