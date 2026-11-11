import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  SCALES,
  SEASON_SCALE,
  ScaleSnapper,
  applyMagnet,
  centsBetween,
  clampToRange,
  dbFromV,
  dbToGain,
  degreeToMidi,
  freqToMidi,
  gainFromV,
  gainToDb,
  midiToFreq,
  nearestDegree,
  noteBoundary,
  noteName,
  pitchFromU,
  quantizeToScale,
  scaleNoteAbove,
  scaleNoteBelow,
  scaleNotes,
} from "./music.js";
import type { InstrumentRange, ScaleName } from "./types.js";

const HARMONIQUE = SEASON_SCALE.steps;

describe("music — fréquences (§7.7)", () => {
  it("AIR-P-04 : la note 69 vaut 440 Hz et ajouter 12 double la fréquence", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 9);
    for (const midi of [21, 45, 50, 60, 69, 81, 108]) {
      expect(midiToFreq(midi + 12)).toBeCloseTo(midiToFreq(midi) * 2, 6);
    }
  });

  it("l'étendue du thérémine : 45 → 110 Hz, 81 → 880 Hz", () => {
    expect(midiToFreq(45)).toBeCloseTo(110, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
  });

  it("la gamme de saison donne les fréquences du cahier", () => {
    const attendues: readonly [number, number][] = [
      [50, 146.83], [52, 164.81], [53, 174.61], [55, 196.0],
      [57, 220.0], [58, 233.08], [61, 277.18], [62, 293.66],
    ];
    for (const [midi, hz] of attendues) {
      expect(midiToFreq(midi)).toBeCloseTo(hz, 2);
    }
  });

  it("un demi-ton multiplie par 1,05946", () => {
    expect(midiToFreq(70) / midiToFreq(69)).toBeCloseTo(1.05946, 4);
  });

  it("aller-retour fréquence ↔ note", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 127, noNaN: true }), (midi) => {
        expect(freqToMidi(midiToFreq(midi))).toBeCloseTo(midi, 9);
      }),
      { numRuns: 300 },
    );
  });

  it("les entrées dégénérées ne produisent ni NaN ni Infinity", () => {
    expect(midiToFreq(Number.NaN)).toBe(0);
    expect(freqToMidi(0)).toBe(0);
    expect(freqToMidi(-5)).toBe(0);
    expect(centsBetween(0, 440)).toBe(0);
  });

  it("les centièmes : un demi-ton vaut 100 centièmes", () => {
    expect(centsBetween(midiToFreq(69), midiToFreq(70))).toBeCloseTo(100, 6);
    expect(centsBetween(196, 196.02)).toBeCloseTo(0.18, 1);
  });
});

describe("music — gammes (§7.7)", () => {
  it("les huit gammes du tableau", () => {
    const attendues: Record<ScaleName, readonly number[]> = {
      majorPentatonic: [0, 2, 4, 7, 9],
      minorPentatonic: [0, 3, 5, 7, 10],
      naturalMinor: [0, 2, 3, 5, 7, 8, 10],
      harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
      hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
      major: [0, 2, 4, 5, 7, 9, 11],
      wholeTone: [0, 2, 4, 6, 8, 10],
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    };
    for (const nom of Object.keys(attendues) as ScaleName[]) {
      expect(SCALES[nom]).toEqual(attendues[nom]);
    }
  });

  it("le degré k donne root + 12 × ⌊k/n⌋ + steps[k mod n], y compris pour k négatif", () => {
    expect(degreeToMidi(50, HARMONIQUE, 0)).toBe(50);
    expect(degreeToMidi(50, HARMONIQUE, 3)).toBe(55);
    expect(degreeToMidi(50, HARMONIQUE, 7)).toBe(62); // octave au-dessus
    expect(degreeToMidi(50, HARMONIQUE, -1)).toBe(49); // un degré sous la fondamentale
    expect(degreeToMidi(50, HARMONIQUE, -7)).toBe(38);
  });

  it("la harpe : seize cordes, ré mineur pentatonique sur trois octaves", () => {
    const pentatonique = SCALES.minorPentatonic;
    // Corde i = degré i ; les cordes 3 à 6 sont l'exemple chiffré du §7.14.
    expect(degreeToMidi(50, pentatonique, 3)).toBe(57); // la 220 Hz
    expect(degreeToMidi(50, pentatonique, 4)).toBe(60); // do 261,63
    expect(degreeToMidi(50, pentatonique, 5)).toBe(62); // ré 293,66
    expect(degreeToMidi(50, pentatonique, 6)).toBe(65); // fa 349,23
    expect(midiToFreq(degreeToMidi(50, pentatonique, 0))).toBeCloseTo(146.83, 2);
    expect(midiToFreq(degreeToMidi(50, pentatonique, 15))).toBeCloseTo(1174.66, 2);
  });

  it("scaleNotes liste la gamme dans l'étendue, dans l'ordre montant", () => {
    const notes = scaleNotes(50, HARMONIQUE, { low: 45, high: 81 });
    expect(notes).toEqual([...notes].sort((a, b) => a - b));
    // La fondamentale et son octave grave/aigu sont dedans ; 45 est le la sous
    // le ré 50, donc bien un degré de la gamme.
    expect(notes[0]).toBe(45);
    expect(notes).toContain(50);
    expect(notes).toContain(62);
    // Chaque note appartient à la gamme : son écart à la fondamentale, modulo
    // l'octave, est un degré de la gamme.
    for (const note of notes) {
      expect(HARMONIQUE).toContain(((note - 50) % 12 + 12) % 12);
    }
    // Rien hors de l'étendue.
    expect(notes.every((n) => n >= 45 && n <= 81)).toBe(true);
  });
});

