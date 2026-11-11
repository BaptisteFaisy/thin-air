/** `bench events --take <prise> --instrument <fichier>` — tourne dans Node. */
import type { Instrument, MusicEvent, Settings, Take } from "@thin-air/core";
import { noteName, processTake, withSettings } from "@thin-air/core";

import { BenchError, isUnavailableContract } from "./errors.js";
import { fixed, formatSeconds } from "./format.js";

export interface EventsOptions {
  readonly settings?: Partial<Settings>;
  readonly oneHand?: boolean;
  readonly hold?: boolean;
}

export interface FormatEventsOptions {
  /** Nom d'une note ; injectable pour tester la mise en forme seule. */
  readonly noteNameOf?: (midi: number) => string;
}

/** Les réglages effectifs : défauts, puis instrument, puis options explicites. */
export function effectiveSettings(instrument: Instrument, options?: EventsOptions): Settings {
  const merged: Partial<Settings> = { ...(instrument.defaults ?? {}), ...(options?.settings ?? {}) };
  if (options?.oneHand !== undefined) merged.oneHand = options.oneHand;
  if (options?.hold !== undefined) merged.hold = options.hold;
  return withSettings(merged);
}

/**
 * Une prise + un instrument = la liste des événements (niveau 1 de preuve).
 * Le même couple donne toujours la même liste, au bit près (AIR-N-09).
 */
export function eventsOf(take: Take, instrument: Instrument, options?: EventsOptions): readonly MusicEvent[] {
  const settings = effectiveSettings(instrument, options);
  try {
    return processTake(take, instrument, settings, {
      oneHand: settings.oneHand,
      hold: settings.hold,
      magnet: settings.magnet,
    });
  } catch (error) {
    if (isUnavailableContract(error)) {
      throw new BenchError(`événements indisponibles : ${String((error as Error).message)} — lot B2 (pipeline)`);
    }
    throw error;
  }
}

function nameOfMidi(name: (midi: number) => string, midi: number): string {
  try {
    return name(midi);
  } catch {
    // Tant que le lot A3 n'a pas livré `noteName`, la ligne porte le numéro MIDI seul.
    return "";
  }
}

function formatEvent(event: MusicEvent, name: (midi: number) => string): string {
  const instant = formatSeconds(event.t).padEnd(10);
  if (event.type === "noteOn") {
    const label = nameOfMidi(name, event.midi);
    const midi = label === "" ? `midi=${event.midi}` : `midi=${event.midi} (${label})`;
    return `${instant} noteOn   voice=${event.voice}  ${midi}  vel=${fixed(event.velocity, 2)}`;
  }
  if (event.type === "noteOff") {
    return `${instant} noteOff  voice=${event.voice}`;
  }
  return `${instant} control  voice=${event.voice}  param=${event.param}  value=${fixed(event.value, 2)}`;
}

/**
 * Une ligne par événement, triée par instant croissant ; à instant égal, dans
 * l'ordre de production (l'ordre des événements n'est jamais retrié).
 */
export function formatEvents(events: readonly MusicEvent[], options?: FormatEventsOptions): string {
  const name = options?.noteNameOf ?? noteName;
  const ordered = events.map((event, index) => ({ event, index }));
  ordered.sort((a, b) => a.event.t - b.event.t || a.index - b.index);
  return ordered.map(({ event }) => formatEvent(event, name)).join("\n");
}
