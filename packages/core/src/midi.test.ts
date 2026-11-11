/**
 * MIDI (cahier §7.12, AIR-F-39) : écriture du fichier, relecture, messages.
 * Propriété : AIR-P-18 (aller-retour).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_TICKS_PER_QUARTER, readVarLen, writeVarLen } from "./midi/smf.js";
import { midiVelocity, pitchBendBytes, velocityFromMidi } from "./midi/value.js";
import {
  MAX_CC_PER_SECOND,
  decodeMidi,
  emptySession,
  encodeMidi,
  eventsToMidiMessages,
} from "./index.js";
import { withSettings } from "./defaults.js";
import type { LoopLayer, MusicEvent, Session } from "./types.js";

const REGLAGES = withSettings({ tempo: 90, loopBars: 4 });

function couche(id: number, events: readonly MusicEvent[], instrument = "phantom"): LoopLayer {
  return { id, instrument, events, muted: false };
}

function session(layers: readonly LoopLayer[], tempo = 90): Session {
  return { ...emptySession(withSettings({ tempo })), layers };
}

function noteOn(t: number, midi: number, voice = "v", velocity = 0.5): MusicEvent {
  return { type: "noteOn", t, voice, midi, velocity };
}

function noteOff(t: number, voice = "v"): MusicEvent {
  return { type: "noteOff", t, voice };
}

function control(
  t: number,
  param: "pitch" | "gain" | "cutoff" | "vibrato",
  value: number,
  voice = "v",
): MusicEvent {
  return { type: "control", t, voice, param, value };
}

/** Les morceaux du fichier : en-tête, puis pistes, avec leur longueur. */
function chunks(bytes: Uint8Array): { type: string; body: Uint8Array }[] {
  const morceaux: { type: string; body: Uint8Array }[] = [];
  let index = 0;
  while (index + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(index, index + 4));
    const longueur =
      ((bytes[index + 4] as number) << 24) |
      ((bytes[index + 5] as number) << 16) |
      ((bytes[index + 6] as number) << 8) |
      (bytes[index + 7] as number);
    morceaux.push({ type, body: bytes.subarray(index + 8, index + 8 + longueur) });
    index += 8 + longueur;
  }
  return morceaux;
}

describe("octets MIDI (§7.12)", () => {
  it("la longueur variable va et vient, y compris au-delà de 127", () => {
    for (const valeur of [0, 1, 127, 128, 16_383, 16_384, 2_097_151]) {
      const octets = Uint8Array.from(writeVarLen(valeur));
      expect(readVarLen(octets, 0)).toEqual({ value: valeur, next: octets.length });
    }
    expect(writeVarLen(0)).toEqual([0x00]);
    expect(writeVarLen(127)).toEqual([0x7f]);
    expect(writeVarLen(128)).toEqual([0x81, 0x00]);
  });

  it("une longueur variable tronquée ne boucle pas", () => {
    expect(readVarLen(Uint8Array.from([0x81]), 0).next).toBe(1);
    expect(readVarLen(new Uint8Array(), 0)).toEqual({ value: 0, next: 0 });
  });

  it("la vélocité 0..1 devient 0..127 par arrondi au plus proche", () => {
    expect(midiVelocity(0)).toBe(1);
    expect(midiVelocity(1)).toBe(127);
    expect(midiVelocity(0.5)).toBe(64);
    expect(midiVelocity(0.17)).toBe(22);
    expect(midiVelocity(2)).toBe(127);
    expect(midiVelocity(-1)).toBe(1);
    expect(velocityFromMidi(127)).toBe(1);
    expect(velocityFromMidi(0)).toBe(0);
    expect(velocityFromMidi(64)).toBeCloseTo(64 / 127, 12);
  });

  it("la molette de hauteur est centrée à 0,5", () => {
    expect(pitchBendBytes(0.5)).toEqual([0, 64]);
    expect(pitchBendBytes(0)).toEqual([0, 0]);
    expect(pitchBendBytes(1)).toEqual([127, 127]);
  });
});

