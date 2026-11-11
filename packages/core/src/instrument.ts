/**
 * De l'instrument-fichier aux événements musicaux (cahier §7.8, §11.4).
 * Propriétés : AIR-P-03, 05, 08, 09, 10, 12.
 */
import type { GestureEvent, Instrument, MusicEvent, Settings, TrackedHand } from "./types.js";
import { todo } from "./internal.js";

export interface InstrumentOptions {
  readonly oneHand?: boolean;
  readonly hold?: boolean;
  readonly leftHanded?: boolean;
  /** Aimant forcé (0..1) ; sinon celui du fichier d'instrument. */
  readonly magnet?: number | null;
}

/**
 * Un instrument en train de jouer : il reçoit des mains suivies et des gestes,
 * et rend les événements de l'image. Sans état partagé entre instruments :
 * deux instances ne peuvent pas se parler (AIR-P-12).
 */
export class InstrumentPlayer {
  constructor(
    readonly instrument: Instrument,
    readonly settings: Settings,
    readonly options?: InstrumentOptions,
  ) {}

  frame(tSeconds: number, hands: readonly TrackedHand[], gestures: readonly GestureEvent[]): readonly MusicEvent[] {
    void tSeconds; void hands; void gestures;
    return todo("instrument.InstrumentPlayer.frame", "A3");
  }

  /**
   * Plus d'image depuis le délai de grâce : toutes les voix se relâchent
   * (AIR-F-15, AIR-F-16).
   */
  stall(tSeconds: number): readonly MusicEvent[] {
    void tSeconds;
    return todo("instrument.InstrumentPlayer.stall", "A3");
  }

  /** Fin de prise : relâche et extinction, aucune voix ne reste active. */
  end(tSeconds: number): readonly MusicEvent[] {
    void tSeconds;
    return todo("instrument.InstrumentPlayer.end", "A3");
  }

  /** Note visée par la main de hauteur, pour l'écran et le mode physique. */
  currentMidi(): number | null {
    return todo("instrument.InstrumentPlayer.currentMidi", "A3");
  }
}
