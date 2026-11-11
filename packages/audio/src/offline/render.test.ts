import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Instrument, MusicEvent } from "@thin-air/core";
import { finalSilenceMs, freqEnvelope, measureNotes, peakDb } from "@thin-air/core";
import { renderEvents, samplesForDuration } from "./render.js";

const SR = 48_000;

/** Un instrument de sondage : le thérémine du cahier §7.8, sans aimant. */
function instrument(son: Partial<Instrument["sound"]>): Instrument {
  return {
    format: "thin-air-instrument/1",
    name: "Probe",
    pointer: "palm",
    scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 11] },
    range: { low: 45, high: 81 },
    snap: 0,
    voices: 1,
    sound: { engine: "osc", wave: "sine", second: 0.15, attackMs: 60, releaseMs: 150, ...son },
  };
}

const theremin = instrument({});

/** Une liste d'événements : notes tenues, dans les bornes de voix. */
const listeEvenements = fc
  .array(
    fc.record({
      debut: fc.float({ min: 0, max: 1, noNaN: true }),
      duree: fc.float({ min: Math.fround(0.05), max: Math.fround(0.4), noNaN: true }),
      midi: fc.integer({ min: 45, max: 81 }),
      velocity: fc.float({ min: Math.fround(0.1), max: 1, noNaN: true }),
    }),
    { minLength: 1, maxLength: 10 },
  )
  .map((notes): readonly MusicEvent[] =>
    notes.flatMap((note, index) => [
      { type: "noteOn", t: note.debut, voice: `v${index}`, midi: note.midi, velocity: note.velocity },
      { type: "noteOff", t: note.debut + note.duree, voice: `v${index}` },
    ]),
  );

describe("rendu hors ligne — nombres du cahier (§7.14, §7.9)", () => {
  it("3 s à 48 kHz font exactement 144 000 échantillons", () => {
    expect(samplesForDuration(3, SR)).toBe(144_000);
    const rendu = renderEvents([], { instrument: theremin, durationS: 3 });
    expect(rendu.samples).toHaveLength(144_000);
    expect(rendu.durationS).toBe(3);
    expect(rendu.sampleRate).toBe(SR);
  });

  it("la note 69 rend 440 Hz", () => {
    const rendu = renderEvents(
      [
        { type: "noteOn", t: 0.05, voice: "v", midi: 69, velocity: 1 },
        { type: "noteOff", t: 0.55, voice: "v" },
      ],
      { instrument: theremin, reverb: 0 },
    );
    const [note] = measureNotes(rendu.samples, [{ t: 0.05, midi: 69, untilT: 0.55 }], { sampleRate: SR });
    expect(note?.expectedHz).toBe(440);
    expect(Math.abs(note?.cents ?? 99)).toBeLessThan(1);
  });

  it("la durée par défaut couvre le dernier événement, l'extinction et 800 ms", () => {
    const rendu = renderEvents([{ type: "noteOn", t: 1, voice: "v", midi: 60, velocity: 1 }], {
      instrument: theremin,
    });
    // 1 s + extinction 0,15 s + 0,8 s = 1,95 s.
    expect(rendu.durationS).toBeCloseTo(1.95, 5);
    expect(rendu.samples).toHaveLength(Math.round(1.95 * SR));
  });

  it("huit voix au plus : la plus ancienne est reprise (AIR-F-27)", () => {
    const evenements: MusicEvent[] = [];
    for (let i = 0; i < 12; i++) {
      evenements.push({ type: "noteOn", t: 0.05 + i * 0.01, voice: `v${i}`, midi: 60 + i, velocity: 1 });
      evenements.push({ type: "noteOff", t: 1, voice: `v${i}` });
    }
    const rendu = renderEvents(evenements, { instrument: theremin, reverb: 0, durationS: 1.5 });
    expect(rendu.maxVoices).toBe(8);
  });

  it("deux rendus des mêmes événements sont identiques au bit près (AIR-N-09)", () => {
    const evenements: MusicEvent[] = [
      { type: "noteOn", t: 0.05, voice: "a", midi: 60, velocity: 1 },
      { type: "noteOn", t: 0.1, voice: "b", midi: 67, velocity: 0.6 },
      { type: "control", t: 0.2, voice: "a", param: "pitch", value: 62 },
      { type: "noteOff", t: 0.4, voice: "a" },
      { type: "noteOff", t: 0.5, voice: "b" },
    ];
    const options = { instrument: theremin, reverb: 0.25, durationS: 1.5 };
    const un = renderEvents(evenements, options);
    const deux = renderEvents(evenements, options);
    expect(Array.from(un.samples)).toEqual(Array.from(deux.samples));
    expect(un.maxVoices).toBe(deux.maxVoices);
  });

  it("les quatre moteurs rendent du son borné", () => {
    for (const son of [
      { engine: "osc" },
      { engine: "pluck", decay: 0.996 },
      { engine: "fm", fmRatio: 3.5, fmIndex: 6 },
      { engine: "drum", noiseMs: 120, toneHz: 90 },
    ] as const) {
      const rendu = renderEvents(
        [{ type: "noteOn", t: 0.05, voice: "v", midi: 60, velocity: 0.9 }],
        { instrument: instrument(son), reverb: 0, durationS: 1 },
      );
      expect(peakDb(rendu.samples)).toBeLessThanOrEqual(-1);
      expect(peakDb(rendu.samples)).toBeGreaterThan(-40);
    }
  });
});