describe("encodeMidi (§7.10 exports, §7.12)", () => {
  it("écrit un SMF de format 1, une piste de direction et une par couche", () => {
    const ma = session([
      couche(1, [noteOn(0.5, 60), noteOff(0.9)]),
      couche(2, [noteOn(1.0, 67), noteOff(1.4)], "harp"),
    ]);
    const octets = encodeMidi(ma);
    const morceaux = chunks(octets);
    expect(morceaux[0]?.type).toBe("MThd");
    expect(morceaux[0]?.body[0]).toBe(0);
    expect(morceaux[0]?.body[1]).toBe(1);
    const pistes = (morceaux[0]?.body[2] as number) * 256 + (morceaux[0]?.body[3] as number);
    expect(pistes).toBe(3);
    const division = (morceaux[0]?.body[4] as number) * 256 + (morceaux[0]?.body[5] as number);
    expect(division).toBe(DEFAULT_TICKS_PER_QUARTER);
    expect(morceaux.slice(1).map((m) => m.type)).toEqual(["MTrk", "MTrk", "MTrk"]);
  });

  it("porte le tempo et le chiffrage dans la première piste, et finit chaque piste", () => {
    const octets = encodeMidi(session([couche(1, [noteOn(0, 60), noteOff(0.5)])]));
    const [, direction, piste] = chunks(octets);
    const corps = direction?.body ?? new Uint8Array();
    // FF 51 03 : tempo en microsecondes par noire ; à 90, 666 667.
    const position = Array.from(corps).findIndex(
      (octet, i) => octet === 0xff && corps[i + 1] === 0x51,
    );
    expect(position).toBeGreaterThanOrEqual(0);
    const us =
      ((corps[position + 3] as number) << 16) |
      ((corps[position + 4] as number) << 8) |
      (corps[position + 5] as number);
    expect(us).toBe(666_667);
    expect(Array.from(corps).includes(0x58)).toBe(true);
    for (const morceau of [direction, piste]) {
      const fin = Array.from(morceau?.body ?? new Uint8Array()).slice(-3);
      expect(fin).toEqual([0xff, 0x2f, 0x00]);
    }
  });

  it("respecte la division demandée et nomme chaque piste", () => {
    const octets = encodeMidi(session([couche(1, [noteOn(0.25, 60), noteOff(0.5)], "choir")]), {
      ticksPerQuarter: 960,
    });
    const morceaux = chunks(octets);
    const division = (morceaux[0]?.body[4] as number) * 256 + (morceaux[0]?.body[5] as number);
    expect(division).toBe(960);
    const corps = morceaux[2]?.body ?? new Uint8Array();
    // Delta, 0xff, 0x03, longueur variable, puis le texte ASCII du nom.
    expect(Array.from(corps.slice(0, 4))).toEqual([0x00, 0xff, 0x03, 0x05]);
    const nom = String.fromCharCode(...Array.from(corps.slice(4, 9)));
    expect(nom).toBe("choir");
  });

  it("une session vide donne un fichier valide, sans note", () => {
    const octets = encodeMidi(emptySession(REGLAGES));
    expect(chunks(octets)).toHaveLength(2);
    expect(decodeMidi(octets)).toEqual([]);
  });

  it("apparie les notes d'une voix et ferme une note restée ouverte", () => {
    const ma = session([
      couche(1, [
        noteOn(0.5, 60),
        noteOn(1.0, 64),
        noteOff(1.5),
        noteOn(2.0, 67, "autre"),
        noteOff(2.5, "autre"),
        noteOn(3.0, 70, "jamais-finie"),
      ]),
    ]);
    const notes = decodeMidi(encodeMidi(ma));
    expect(notes.map((n) => n.midi)).toEqual([60, 64, 67, 70]);
    expect(notes.map((n) => n.track)).toEqual([1, 1, 1, 1]);
  });
});

