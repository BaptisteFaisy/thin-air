/**
 * Le fichier MIDI standard (SMF), morceau par morceau : en-tête, longueurs
 * variables, méta-événements (cahier §7.12). Aucune dépendance, aucun son :
 * ce module écrit et lit des octets.
 */

/** Division par défaut : 480 unités de temps par noire. */
export const DEFAULT_TICKS_PER_QUARTER = 480;

/** Format 1 : une piste de direction, puis une piste par couche. */
export const SMF_FORMAT_1 = 1;

export const NOTE_OFF = 0x80;
export const NOTE_ON = 0x90;
export const CONTROL_CHANGE = 0xb0;
export const PITCH_BEND = 0xe0;

export const CC_MODULATION = 1;
export const CC_VOLUME = 7;
export const CC_BRIGHTNESS = 74;

const META = 0xff;
const META_END_OF_TRACK = 0x2f;
const META_TEMPO = 0x51;
const META_TIME_SIGNATURE = 0x58;
const META_TRACK_NAME = 0x03;

/** Longueur variable MIDI : groupes de 7 bits, bit fort = « il en reste ». */
export function writeVarLen(value: number): number[] {
  const n = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  const octets = [n & 0x7f];
  let reste = n >> 7;
  while (reste > 0) {
    octets.unshift((reste & 0x7f) | 0x80);
    reste >>= 7;
  }
  return octets;
}

/** Lecture d'une longueur variable ; s'arrête proprement sur un tampon tronqué. */
export function readVarLen(
  bytes: Uint8Array,
  offset: number,
): { readonly value: number; readonly next: number } {
  let value = 0;
  let index = offset;
  for (let garde = 0; garde < 4; garde++) {
    if (index >= bytes.length) return { value, next: index };
    const octet = bytes[index] as number;
    value = (value << 7) | (octet & 0x7f);
    index++;
    if ((octet & 0x80) === 0) break;
  }
  return { value, next: index };
}

/** Octets ASCII d'un texte, bornés à 7 bits : une piste sans accent. */
export function asciiBytes(text: string): number[] {
  const octets: number[] = [];
  for (const caractere of text) {
    const code = caractere.codePointAt(0) ?? 63;
    octets.push(code >= 0x20 && code < 0x7f ? code : 63);
  }
  return octets;
}

function chunk(type: string, body: readonly number[]): number[] {
  const longueur = body.length;
  return [
    ...asciiBytes(type),
    (longueur >> 24) & 0xff,
    (longueur >> 16) & 0xff,
    (longueur >> 8) & 0xff,
    longueur & 0xff,
    ...body,
  ];
}

export function headerChunk(format: number, tracks: number, division: number): number[] {
  return chunk("MThd", [
    (format >> 8) & 0xff,
    format & 0xff,
    (tracks >> 8) & 0xff,
    tracks & 0xff,
    (division >> 8) & 0xff,
    division & 0xff,
  ]);
}

export function trackChunk(body: readonly number[]): number[] {
  return chunk("MTrk", body);
}

/**
 * Les constructeurs de méta-événements ci-dessous rendent les octets **sans**
 * leur delta : c'est `trackBody` qui place le delta de chaque événement, une
 * seule fois. Un delta écrit deux fois décalerait toute la piste.
 */
export function endOfTrack(): number[] {
  return [META, META_END_OF_TRACK, 0x00];
}

/** Tempo en microsecondes par noire, sur trois octets. */
export function metaTempo(usPerQuarter: number): number[] {
  const valeur = Math.min(Math.max(Math.round(usPerQuarter), 1), 0xff_ffff);
  return [
    META,
    META_TEMPO,
    0x03,
    (valeur >> 16) & 0xff,
    (valeur >> 8) & 0xff,
    valeur & 0xff,
  ];
}

/**
 * Chiffrage : `nn` temps par mesure, `dd` = 2 (la noire au dénominateur),
 * 24 horloges MIDI par clic, 8 doubles-croches par noire.
 */
export function metaTimeSignature(beatsPerBar: number): number[] {
  const temps = Math.min(Math.max(Math.round(beatsPerBar), 1), 0xff);
  return [META, META_TIME_SIGNATURE, 0x04, temps, 0x02, 0x18, 0x08];
}

export function metaTrackName(name: string): number[] {
  const octets = asciiBytes(name);
  return [META, META_TRACK_NAME, ...writeVarLen(octets.length), ...octets];
}

/**
 * Un événement daté du fichier : `tick` est sa position absolue, `order` sert
 * à garder l'ordre d'insertion à position égale (tri stable).
 */
export interface TickEvent {
  readonly tick: number;
  readonly order: number;
  readonly bytes: readonly number[];
}

/** Corps d'une piste : deltas successifs, puis fin de piste. */
export function trackBody(events: readonly TickEvent[]): number[] {
  const tries = [...events].sort((a, b) =>
    a.tick === b.tick ? a.order - b.order : a.tick - b.tick,
  );
  const corps: number[] = [];
  let precedent = 0;
  for (const evenement of tries) {
    const tick = Math.max(Math.round(evenement.tick), precedent);
    corps.push(...writeVarLen(tick - precedent), ...evenement.bytes);
    precedent = tick;
  }
  corps.push(...writeVarLen(0), ...endOfTrack());
  return corps;
}

/** Instant en secondes → unités de temps du fichier. */
export function secondsToTicks(t: number, tempo: number, ticksPerQuarter: number): number {
  const tempoSûr = Number.isFinite(tempo) && tempo > 0 ? tempo : 90;
  const division = Number.isFinite(ticksPerQuarter) && ticksPerQuarter > 0
    ? ticksPerQuarter
    : DEFAULT_TICKS_PER_QUARTER;
  const instant = Number.isFinite(t) ? t : 0;
  return Math.max(0, Math.round(((instant * tempoSûr) / 60) * division));
}