describe("AIR-P-13 — plafond : la crête du rendu ne dépasse pas −1 dB", () => {
  it("pour toute liste d'événements dans les bornes de voix", () => {
    fc.assert(
      fc.property(listeEvenements, (evenements) => {
        const rendu = renderEvents(evenements, { instrument: theremin, durationS: 2 });
        expect(peakDb(rendu.samples)).toBeLessThanOrEqual(-1 + 1e-9);
      }),
      { numRuns: 20 },
    );
  });

  it("le plafond tient avec 8 voix à pleine vélocité, réverbération comprise", () => {
    const evenements: MusicEvent[] = [];
    for (let i = 0; i < 8; i++) {
      evenements.push({ type: "noteOn", t: 0.05, voice: `v${i}`, midi: 60 + i * 2, velocity: 1 });
      evenements.push({ type: "noteOff", t: 0.8, voice: `v${i}` });
    }
    const rendu = renderEvents(evenements, { instrument: theremin, reverb: 0.25, durationS: 2 });
    expect(peakDb(rendu.samples)).toBeCloseTo(-1, 3);
    expect(rendu.maxVoices).toBe(8);
    // Sans plafond, la crête dépasserait −1 dB : c'est bien le plafond qui la tient.
    const sansPlafond = renderEvents(evenements, {
      instrument: theremin,
      reverb: 0.25,
      durationS: 2,
      ceilingDb: 6,
    });
    expect(peakDb(sansPlafond.samples)).toBeGreaterThan(-1);
  });
});

describe("AIR-P-14 — justesse rendue : 5 centièmes de demi-ton", () => {
  it("pour toute note de l'étendue tenue une demi-seconde", () => {
    fc.assert(
      fc.property(fc.integer({ min: 45, max: 81 }), (midi) => {
        const rendu = renderEvents(
          [
            { type: "noteOn", t: 0.02, voice: "v", midi, velocity: 1 },
            { type: "noteOff", t: 0.52, voice: "v" },
          ],
          { instrument: theremin, reverb: 0, durationS: 0.7 },
        );
        const [note] = measureNotes(rendu.samples, [{ t: 0.02, midi, untilT: 0.52 }], { sampleRate: SR });
        expect(Math.abs(note?.cents ?? 99)).toBeLessThan(5);
      }),
      { numRuns: 20 },
    );
  });

  it("toute l'étendue du thérémine, note par note", () => {
    let pire = 0;
    for (let midi = 45; midi <= 81; midi++) {
      const rendu = renderEvents(
        [
          { type: "noteOn", t: 0.02, voice: "v", midi, velocity: 1 },
          { type: "noteOff", t: 0.52, voice: "v" },
        ],
        { instrument: theremin, reverb: 0, durationS: 0.7 },
      );
      const [note] = measureNotes(rendu.samples, [{ t: 0.02, midi, untilT: 0.52 }], { sampleRate: SR });
      pire = Math.max(pire, Math.abs(note?.cents ?? 99));
    }
    expect(pire).toBeLessThan(5);
    // Mesure relevée : l'écart maximal sur les 37 notes est sous le dixième de centième.
    expect(pire).toBeLessThan(0.5);
  });

  it("la corde pincée rend le ré à 146,83 Hz (cahier §7.9)", () => {
    const harpe = instrument({ engine: "pluck", decay: 0.996, attackMs: 2, releaseMs: 400 });
    const rendu = renderEvents([{ type: "noteOn", t: 0.02, voice: "s", midi: 50, velocity: 0.9 }], {
      instrument: harpe,
      reverb: 0,
      durationS: 0.5,
    });
    const [note] = measureNotes(rendu.samples, [{ t: 0.02, midi: 50, untilT: 0.12 }], { sampleRate: SR });
    expect(note?.expectedHz).toBeCloseTo(146.83, 1);
    expect(Math.abs(note?.cents ?? 99)).toBeLessThan(5);
  });
});

