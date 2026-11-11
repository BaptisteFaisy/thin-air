/**
 * MIDI (cahier §7.12, AIR-F-39) : écriture d'un fichier à une piste par
 * couche, et relecture. Propriété : AIR-P-18 (aller-retour).
 */
import type { MusicEvent, Session } from "./types.js";
import { todo } from "./internal.js";

export interface MidiEncodeOptions {
  /** Unités de temps du fichier (480 par défaut). */
  readonly ticksPerQuarter?: number;
  readonly tempo?: number;
  readonly beatsPerBar?: number;
}

export interface MidiNote {
  readonly track: number;
  readonly channel: number;
  readonly midi: number;
  readonly velocity: number;
  readonly startS: number;
  readonly endS: number;
}

export function encodeMidi(session: Session, options?: MidiEncodeOptions): Uint8Array {
  void session; void options;
  return todo("midi.encodeMidi", "A3");
}

export function decodeMidi(bytes: Uint8Array): readonly MidiNote[] {
  void bytes;
  return todo("midi.decodeMidi", "A3");
}

/** Limite du débit de contrôleurs continus : cent messages par seconde. */
export const MAX_CC_PER_SECOND = 100;

export function eventsToMidiMessages(
  events: readonly MusicEvent[],
  channel: number,
): readonly { readonly t: number; readonly bytes: readonly number[] }[] {
  void events; void channel;
  return todo("midi.eventsToMidiMessages", "A3");
}
