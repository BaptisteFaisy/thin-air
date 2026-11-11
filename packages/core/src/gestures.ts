/**
 * Gestes à seuils doubles (cahier §7.6) : pince, poing, entrée/sortie de
 * zone, traversée de corde, maintien, sortie de main.
 * Propriétés : AIR-P-06 (marge), 07 (une traversée, une note), 08 (balayage).
 */
import type { GestureEvent, Instrument, Settings, TrackedHand } from "./types.js";
import { todo } from "./internal.js";

/** Position des cordes : la corde i est à (i + 0,5) / count. */
export function stringPositions(count: number): readonly number[] {
  void count;
  return todo("gestures.stringPositions", "A2");
}

/**
 * Index de la corde franchie entre deux positions, `null` si aucune.
 * Une traversée franche donne un index ; un tremblement autour d'une corde
 * n'en donne qu'un par délai de réarmement.
 */
export function crossedString(
  previous: number,
  next: number,
  positions: readonly number[],
): number | null {
  void previous; void next; void positions;
  return todo("gestures.crossedString", "A2");
}

/** Force d'un pincement : vitesse / 3, bornée entre 0,1 et 1. */
export function pluckVelocity(speed: number): number {
  void speed;
  return todo("gestures.pluckVelocity", "A2");
}

export class GestureTracker {
  constructor(readonly instrument: Instrument, readonly settings: Settings) {}

  /** Une image : les gestes qui commencent ou finissent, dans l'ordre. */
  push(tSeconds: number, hands: readonly TrackedHand[]): readonly GestureEvent[] {
    void tSeconds; void hands;
    return todo("gestures.GestureTracker.push", "A2");
  }

  /** Sortie définitive : relâche tout ce qui était enclenché. */
  releaseAll(tSeconds: number): readonly GestureEvent[] {
    void tSeconds;
    return todo("gestures.GestureTracker.releaseAll", "A2");
  }

  reset(): void {
    todo("gestures.GestureTracker.reset", "A2");
  }
}