describe("decodeMidi (§7.12)", () => {
  it("relit les instants en secondes, avec la bonne division", () => {
    const ma = session([couche(1, [noteOn(1.0, 60), noteOff(1.5)])]);
    const [note] = decodeMidi(encodeMidi(ma));
    // Le tempo du fichier est en microsecondes entières (666 667 à 90) : le
    // reliquat est de 5·10⁻⁷ s sur une seconde, très en deçà d'une unité de temps.
    expect(note?.startS).toBeCloseTo(1.0, 5);
    expect(note?.endS).toBeCloseTo(1.5, 5);
    expect(note?.velocity).toBeCloseTo(0.5, 2);
    expect(note?.channel).toBe(0);
    expect(note?.track).toBe(1);
  });

  it("suit un autre tempo que celui de la session si l'option le dit", () => {
    const ma = session([couche(1, [noteOn(1.0, 60), noteOff(2.0)])], 90);
    const [note] = decodeMidi(encodeMidi(ma, { tempo: 120 }));
    // Écrit à 120 puis relu avec le tempo écrit dans le fichier : les instants
    // en secondes ne bougent pas, seuls les nombres d'unités de temps changent.
    expect(note?.startS).toBeCloseTo(1.0, 5);
    expect(note?.endS).toBeCloseTo(2.0, 5);
  });

  it("une seconde piste porte le canal 1 et ses propres notes", () => {
    const ma = session([
      couche(1, [noteOn(0, 60), noteOff(0.5)]),
      couche(2, [noteOn(0, 62), noteOff(0.5)], "harp"),
    ]);
    const notes = decodeMidi(encodeMidi(ma));
    expect(notes.filter((n) => n.track === 1).map((n) => n.midi)).toEqual([60]);
    expect(notes.filter((n) => n.track === 2).map((n) => n.midi)).toEqual([62]);
    expect(notes.every((n) => n.velocity > 0)).toBe(true);
  });

  it("refuse un tampon sans en-tête plutôt que de lire au hasard", () => {
    expect(() => decodeMidi(Uint8Array.from([1, 2, 3]))).toThrow(/MThd/);
  });
});

describe("AIR-P-18 — écrire puis relire redonne les mêmes notes", () => {
  /**
   * Une piste de notes séquentielles : chaque note commence après la fin de la
   * précédente, ce qui rend l'appariement attaque/fin sans ambiguïté et permet
   * de comparer les listes terme à terme.
   */
  const pisteGen = fc
    .array(
      fc.record({
        midi: fc.integer({ min: 0, max: 127 }),
        velocity: fc.integer({ min: 1, max: 127 }),
        dureeMs: fc.integer({ min: 5, max: 400 }),
        ecartMs: fc.integer({ min: 0, max: 400 }),
      }),
      { minLength: 1, maxLength: 10 },
    )
    .map((bruts) => {
      let ms = 0;
      return bruts.map((note) => {
        ms += note.ecartMs;
        const debutMs = ms;
        ms += note.dureeMs;
        return { ...note, debutMs, finMs: ms };
      });
    });

  it("aller-retour d'une session générée, à une unité de temps près", () => {
    fc.assert(
      fc.property(
        fc.array(pisteGen, { minLength: 1, maxLength: 4 }),
        fc.constantFrom(90, 120, 140),
        fc.constantFrom(DEFAULT_TICKS_PER_QUARTER, 960),
        (pistes, tempo, division) => {
          const couches: LoopLayer[] = pistes.map((notes, index) => {
            const voix = `p${index}`;
            const events: MusicEvent[] = notes.flatMap((note) => [
              noteOn(note.debutMs / 1000, note.midi, voix, note.velocity / 127),
              noteOff(note.finMs / 1000, voix),
            ]);
            return couche(index + 1, events, `voix-${index}`);
          });
          const ma = session(couches, tempo);
          const relues = decodeMidi(encodeMidi(ma, { ticksPerQuarter: division }));
          const unite = 60 / tempo / division;
          expect(relues).toHaveLength(pistes.reduce((n, p) => n + p.length, 0));
          pistes.forEach((notes, index) => {
            const siennes = relues.filter((n) => n.track === index + 1);
            expect(siennes).toHaveLength(notes.length);
            notes.forEach((note, rang) => {
              const relue = siennes[rang] as (typeof relues)[number];
              expect(relue.midi).toBe(note.midi);
              expect(Math.abs(relue.startS * 1000 - note.debutMs)).toBeLessThanOrEqual(
                unite * 1000,
              );
              expect(Math.abs(relue.endS * 1000 - note.finMs)).toBeLessThanOrEqual(
                unite * 1000 + 1e-9,
              );
            });
          });
        },
      ),
      { seed: 20_261_112, numRuns: 200 },
    );
  });

  it("aller-retour sur une grille de double croches, à une unité près", () => {
    const ma = session([
      couche(
        1,
        [0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [
          noteOn(i * 0.166_667, 60 + i),
          noteOff(i * 0.166_667 + 0.1),
        ]),
      ),
    ]);
    const relues = decodeMidi(encodeMidi(ma));
    expect(relues).toHaveLength(8);
    const unite = 60 / 90 / DEFAULT_TICKS_PER_QUARTER;
    relues.forEach((note, i) => {
      expect(note.midi).toBe(60 + i);
      expect(Math.abs(note.startS - i * 0.166_667)).toBeLessThanOrEqual(unite);
    });
  });
});

