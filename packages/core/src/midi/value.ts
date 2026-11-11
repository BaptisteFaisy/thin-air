/**
 * Conversions entre les valeurs normalisées de `core` (0 à 1) et les octets
 * MIDI (cahier §7.12). Une seule implémentation pour l'écriture et la
 * relecture, sans quoi un aller-retour ne retomberait pas sur ses pieds.
 */

/** Vélocité maximale d'un message MIDI. */
export const MAX_MIDI_VELOCITY = 127;

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(Math.max(value, low), high);
}

/**
 * Vélocité d'attaque, de 0 à 1 vers 0 à 127, **arrondie au plus proche**
 * (`Math.round(v × 127)`), puis bornée à 1 au minimum : en MIDI, une attaque
 * de vélocité 0 est une fin de note, elle ne peut donc pas être écrite ici.
 * Une note de force 0 est donc écrite à 1, et relue à 1/127.
 */
export function midiVelocity(velocity01: number): number {
  return Math.round(clamp(velocity01, 0, 1) * MAX_MIDI_VELOCITY) || 1;
}

/** Vélocité relue : octet 0 à 127 vers 0 à 1. */
export function velocityFromMidi(velocity: number): number {
  return clamp(Math.round(velocity), 0, MAX_MIDI_VELOCITY) / MAX_MIDI_VELOCITY;
}

/** Valeur d'un contrôleur continu : 0 à 1 vers 0 à 127, arrondie au plus proche. */
export function controllerValue(value01: number): number {
  return Math.round(clamp(value01, 0, 1) * MAX_MIDI_VELOCITY);
}

/** Valeur d'un octet de contrôleur continu, ramenée entre 0 et 1. */
export function controllerValueFromMidi(value: number): number {
  return clamp(Math.round(value), 0, MAX_MIDI_VELOCITY) / MAX_MIDI_VELOCITY;
}

/** Centre de la molette de hauteur : 8192 sur 14 bits, soit un demi-ton nul. */
export const PITCH_BEND_CENTER = 8192;

/**
 * Molette de hauteur : 0 à 1 vers les deux octets d'un message `0xEn`, avec
 * 0,5 pour le centre. Les deux octets sont l'octet faible puis l'octet fort.
 */
export function pitchBendBytes(value01: number): readonly [number, number] {
  const quatorze = Math.round(clamp(value01, 0, 1) * 16_383);
  return [quatorze & 0x7f, (quatorze >> 7) & 0x7f];
}
