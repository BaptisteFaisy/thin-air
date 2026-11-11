/**
 * Écriture d'une session en fichier MIDI : format 1, une piste de direction
 * (tempo, chiffrage) puis une piste par couche (cahier §7.10, §7.12).
 * Propriété : AIR-P-18 (aller-retour).
 */
import { sortByTimeStable } from "../events.js";
import type { MidiEncodeOptions } from "../midi.js";
import type { LoopLayer, MusicEvent, Session } from "../types.js";
import {
  DEFAULT_TICKS_PER_QUARTER,
  NOTE_OFF,
  NOTE_ON,
  SMF_FORMAT_1,
  headerChunk,
  metaTempo,
  metaTimeSignature,
  metaTrackName,
  secondsToTicks,
  trackBody,
  trackChunk,
  type TickEvent,
} from "./smf.js";
import { midiVelocity } from "./value.js";

/** Une note appariée : attaque et fin, en secondes, vélocité déjà en 0..127. */
export interface PairedNote {
  readonly midi: number;
  readonly velocity: number;
  readonly startS: number;
  readonly endS: number;
}

interface OpenNote {
  readonly midi: number;
  readonly velocity: number;
  readonly startS: number;
}

/**
 * Apparie les attaques et les fins d'une couche, voix par voix : une fin de
 * note ferme la dernière attaque de sa voix, et une nouvelle attaque sur une
 * voix déjà tenue ferme la précédente au même instant. Une attaque restée
 * ouverte — la couche s'arrête sans fin de note — est fermée sur elle-même,
 * donc écrite et relue : rien ne disparaît à l'export.
 */
export function pairNotes(events: readonly MusicEvent[]): readonly PairedNote[] {
  const ouvertes = new Map<string, OpenNote>();
  const notes: PairedNote[] = [];
  const fermer = (voix: string, t: number): void => {
    const tenue = ouvertes.get(voix);
    if (tenue === undefined) return;
    ouvertes.delete(voix);
    notes.push({ ...tenue, endS: Math.max(t, tenue.startS) });
  };
  const ordonnes = sortByTimeStable(events);
  for (const event of ordonnes) {
    if (event.type === "noteOn") {
      fermer(event.voice, event.t);
      ouvertes.set(event.voice, {
        midi: Math.min(Math.max(Math.round(event.midi), 0), 127),
        velocity: midiVelocity(event.velocity),
        startS: event.t,
      });
    } else if (event.type === "noteOff") {
      fermer(event.voice, event.t);
    }
  }
  const fin = ordonnes[ordonnes.length - 1]?.t ?? 0;
  for (const voix of [...ouvertes.keys()]) fermer(voix, fin);
  return notes;
}

function noteEvents(
  notes: readonly PairedNote[],
  channel: number,
  tempo: number,
  ticksPerQuarter: number,
): TickEvent[] {
  const evenements: TickEvent[] = [];
  notes.forEach((note, index) => {
    const attaque = secondsToTicks(note.startS, tempo, ticksPerQuarter);
    const fin = secondsToTicks(note.endS, tempo, ticksPerQuarter);
    evenements.push({
      tick: attaque,
      order: index * 2,
      bytes: [NOTE_ON | channel, note.midi, note.velocity],
    });
    evenements.push({
      tick: Math.max(fin, attaque + 1),
      order: index * 2 + 1,
      bytes: [NOTE_OFF | channel, note.midi, 0x40],
    });
  });
  return evenements;
}

function layerTrack(
  layer: LoopLayer,
  index: number,
  tempo: number,
  ticksPerQuarter: number,
): number[] {
  const channel = index % 16;
  const evenements = noteEvents(pairNotes(layer.events), channel, tempo, ticksPerQuarter);
  const nom: TickEvent = { tick: 0, order: -1, bytes: metaTrackName(layer.instrument) };
  return trackChunk(trackBody([nom, ...evenements]));
}

/** Le fichier complet : octets d'en-tête puis de pistes. */
export function encodeSession(session: Session, options?: MidiEncodeOptions): Uint8Array {
  const ticksPerQuarter =
    options?.ticksPerQuarter !== undefined && options.ticksPerQuarter > 0
      ? Math.round(options.ticksPerQuarter)
      : DEFAULT_TICKS_PER_QUARTER;
  const tempo = options?.tempo !== undefined && options.tempo > 0 ? options.tempo : session.tempo;
  const beatsPerBar = options?.beatsPerBar ?? session.beatsPerBar;
  const conducteur = trackChunk(
    trackBody([
      { tick: 0, order: 0, bytes: metaTempo(60_000_000 / tempo) },
      { tick: 0, order: 1, bytes: metaTimeSignature(beatsPerBar) },
    ]),
  );
  const pistes = session.layers.flatMap((layer, index) =>
    layerTrack(layer, index, tempo, ticksPerQuarter),
  );
  const octets = [
    ...headerChunk(SMF_FORMAT_1, session.layers.length + 1, ticksPerQuarter),
    ...conducteur,
    ...pistes,
  ];
  return Uint8Array.from(octets);
}
