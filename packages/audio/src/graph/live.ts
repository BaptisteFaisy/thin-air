/**
 * Jeu direct : le même moteur branché sur Web Audio (cahier §7.9).
 * Trois règles sans exception : rampes pour tout réglage continu, événements
 * datés sur l'horloge du son avec avance, voix bornées et toujours relâchées.
 * Jamais les mots « temps réel » ni « instantané » dans les libellés (§5.4).
 */
import type { Instrument, LatencyReport, MusicEvent, Settings } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export interface LiveEngineOptions {
  readonly instrument: Instrument;
  readonly settings: Settings;
  readonly latencyHint?: "interactive" | "playback";
}

export interface LiveEngine {
  start(): Promise<void>;
  stop(): void;
  /** Événements datés sur l'horloge du son. */
  play(events: readonly MusicEvent[]): void;
  /** Relâchement général : onglet masqué, caméra figée, changement d'instrument. */
  releaseAll(): void;
  setInstrument(instrument: Instrument): void;
  setSettings(settings: Settings): void;
  /** Ce que le navigateur déclare, et ce qu'il ne peut pas déclarer (§5.1). */
  latency(): LatencyReport;
  readonly context: AudioContext | null;
}

export function createLiveEngine(options: LiveEngineOptions): LiveEngine {
  void options;
  return todo("audio.createLiveEngine", "A5");
}