describe("AIR-P-15 — silence final", () => {
  it("sous −60 dB en 800 ms sans réverbération", () => {
    const rendu = renderEvents(
      [
        { type: "noteOn", t: 0.1, voice: "v", midi: 69, velocity: 1 },
        { type: "noteOff", t: 0.6, voice: "v" },
      ],
      { instrument: theremin, reverb: 0, durationS: 3 },
    );
    const queue = finalSilenceMs(rendu.samples, SR, -60);
    // Le silence final compte depuis la fin du tampon : on ramène l'instant
    // du dernier son au relâchement de la note (0,6 s).
    const apresRelachement = (3 - 0.6) * 1000 - queue;
    expect(apresRelachement).toBeGreaterThan(0);
    expect(apresRelachement).toBeLessThan(800);
  });

  it("sous −60 dB en 2 s avec réverbération", () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(0.05), max: Math.fround(0.9), noNaN: true }), (reverb) => {
        const rendu = renderEvents(
          [
            { type: "noteOn", t: 0.1, voice: "v", midi: 69, velocity: 1 },
            { type: "noteOff", t: 0.6, voice: "v" },
          ],
          { instrument: theremin, reverb, durationS: 4 },
        );
        const queue = finalSilenceMs(rendu.samples, SR, -60);
        const apresRelachement = (4 - 0.6) * 1000 - queue;
        expect(apresRelachement).toBeLessThan(2000);
      }),
      { numRuns: 8 },
    );
  });
});

describe("AIR-P-16 — pas de marches : le test du grésillement (§14.6, point 4)", () => {
  /** Un glissé lent, sans aimant : la cible monte linéairement, datée à 30 images/s. */
  function glisse(glideMs: number, paramTauMs: number, f0: number, f1: number) {
    const duree = 1;
    const pas = 1 / 30;
    const evenements: MusicEvent[] = [{ type: "noteOn", t: 0.05, voice: "v", midi: 69, velocity: 1 }];
    for (let i = 1; i * pas <= duree; i++) {
      const hz = f0 + (f1 - f0) * ((i * pas) / duree);
      evenements.push({
        type: "control",
        t: 0.05 + i * pas,
        voice: "v",
        param: "pitch",
        value: 69 + 12 * Math.log2(hz / 440),
      });
    }
    evenements.push({ type: "noteOff", t: 0.05 + duree + 0.2, voice: "v" });
    const rendu = renderEvents(evenements, {
      instrument: instrument({ glideMs }),
      paramTauMs,
      reverb: 0,
      durationS: 2,
    });
    const courbe = freqEnvelope(rendu.samples, { sampleRate: SR, windowS: 0.01 }).filter(
      (point) => point.hz > 0 && point.t > 0.2 && point.t < 0.95,
    );
    let maxSaut = 0;
    for (let i = 1; i < courbe.length; i++) {
      maxSaut = Math.max(maxSaut, Math.abs((courbe[i]?.hz ?? 0) - (courbe[i - 1]?.hz ?? 0)));
    }
    return maxSaut;
  }

  it("le réglage lissé ne saute pas plus que la rampe idéale, à 70 % près", () => {
    const pasIdeal = ((550 - 440) / 1) * 0.01; // Hz par fenêtre de 10 ms
    const maxSaut = glisse(30, 20, 440, 550);
    expect(maxSaut).toBeLessThanOrEqual(pasIdeal * 1.7);
  });

  it("le contre-exemple — réglage fixé par marches toutes les 33 ms — est détecté", () => {
    const pasIdeal = ((550 - 440) / 1) * 0.01;
    const lisse = glisse(30, 20, 440, 550);
    const marches = glisse(0, 0.000001, 440, 550);
    // Sans lissage, la fréquence avance par marches : la mesure le voit.
    expect(marches).toBeGreaterThan(pasIdeal * 1.7);
    expect(marches).toBeGreaterThan(lisse * 1.8);
  });

  it("pour tout glissé lent, le lissage bat les marches", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 300, max: 600, noNaN: true }),
        fc.float({ min: 100, max: 300, noNaN: true }),
        (f0, ecart) => {
          const f1 = f0 + ecart;
          const lisse = glisse(30, 20, f0, f1);
          const marches = glisse(0, 0.000001, f0, f1);
          expect(marches).toBeGreaterThan(lisse * 1.2);
        },
      ),
      { numRuns: 6 },
    );
  });
});
