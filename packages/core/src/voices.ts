/**
 * Attribution des voix (cahier §7.9, règle 3) : huit au plus, la plus ancienne
 * est reprise, tout est toujours relâché. Propriétés : AIR-P-09, 10.
 */
import type { MusicEvent } from "./types.js";
import { todo } from "./internal.js";

export interface VoiceSlot {
  readonly id: string;
  readonly startedAt: number;
  midi: number;
  active: boolean;
}

export class VoicePool {
  constructor(readonly maxVoices: number) {}

  /**
   * Une note demandée : rend l'événement de reprise si la voix la plus
   * ancienne doit être libérée d'abord.
   */
  noteOn(t: number, id: string, midi: number, velocity: number): readonly MusicEvent[] {
    void t; void id; void midi; void velocity;
    return todo("voices.VoicePool.noteOn", "A3");
  }

  noteOff(t: number, id: string): readonly MusicEvent[] {
    void t; void id;
    return todo("voices.VoicePool.noteOff", "A3");
  }

  /** Relâchement général : onglet masqué, plus d'image, fin de prise. */
  releaseAll(t: number): readonly MusicEvent[] {
    void t;
    return todo("voices.VoicePool.releaseAll", "A3");
  }

  get activeCount(): number {
    return todo("voices.VoicePool.activeCount", "A3");
  }
}
