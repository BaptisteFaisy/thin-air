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

/**
 * Un palier de note : la hauteur tenue entre deux changements.
 *
 * Un thérémine est une voix CONTINUE dont la hauteur glisse (§7.8) : la liste
 * des notes ne se lit donc pas dans les seuls `noteOn`, mais dans les contrôles
 * de hauteur qui les suivent. C'est ce que la recette §18 demande
 * (« sol, la, si bémol, … dans cet ordre, aux instants de référence ») et ce que
 * l'outil `list_notes` du serveur MCP doit rendre (§11.7).
 */
export interface NoteStep {
  readonly t: number;
  readonly midi: number;
  readonly untilT: number;
  readonly voice: string;
}

/**
 * Découpe une liste d'événements en paliers de note. Les hauteurs non entières
 * (aimant partiel) sont conservées telles quelles : c'est au test de dire s'il
 * attend des notes franches.
 */
export function noteSteps(events: readonly MusicEvent[], durationS?: number): readonly NoteStep[] {
  const ouverts = new Map<string, { t: number; midi: number }>();
  const paliers: NoteStep[] = [];
  const fermer = (voice: string, t: number): void => {
    const ouvert = ouverts.get(voice);
    if (ouvert === undefined) return;
    paliers.push({ t: ouvert.t, midi: ouvert.midi, untilT: t, voice });
    ouverts.delete(voice);
  };
  for (const e of events) {
    if (e.type === "noteOn") {
      fermer(e.voice, e.t);
      ouverts.set(e.voice, { t: e.t, midi: e.midi });
    } else if (e.type === "noteOff") {
      fermer(e.voice, e.t);
    } else if (e.param === "pitch") {
      const ouvert = ouverts.get(e.voice);
      if (ouvert !== undefined && Math.abs(ouvert.midi - e.value) > 1e-9) {
        fermer(e.voice, e.t);
        ouverts.set(e.voice, { t: e.t, midi: e.value });
      }
    }
  }
  const fin = durationS ?? (events.length > 0 ? events[events.length - 1]!.t : 0);
  for (const voice of [...ouverts.keys()].sort()) fermer(voice, fin);
  return paliers.sort((a, b) => a.t - b.t || a.voice.localeCompare(b.voice));
}

/** La liste des notes d'un palier à l'autre, sans répétition consécutive. */
export function noteList(events: readonly MusicEvent[], durationS?: number): readonly number[] {
  const notes: number[] = [];
  for (const palier of noteSteps(events, durationS)) {
    if (notes.length === 0 || Math.abs(notes[notes.length - 1]! - palier.midi) > 1e-9) {
      notes.push(palier.midi);
    }
  }
  return notes;
}