describe("music — hauteur continue et aimant (§7.7)", () => {
  const ETENDUE: InstrumentRange = { low: 45, high: 81 };

  it("du la 110 Hz au la 880 Hz, un quart de la largeur donne 185,00 Hz", () => {
    expect(midiToFreq(pitchFromU(0.25, ETENDUE))).toBeCloseTo(185.0, 2);
    expect(midiToFreq(pitchFromU(0.5, ETENDUE))).toBeCloseTo(311.13, 2);
    expect(midiToFreq(pitchFromU(0.75, ETENDUE))).toBeCloseTo(523.25, 2);
    expect(midiToFreq(pitchFromU(0, ETENDUE))).toBeCloseTo(110, 6);
    expect(midiToFreq(pitchFromU(1, ETENDUE))).toBeCloseTo(880, 6);
  });

  it("AIR-P-03 : la hauteur est monotone en u, avec ou sans aimant", () => {
    const racine = fc.integer({ min: 24, max: 72 });
    const gamme = fc.constantFrom(...(Object.keys(SCALES) as ScaleName[]));
    fc.assert(
      fc.property(racine, gamme, fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
        (root, nom, u1, delta, aimant) => {
          const steps = SCALES[nom];
          const range: InstrumentRange = { low: root, high: root + 36 };
          const u2 = Math.min(1, u1 + delta);
          const m1 = pitchFromU(u1, range);
          const m2 = pitchFromU(u2, range);
          expect(m2).toBeGreaterThanOrEqual(m1);
          const a1 = applyMagnet(m1, quantizeToScale(m1, root, steps), aimant);
          const a2 = applyMagnet(m2, quantizeToScale(m2, root, steps), aimant);
          expect(a2).toBeGreaterThanOrEqual(a1 - 1e-9);
        }),
      { numRuns: 400 },
    );
  });

  it("AIR-P-05 : avec l'aimant à 1, toute note est dans la gamme et l'étendue", () => {
    fc.assert(
      fc.property(fc.integer({ min: 24, max: 72 }), fc.double({ min: 0, max: 1, noNaN: true }),
        (root, u) => {
          const range: InstrumentRange = { low: root, high: root + 36 };
          const midi = applyMagnet(pitchFromU(u, range), quantizeToScale(pitchFromU(u, range), root, HARMONIQUE), 1);
          expect(midi).toBeGreaterThanOrEqual(range.low - 1e-9);
          expect(midi).toBeLessThanOrEqual(range.high + 1e-9);
          expect(HARMONIQUE).toContain(((midi - root) % 12 + 12) % 12);
        }),
      { numRuns: 400 },
    );
  });

  it("l'aimant à 0 laisse le glissé pur, à 1 donne la note franche", () => {
    expect(applyMagnet(55.4, 55, 0)).toBeCloseTo(55.4, 9);
    expect(applyMagnet(55.4, 55, 1)).toBeCloseTo(55, 9);
    expect(applyMagnet(55.4, 55, 0.5)).toBeCloseTo(55.2, 9);
    expect(applyMagnet(55.4, 55, 3)).toBeCloseTo(55, 9); // borné à 1
  });
});

