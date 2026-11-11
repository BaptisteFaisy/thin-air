/**
 * Datation sur l'horloge du son (cahier §7.9, règle 2) : chaque événement
 * porte un instant, et la programmation regarde devant elle.
 * Propriété : AIR-P-11 (ordre et causalité).
 */
import type { MusicEvent } from "./types.js";
import { todo } from "./internal.js";

export interface SchedulerOptions {
  /** Avance de programmation, ms (5 par défaut). */
  readonly lookaheadMs: number;
  /** Fenêtre programmée à chaque passage, ms (100 par défaut). */
  readonly windowMs?: number;
}

/**
 * Horloge de jeu direct : convertit l'instant d'une image en instant de
 * l'horloge du son, sans jamais revenir en arrière.
 */
export class Scheduler {
  constructor(readonly options: SchedulerOptions) {}

  stamp(imageTimeS: number, audioNowS: number): number {
    void imageTimeS; void audioNowS;
    return todo("schedule.Scheduler.stamp", "A3");
  }

  /** Événements à programmer dans la fenêtre qui vient, dans l'ordre. */
  due(audioNowS: number, pending: readonly MusicEvent[]): readonly MusicEvent[] {
    void audioNowS; void pending;
    return todo("schedule.Scheduler.due", "A3");
  }
}

/** Trie et rend une liste d'événements monotone en `t` (stables à t égal). */
export function sortEvents(events: readonly MusicEvent[]): readonly MusicEvent[] {
  void events;
  return todo("schedule.sortEvents", "A3");
}
