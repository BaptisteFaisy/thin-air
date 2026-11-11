/**
 * Contrat d'une voix : elle reçoit ses réglages datés en échantillons, et
 * rend ses échantillons dans un tampon. Aucune rampe ne se voit : un réglage
 * continu est lissé en interne avec τ = paramTauMs (AIR-F-26, AIR-P-16).
 */
import type { SoundEngine } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export type ControlParam = "pitch" | "gain" | "cutoff" | "vibrato";

export interface VoiceParams {
  readonly engine: SoundEngine;
  readonly sampleRate: number;
  readonly midi: number;
  readonly velocity: number;
  readonly attackS: number;
  readonly releaseS: number;
  readonly glideS: number;
  readonly wave: "sine" | "triangle" | "sawtooth" | "square";
  /** Amplitude de l'harmonique 2. */
  readonly second: number;
  readonly vibratoHz: number;
  readonly vibratoCents: number;
  readonly detuneCents: number;
  /** Corde pincée : 0,996 par défaut. */
  readonly decay: number;
  /** 0..1 : mélange du filtre de la ligne à retard. */
  readonly brightness: number;
  /** Cloches : rapport et indice de modulation. */
  readonly fmRatio: number;
  readonly fmIndex: number;
  /** Percussions : durée du bruit, hauteur du corps. */
  readonly noiseMs: number;
  readonly toneHz: number;
  /** τ des rampes internes, secondes (0,02). */
  readonly paramTauS: number;
  readonly seed: number;
}

export interface SynthVoice {
  readonly id: string;
  /** Un réglage daté, en échantillons depuis le début du rendu. */
  setParam(param: ControlParam, value: number, atSample: number): void;
  noteOff(atSample: number): void;
  /** Rend [from, to) dans `out` (mono, additionné). */
  render(out: Float32Array, from: number, to: number): void;
  /** Plus aucun échantillon à produire. */
  readonly done: boolean;
  readonly peak: number;
}

export function createVoice(id: string, params: VoiceParams): SynthVoice {
  void id; void params;
  return todo("audio.createVoice", "A4");
}

/** Valeurs par défaut d'un moteur, pour ne rien avoir à répéter. */
export function defaultVoiceParams(engine: SoundEngine, sampleRate: number): VoiceParams {
  void engine; void sampleRate;
  return todo("audio.defaultVoiceParams", "A4");
}
