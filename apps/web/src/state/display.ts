/**
 * Réduction des événements musicaux vers ce que la scène affiche (cahier
 * §11.8, AIR-F-51) : note en cours, jauge de volume, corde qui vibre, bougie
 * allumée dans la zone du chœur, courbe de hauteur du thérémine.
 *
 * La musique (noms de notes, fréquences, décibels) appartient au lot A3 :
 * elle est reçue ici par injection, avec un repli silencieux tant que son
 * corps n'existe pas encore. Aucune formule n'est recopiée.
 */
import { gainToDb, midiToFreq, noteName, type Instrument, type MusicEvent } from "@thin-air/core";

export interface MusicTools {
  readonly noteName: (midi: number) => string;
  readonly midiToFreq: (midi: number) => number;
  readonly gainToDb: (gain: number) => number;
}

function essai<T>(appel: () => T, repli: T): T {
  try {
    return appel();
  } catch {
    return repli;
  }
}

/** Les fonctions de `@thin-air/core`, dégradées tant que le lot A3 est vide. */
export const coreTools: MusicTools = {
  noteName: (midi) => essai(() => noteName(midi), `#${midi}`),
  midiToFreq: (midi) => essai(() => midiToFreq(midi), Number.NaN),
  gainToDb: (gain) => essai(() => gainToDb(gain), Number.NaN),
};

/** Points de la courbe de hauteur gardés pour la traîne du thérémine. */
export const PITCH_TRACE = 48;

export interface ActiveNote {
  readonly voice: string;
  readonly midi: number;
  /** Zone allumée par cette note, si l'instrument en a. */
  readonly zone: number | null;
  /** Corde en vibration, si l'instrument en a. */
  readonly string: number | null;
}

export interface StageDisplay {
  readonly active: readonly ActiveNote[];
  /** Note tenue à ce moment, `null` si silence. */
  readonly midi: number | null;
  readonly note: string;
  readonly frequencyHz: number | null;
  /** Niveau demandé, de 0 à 1. */
  readonly gain: number;
  readonly gainDb: number | null;
  readonly voices: number;
  /** Index des zones tenues (bougies allumées). */
  readonly litZones: readonly number[];
  /** Index des cordes en vibration. */
  readonly pluckedStrings: readonly number[];
  /** Dernières hauteurs, pour la courbe derrière la main. */
  readonly pitchTrace: readonly number[];
}

export function emptyDisplay(): StageDisplay {
  return {
    active: [],
    midi: null,
    note: "",
    frequencyHz: null,
    gain: 0,
    gainDb: null,
    voices: 0,
    litZones: [],
    pluckedStrings: [],
    pitchTrace: [],
  };
}

/**
 * Zone qui s'allume : celle que la voix nomme (chœur : une zone, une voix),
 * sinon celle dont la note absolue correspond. `null` si l'instrument n'a pas
 * de zones.
 */
export function zoneForNote(instrument: Instrument, voice: string, midi: number): number | null {
  const zones = instrument.zones?.zones ?? [];
  if (zones.length === 0) return null;
  const parVoix = zones.findIndex((zone) => zone.id === voice);
  if (parVoix >= 0) return parVoix;
  const parNote = zones.findIndex((zone) => zone.midi === midi);
  return parNote < 0 ? null : parNote;
}

/**
 * Corde qui porte cette note : la note est ramenée dans l'étendue de
 * l'instrument, puis répartie sur le nombre de cordes.
 */
export function stringForMidi(instrument: Instrument, midi: number): number | null {
  const cordes = instrument.strings;
  if (cordes === undefined || cordes.count <= 0) return null;
  const etendue = instrument.range;
  if (etendue === undefined) return null;
  const largeur = etendue.high - etendue.low;
  if (largeur <= 0) return 0;
  const part = (midi - etendue.low) / largeur;
  const borne = part < 0 ? 0 : part > 1 ? 1 : part;
  return Math.min(cordes.count - 1, Math.round(borne * (cordes.count - 1)));
}

function ajoute(liste: readonly number[], valeur: number, max: number): readonly number[] {
  if (liste.includes(valeur)) return liste;
  const suivante = [...liste, valeur];
  return max > 0 && suivante.length > max ? suivante.slice(suivante.length - max) : suivante;
}

function borne01(valeur: number): number {
  if (!Number.isFinite(valeur)) return 0;
  return valeur < 0 ? 0 : valeur > 1 ? 1 : valeur;
}

function fini(valeur: number): number | null {
  return Number.isFinite(valeur) ? valeur : null;
}

interface NotesTenues {
  readonly midi: number | null;
  readonly zones: readonly number[];
  readonly cordes: readonly number[];
}

function notesTenues(active: readonly ActiveNote[]): NotesTenues {
  const dernier = active[active.length - 1];
  return {
    midi: dernier === undefined ? null : dernier.midi,
    zones: active.map((note) => note.zone).filter((zone): zone is number => zone !== null),
    cordes: active.map((note) => note.string).filter((corde): corde is number => corde !== null),
  };
}

/**
 * Un lot d'événements, l'affichage d'avant : l'affichage d'après.
 * `t` ne sert qu'à l'ordre d'arrivée, aucune horloge n'est lue.
 */
export function reduceDisplay(
  previous: StageDisplay,
  events: readonly MusicEvent[],
  instrument: Instrument,
  tools: MusicTools = coreTools,
): StageDisplay {
  const actives = new Map<string, ActiveNote>();
  for (const note of previous.active) actives.set(note.voice, note);
  let gain = previous.gain;
  let trace: readonly number[] = previous.pitchTrace;

  for (const evenement of events) {
    if (evenement.type === "noteOn") {
      actives.set(evenement.voice, noteActive(instrument, evenement.voice, evenement.midi));
      trace = ajoute(trace, evenement.midi, PITCH_TRACE);
    } else if (evenement.type === "noteOff") {
      actives.delete(evenement.voice);
    } else if (evenement.param === "gain") {
      gain = borne01(evenement.value);
    }
  }

  const active = [...actives.values()];
  const tenues = notesTenues(active);
  return {
    active,
    midi: tenues.midi,
    note: tenues.midi === null ? "" : tools.noteName(tenues.midi),
    frequencyHz: tenues.midi === null ? null : fini(tools.midiToFreq(tenues.midi)),
    gain,
    gainDb: gain > 0 ? fini(tools.gainToDb(gain)) : null,
    voices: active.length,
    litZones: tenues.zones,
    pluckedStrings: tenues.cordes,
    pitchTrace: trace,
  };
}

function noteActive(instrument: Instrument, voice: string, midi: number): ActiveNote {
  return {
    voice,
    midi,
    zone: zoneForNote(instrument, voice, midi),
    string: stringForMidi(instrument, midi),
  };
}

/** Les notes tenues ne gardent que leur ordre d'apparition (aucun tri implicite). */

/** Deux images de scène sont-elles identiques ? (évite de redessiner pour rien) */
export function sameDisplay(a: StageDisplay, b: StageDisplay): boolean {
  return (
    a.midi === b.midi &&
    a.gain === b.gain &&
    a.voices === b.voices &&
    a.litZones.join(",") === b.litZones.join(",") &&
    a.pluckedStrings.join(",") === b.pluckedStrings.join(",") &&
    a.pitchTrace.join(",") === b.pitchTrace.join(",")
  );
}