describe("eventsToMidiMessages (§7.12)", () => {
  it("note, vélocité, fin de note et canal", () => {
    const messages = eventsToMidiMessages(
      [noteOn(0.1, 60, "v", 0.5), noteOff(0.6)],
      3,
    );
    expect(messages).toEqual([
      { t: 0.1, bytes: [0x93, 60, 64] },
      { t: 0.6, bytes: [0x83, 60, 0x40] },
    ]);
  });

  it("une fin de note sans attaque connue ne produit rien", () => {
    expect(eventsToMidiMessages([noteOff(0.2)], 0)).toEqual([]);
  });

  it("volume, brillance et vibrato passent par des contrôleurs continus", () => {
    const messages = eventsToMidiMessages(
      [control(0.0, "gain", 0.5), control(0.02, "cutoff", 1), control(0.04, "vibrato", 0)],
      0,
    );
    expect(messages.map((m) => m.bytes)).toEqual([
      [0xb0, 7, 64],
      [0xb0, 74, 127],
      [0xb0, 1, 0],
    ]);
  });

  it("le glissé passe par la molette de hauteur, en 14 bits", () => {
    const messages = eventsToMidiMessages([control(0, "pitch", 0.5, "v")], 1);
    expect(messages[0]?.bytes).toEqual([0xe1, 0, 64]);
  });

  it("les contrôleurs sont limités à cent messages par seconde", () => {
    // 250 messages de gain en 0,5 s : bien au-delà de la limite.
    const serres: MusicEvent[] = Array.from({ length: 250 }, (_, i) =>
      control(i * 0.002, "gain", i / 250),
    );
    const messages = eventsToMidiMessages(serres, 0);
    expect(messages.length).toBeLessThanOrEqual(
      Math.floor(0.5 * MAX_CC_PER_SECOND) + 2,
    );
    expect(messages.length).toBeGreaterThan(40);
    const instants = messages.map((m) => m.t);
    for (let i = 1; i < instants.length; i++) {
      expect((instants[i] as number) - (instants[i - 1] as number)).toBeGreaterThanOrEqual(
        1 / MAX_CC_PER_SECOND - 1e-12,
      );
    }
  });

  it("la limitation se compte par contrôleur : un volume ne bloque pas la brillance", () => {
    const messages = eventsToMidiMessages(
      [control(0, "gain", 0.1), control(0.001, "cutoff", 0.2), control(0.002, "gain", 0.3)],
      0,
    );
    expect(messages.map((m) => m.bytes[1])).toEqual([7, 74]);
  });

  it("les notes ne sont jamais écartées par la limitation", () => {
    const serres: MusicEvent[] = [];
    for (let i = 0; i < 100; i++) {
      serres.push(noteOn(i * 0.001, 60 + (i % 12), `v${i}`, 0.8));
      serres.push(control(i * 0.001 + 0.0005, "gain", 0.5));
    }
    const messages = eventsToMidiMessages(serres, 0);
    const notes = messages.filter((m) => (m.bytes[0] as number) >> 4 === 0x9);
    expect(notes).toHaveLength(100);
    expect(messages.length).toBeLessThanOrEqual(100 + Math.ceil(0.1 * MAX_CC_PER_SECOND) + 1);
  });

  it("plus de cent messages par seconde : le débit tient sur une seconde entière", () => {
    const serres: MusicEvent[] = Array.from({ length: 1000 }, (_, i) =>
      control(i * 0.001, "cutoff", (i % 100) / 100),
    );
    const messages = eventsToMidiMessages(serres, 0);
    expect(messages.length).toBeLessThanOrEqual(MAX_CC_PER_SECOND + 1);
    expect(messages.length).toBeGreaterThanOrEqual(MAX_CC_PER_SECOND - 1);
  });
});
