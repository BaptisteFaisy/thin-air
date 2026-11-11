/**
 * MIDI (cahier §7.12, AIR-F-39) : écriture d'un fichier à une piste par
 * couche, et relecture. Propriété : AIR-P-18 (aller-retour).
 *
 * Ce module ne parle à aucun périphérique : pas de Web MIDI ici. Il produit
 * des octets de fichier et des messages datés, rien d'autre — donc il se
 * teste dans Node.
 */
import { sortByTimeStable } from "./events.js";
import { decodeBytes } from "./midi/decode.js";
import { encodeSession } from "./midi/encode.js";
import {
  CC_BRIGHTNESS,
  CC_MODULATION,
  CC_VOLUME,
  CONTROL_CHANGE,
  NOTE_OFF,
  NOTE_ON,
  PITCH_BEND,
} from "./midi/smf.js";
import { controllerValue, midiVelocity, pitchBendBytes } from "./midi/value.js";
import type { MusicEvent, Session } from "./types.js";

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

/**
 * La session en fichier MIDI standard, format 1 : une piste de direction
 * (tempo, chiffrage) puis une piste par couche, chacune avec son nom.
 * La couche `n` écrit sur le canal `n mod 16`.
 */
export function encodeMidi(session: Session, options?: MidiEncodeOptions): Uint8Array {
  return encodeSession(session, options);
}

/** Les notes d'un fichier MIDI, avec leurs instants en secondes. */
export function decodeMidi(bytes: Uint8Array): readonly MidiNote[] {
  return decodeBytes(bytes);
}

/** Limite du débit de contrôleurs continus : cent messages par seconde. */
export const MAX_CC_PER_SECOND = 100;

/** Un message MIDI prêt à être émis : son instant, et ses octets. */
export interface MidiMessage {
  readonly t: number;
  readonly bytes: readonly number[];
}

function clamp7(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 127);
}

/**
 * Les événements d'une couche en messages MIDI, sur le canal donné :
 *
 * - `noteOn` → `0x9n`, note, vélocité 0..127 (0..1 arrondi au plus proche,
 *   1 au minimum : en MIDI, une vélocité nulle est une fin de note) ;
 * - `noteOff` → `0x8n`, note tenue de la voix, vélocité de relâchement 64 ;
 * - `control` « pitch » → molette de hauteur (`0xEn`, 14 bits, 0,5 = centre) ;
 * - `control` « gain » → contrôleur 7 (volume) ;
 * - `control` « cutoff » → contrôleur 74 (brillance) ;
 * - `control` « vibrato » → contrôleur 1 (modulation).
 *
 * **Débit.** Les contrôleurs continus sont limités à `MAX_CC_PER_SECOND` :
 * au plus un message par pas de `1 / 100` s, un message trop rapproché du
 * précédent est écarté (le premier de chaque pas est gardé). Les notes ne
 * sont jamais écartées : elles portent le contenu musical. Le débit se compte
 * **par canal**, puisque c'est là que la limite a un sens pour le synthé.
 */
export function eventsToMidiMessages(
  events: readonly MusicEvent[],
  channel: number,
): readonly MidiMessage[] {
  const canal = clamp7(channel) & 0x0f;
  const noteTenue = new Map<string, number>();
  const derniereAttaque = new Map<string, number>();
  const pas = 1 / MAX_CC_PER_SECOND;
  const derniereEmission = new Map<string, number>();
  const messages: MidiMessage[] = [];
  for (const event of sortByTimeStable(events)) {
    if (event.type === "noteOn") {
      const midi = clamp7(event.midi);
      noteTenue.set(event.voice, midi);
      derniereAttaque.set(event.voice, midi);
      messages.push({ t: event.t, bytes: [NOTE_ON | canal, midi, midiVelocity(event.velocity)] });
      continue;
    }
    if (event.type === "noteOff") {
      const midi = noteTenue.get(event.voice) ?? derniereAttaque.get(event.voice);
      noteTenue.delete(event.voice);
      if (midi !== undefined) messages.push({ t: event.t, bytes: [NOTE_OFF | canal, midi, 0x40] });
      continue;
    }
    const message = controlMessage(event, canal);
    if (message === null) continue;
    const cle = `${canal}:${message.bytes[1]}`;
    const precedent = derniereEmission.get(cle);
    if (precedent !== undefined && event.t - precedent < pas) continue;
    derniereEmission.set(cle, event.t);
    messages.push({ t: event.t, bytes: message.bytes });
  }
  return messages;
}

/** Traduction d'un réglage continu ; `null` si le paramètre n'a pas d'équivalent. */
function controlMessage(
  event: Extract<MusicEvent, { type: "control" }>,
  canal: number,
): MidiMessage | null {
  switch (event.param) {
    case "pitch": {
      const [faible, fort] = pitchBendBytes(event.value);
      return { t: event.t, bytes: [PITCH_BEND | canal, faible, fort] };
    }
    case "gain":
      return { t: event.t, bytes: [CONTROL_CHANGE | canal, CC_VOLUME, controllerValue(event.value)] };
    case "cutoff":
      return {
        t: event.t,
        bytes: [CONTROL_CHANGE | canal, CC_BRIGHTNESS, controllerValue(event.value)],
      };
    case "vibrato":
      return {
        t: event.t,
        bytes: [CONTROL_CHANGE | canal, CC_MODULATION, controllerValue(event.value)],
      };
  }
}