describe("music — seuils de changement de note (§7.6 et §7.14)", () => {
  it("les seuils du tableau du thérémine sont retrouvés exactement", () => {
    // sol → la → si bémol → do dièse → ré → mi → fa → sol
    const attendus: readonly [number, number, number][] = [
      [55, 57, 56.3], [57, 58, 57.65], [58, 61, 59.95], [61, 62, 61.65],
      [62, 64, 63.3], [64, 65, 64.65], [65, 67, 66.3],
    ];
    for (const [de, vers, seuil] of attendus) {
      expect(noteBoundary(de, vers, 0.15)).toBeCloseTo(seuil, 9);
    }
  });

  it("le balayage de u = 0,30 à u = 0,60 donne les huit notes du cahier, aux u attendus", () => {
    const ETENDUE: InstrumentRange = { low: 45, high: 81 };
    const snapper = new ScaleSnapper(SEASON_SCALE.root, HARMONIQUE, 0.15);
    const passages: { u: number; midi: number }[] = [];
    let precedente: number | null = null;
    for (let i = 0; i <= 3000; i += 1) {
      const u = 0.3 + (0.3 * i) / 3000;
      const midi = snapper.next(pitchFromU(u, ETENDUE));
      if (midi !== precedente) {
        passages.push({ u, midi });
        precedente = midi;
      }
    }
    expect(passages.map((p) => p.midi)).toEqual([55, 57, 58, 61, 62, 64, 65, 67]);
    const uAttendus = [0.3, 0.314, 0.351, 0.415, 0.463, 0.508, 0.546, 0.592];
    passages.forEach((p, i) => {
      expect(p.u).toBeCloseTo(uAttendus[i] ?? 0, 2);
    });
  });

  it("AIR-P-06 (part musicale) : un tremblement sous la marge ne fait pas basculer la note", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.2, max: 0.8, noNaN: true }), fc.integer({ min: 1, max: 200 }),
        (centre, nbTours) => {
          const ETENDUE: InstrumentRange = { low: 45, high: 81 };
          const snapper = new ScaleSnapper(SEASON_SCALE.root, HARMONIQUE, 0.15);
          // Amplitude sous la MARGE : la marge vaut hystérésis × écart, soit
          // 0,15 demi-ton sur l'écart le plus étroit de la gamme. 0,2 % de
          // l'étendue = 0,072 demi-ton < 0,15 : c'est la condition de AIR-P-06.
          const amplitude = 0.002 * (ETENDUE.high - ETENDUE.low);
          const depart = pitchFromU(centre, ETENDUE);
          let changements = 0;
          let precedent = snapper.next(depart);
          for (let i = 0; i < nbTours; i += 1) {
            const midi = depart + (i % 2 === 0 ? amplitude : -amplitude);
            const note = snapper.next(midi);
            if (note !== precedent) changements += 1;
            precedent = note;
          }
          expect(changements).toBeLessThanOrEqual(1);
        }),
      { numRuns: 200 },
    );
  });

  it("voisins de gamme : au-dessus et en dessous, strictement", () => {
    expect(scaleNoteAbove(55, 50, HARMONIQUE)).toBe(57);
    expect(scaleNoteBelow(55, 50, HARMONIQUE)).toBe(53);
    expect(nearestDegree(55.4, 50, HARMONIQUE)).toBe(3);
  });

  it("clampToRange remet dans l'étendue, même à l'envers", () => {
    expect(clampToRange(90, { low: 45, high: 81 })).toBe(81);
    expect(clampToRange(10, { low: 81, high: 45 })).toBe(45);
    expect(clampToRange(Number.NaN, { low: 45, high: 81 })).toBe(45);
  });
});

describe("music — volume en décibels (§7.7)", () => {
  it("0 dB en haut, −12 dB aux trois quarts, −24 dB à mi-hauteur", () => {
    expect(dbFromV(1)).toBeCloseTo(0, 9);
    expect(dbFromV(0.75)).toBeCloseTo(-12, 9);
    expect(dbFromV(0.5)).toBeCloseTo(-24, 9);
  });

  it("sous 5 % de hauteur, silence", () => {
    expect(gainFromV(0.04)).toBe(0);
    expect(gainFromV(0)).toBe(0);
    expect(gainFromV(0.05)).toBeGreaterThan(0);
  });

  it("−12 dB divise l'amplitude par quatre environ, −6 dB par deux", () => {
    expect(dbToGain(-6)).toBeCloseTo(0.5012, 3);
    expect(dbToGain(-12)).toBeCloseTo(0.2512, 3);
    expect(gainFromV(0.75)).toBeCloseTo(0.2512, 3);
  });

  it("aller-retour dB ↔ amplitude", () => {
    fc.assert(
      fc.property(fc.double({ min: -119, max: 0, noNaN: true }), (db) => {
        expect(gainToDb(dbToGain(db))).toBeCloseTo(db, 6);
      }),
      { numRuns: 200 },
    );
    expect(gainToDb(0)).toBe(-120);
    expect(dbToGain(-200)).toBe(0);
  });

  it("la courbe linéaire borne sans passer par les décibels", () => {
    expect(gainFromV(0.42, "linear")).toBeCloseTo(0.42, 9);
    expect(gainFromV(5, "linear")).toBe(1);
  });
});

describe("music — noms de notes (§5.3, AIR-F-53)", () => {
  it("C4 = 60, A4 = 69", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(69)).toBe("A4");
    expect(noteName(50)).toBe("D3");
    expect(noteName(61)).toBe("C#4");
    expect(noteName(0)).toBe("C-1");
  });
});

describe("music — §5.3 : pourquoi l'aimant par défaut", () => {
  it("trois octaves sur 80 cm : un demi-ton tient dans 2,2 cm", () => {
    const cmParDemiTon = 80 / 36;
    expect(cmParDemiTon).toBeCloseTo(2.22, 1);
  });

  it("un tremblement de 0,5 % de la largeur déplace la note de 18 centièmes", () => {
    const demiTon = 0.005 * 36; // en demi-tons, sur 36 demi-tons de largeur
    expect(demiTon * 100).toBeCloseTo(18, 6);
  });

  it("avec la gamme de saison à cinq puis sept notes, on vise large", () => {
    const notes = scaleNotes(50, HARMONIQUE, { low: 45, high: 81 }).length;
    expect(notes).toBeGreaterThan(15);
    const cmParNote = 80 / (notes - 1);
    expect(cmParNote).toBeGreaterThan(3);
  });
});
