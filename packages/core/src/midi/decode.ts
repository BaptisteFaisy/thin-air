/**
 * Relecture d'un fichier MIDI : notes avec leurs instants en secondes
 * (cahier §7.12). Le tempo de la piste de direction est intégré, donc un
 * fichier réécrit par un autre outil donne les mêmes instants.
 */
import type { MidiNote } from "../midi.js";
import { readVarLen } from "./smf.js";
import { velocityFromMidi } from "./value.js";

const META = 0xff;
const META_END_OF_TRACK = 0x2f;
const META_TEMPO = 0x51;

/** Tempo par défaut d'un fichier sans méta de tempo : 120 noires par minute. */
const DEFAULT_US_PER_QUARTER = 500_000;

interface RawNote {
  readonly track: number;
  readonly channel: number;
  readonly midi: number;
  readonly velocity: number;
  readonly startTick: number;
  readonly endTick: number;
}

interface TempoEntry {
  readonly tick: number;
  readonly usPerQuarter: number;
}

interface Header {
  readonly ntrks: number;
  readonly division: number;
  readonly offset: number;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let texte = "";
  for (let i = 0; i < length; i++) texte += String.fromCharCode(bytes[offset + i] ?? 0);
  return texte;
}

function readHeader(bytes: Uint8Array): Header {
  if (bytes.length < 14 || ascii(bytes, 0, 4) !== "MThd") {
    throw new Error("MIDI : en-tête MThd absent");
  }
  const vue = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ntrks = vue.getUint16(10, false);
  const division = vue.getUint16(12, false);
  return { ntrks, division: division & 0x7fff, offset: 14 };
}

/** Une piste lue : ses notes brutes (en unités de temps) et ses tempos. */
interface TrackData {
  readonly notes: readonly RawNote[];
  readonly tempos: readonly TempoEntry[];
}

interface ParsedChannel {
  readonly channel: number;
  readonly midi: number;
  readonly velocity: number;
  readonly startTick: number;
}

function parseTrack(bytes: Uint8Array, start: number, end: number, trackIndex: number): TrackData {
  const notes: RawNote[] = [];
  const tempos: TempoEntry[] = [];
  const tenues = new Map<string, ParsedChannel>();
  let index = start;
  let tick = 0;
  let status = 0;
  while (index < end) {
    const delta = readVarLen(bytes, index);
    tick += delta.value;
    index = delta.next;
    if (index >= end) break;
    const octet = bytes[index] as number;
    if (octet === META) {
      index = readMeta(bytes, index, tick, tempos);
      if (index < 0) break;
      continue;
    }
    if (octet === 0xf0 || octet === 0xf7) {
      const longueur = readVarLen(bytes, index + 1);
      index = longueur.next + longueur.value;
      continue;
    }
    if ((octet & 0x80) !== 0) {
      status = octet;
      index++;
    }
    index = readChannel(bytes, index, status, tick, trackIndex, tenues, notes);
  }
  for (const tenue of tenues.values()) {
    notes.push({ ...tenue, track: trackIndex, endTick: tick });
  }
  return { notes, tempos };
}

/** Méta-événement : rend l'index suivant, ou −1 si la piste se termine. */
function readMeta(
  bytes: Uint8Array,
  index: number,
  tick: number,
  tempos: TempoEntry[],
): number {
  const type = bytes[index + 1] ?? META_END_OF_TRACK;
  const longueur = readVarLen(bytes, index + 2);
  const debut = longueur.next;
  const fin = debut + longueur.value;
  if (type === META_END_OF_TRACK) return -1;
  if (type === META_TEMPO && longueur.value >= 3) {
    const us =
      ((bytes[debut] ?? 0) << 16) | ((bytes[debut + 1] ?? 0) << 8) | (bytes[debut + 2] ?? 0);
    if (us > 0) tempos.push({ tick, usPerQuarter: us });
  }
  return Math.min(fin, bytes.length);
}

/** Événement de canal : rend l'index suivant, après ses octets de données. */
function readChannel(
  bytes: Uint8Array,
  index: number,
  status: number,
  tick: number,
  trackIndex: number,
  tenues: Map<string, ParsedChannel>,
  notes: RawNote[],
): number {
  const genre = status & 0xf0;
  const channel = status & 0x0f;
  if (genre === 0xc0 || genre === 0xd0) return index + 1;
  const data1 = bytes[index] ?? 0;
  const data2 = genre === 0x90 || genre === 0x80 || genre === 0xa0 ? (bytes[index + 1] ?? 0) : 0;
  const cle = `${channel}:${data1}`;
  if (genre === 0x90 && data2 > 0) {
    tenues.set(cle, { channel, midi: data1, velocity: data2, startTick: tick });
  } else if (genre === 0x80 || genre === 0x90) {
    const tenue = tenues.get(cle);
    if (tenue !== undefined) {
      tenues.delete(cle);
      notes.push({ ...tenue, track: trackIndex, endTick: Math.max(tick, tenue.startTick) });
    }
  }
  return index + 2;
}

/** Instant en unités de temps → secondes, en intégrant les changements de tempo. */
export function ticksToSeconds(
  tick: number,
  tempos: readonly TempoEntry[],
  division: number,
): number {
  const divisionSûre = division > 0 ? division : 480;
  let secondes = 0;
  let tickPrécédent = 0;
  let us = DEFAULT_US_PER_QUARTER;
  for (const entree of tempos) {
    if (entree.tick > tick) break;
    secondes += ((entree.tick - tickPrécédent) * us) / 1_000_000 / divisionSûre;
    tickPrécédent = entree.tick;
    us = entree.usPerQuarter;
  }
  return secondes + ((tick - tickPrécédent) * us) / 1_000_000 / divisionSûre;
}

function readTracks(bytes: Uint8Array): { pistes: readonly TrackData[]; division: number } {
  const entete = readHeader(bytes);
  const vue = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pistes: TrackData[] = [];
  let index = entete.offset;
  while (index + 8 <= bytes.length && pistes.length < entete.ntrks) {
    const type = ascii(bytes, index, 4);
    const longueur = vue.getUint32(index + 4, false);
    const debut = index + 8;
    const fin = Math.min(debut + longueur, bytes.length);
    if (type === "MTrk") {
      pistes.push(parseTrack(bytes, debut, fin, pistes.length));
    }
    index = debut + longueur;
  }
  return { pistes, division: entete.division };
}

/** Les notes du fichier, triées par piste puis par instant d'attaque. */
export function decodeBytes(bytes: Uint8Array): readonly MidiNote[] {
  const { pistes, division } = readTracks(bytes);
  const tempos = pistes
    .flatMap((piste) => piste.tempos)
    .sort((a, b) => a.tick - b.tick);
  const notes: MidiNote[] = pistes.flatMap((piste) =>
    piste.notes.map((note) => ({
      track: note.track,
      channel: note.channel,
      midi: note.midi,
      velocity: velocityFromMidi(note.velocity),
      startS: ticksToSeconds(note.startTick, tempos, division),
      endS: ticksToSeconds(note.endTick, tempos, division),
    })),
  );
  return notes.sort((a, b) =>
    a.track === b.track ? a.startS - b.startS : a.track - b.track,
  );
}
