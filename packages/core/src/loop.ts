/**
 * La boucle (cahier §7.10) : enregistrement d'événements, compensation du
 * retard, calage sur la grille, six couches au plus.
 * Propriété : AIR-P-17.
 */
import type { LoopLayer, MusicEvent, Session, Settings } from "./types.js";
import { todo } from "./internal.js";

/** Durée d'une mesure en secondes, au tempo donné. */
export function barSeconds(tempo: number, beatsPerBar: number): number {
  void tempo; void beatsPerBar;
  return todo("loop.barSeconds", "A3");
}

export function loopSeconds(tempo: number, bars: number, beatsPerBar: number): number {
  void tempo; void bars; void beatsPerBar;
  return todo("loop.loopSeconds", "A3");
}

/**
 * Compensation : les instants enregistrés sont avancés du retard estimé
 * (part mesurée + caméra), en restant dans la boucle.
 */
export function compensate(
  events: readonly MusicEvent[],
  latencyS: number,
  loopLengthS: number,
): readonly MusicEvent[] {
  void events; void latencyS; void loopLengthS;
  return todo("loop.compensate", "A3");
}

/** Calage sur la grille : force 0 ne change rien, force 1 pose sur le temps. */
export function quantize(
  events: readonly MusicEvent[],
  grid: "off" | "eighth" | "sixteenth",
  strength: number,
  tempo: number,
  beatsPerBar: number,
): readonly MusicEvent[] {
  void events; void grid; void strength; void tempo; void beatsPerBar;
  return todo("loop.quantize", "A3");
}

export const MAX_LAYERS = 6;

export class LoopRecorder {
  constructor(readonly settings: Settings) {}

  start(tSeconds: number): void {
    void tSeconds;
    todo("loop.LoopRecorder.start", "A3");
  }

  record(event: MusicEvent): void {
    void event;
    todo("loop.LoopRecorder.record", "A3");
  }

  /** Couche terminée ; `null` si la boucle est pleine (six couches). */
  stop(tSeconds: number, instrumentName: string): LoopLayer | null {
    void tSeconds; void instrumentName;
    return todo("loop.LoopRecorder.stop", "A3");
  }
}

/** Les événements à jouer à un instant de la boucle, toutes couches non muettes. */
export function loopEventsAt(
  session: Session,
  positionS: number,
  windowS: number,
): readonly MusicEvent[] {
  void session; void positionS; void windowS;
  return todo("loop.loopEventsAt", "A3");
}

export function emptySession(settings: Settings): Session {
  void settings;
  return todo("loop.emptySession", "A3");
}
