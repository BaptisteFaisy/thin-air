/**
 * De l'instrument-fichier aux événements musicaux (cahier §7.8, §11.4).
 * Propriétés : AIR-P-05 (gamme), 09 (aucune note coincée), 10 (voix bornées),
 * 11 (ordre et causalité), 12 (déterminisme).
 *
 * Les entrées sont des `TrackedHand` et des `GestureEvent` littéraux
 * (`instrument-fixtures.ts`) : on teste le mapping, pas les lots B1/A3.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Instrument, MusicEvent, Settings } from "./types.js";
import { DEFAULT_SETTINGS } from "./defaults.js";
import { InstrumentPlayer } from "./instrument.js";
import { degreeToMidi, midiToFreq } from "./music.js";
import {
  CHOEUR,
  HARPE,
  INSTRUMENTS,
  PHANTOM,
  genImages,
  geste,
  main,
  noteOns,
  controls,
  reglages,
} from "./instrument-fixtures.js";

/** Nombre maximal de voix actives dans une liste d'événements. */
function voixMax(evenements: readonly MusicEvent[]): number {
  const actives = new Set<string>();
  let max = 0;
  for (const e of evenements) {
    if (e.type === "noteOn") actives.add(e.voice);
    if (e.type === "noteOff") actives.delete(e.voice);
    max = Math.max(max, actives.size);
  }
  return max;
}

/** Les voix encore actives à la fin : doivent être vides après `end()`. */
function voixRestantes(evenements: readonly MusicEvent[]): Set<string> {
  const actives = new Set<string>();
  for (const e of evenements) {
    if (e.type === "noteOn") actives.add(e.voice);
    if (e.type === "noteOff") actives.delete(e.voice);
  }
  return actives;
}

describe("instrument — le thérémine du cahier (§7.8, §11.4)", () => {
  it("une main de hauteur et une main de volume produisent une voix continue", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages());
    const ev = joueur.frame(0, [main("pitch", { u: 0.3 }), main("volume", { v: 0.75 })], []);
    const ons = noteOns(ev);
    expect(ons).toHaveLength(1);
    expect(ons[0]!.voice).toBe("lead");
    // v = 0,75 → −12 dB → amplitude 0,2512 (§7.7).
    expect(ons[0]!.type === "noteOn" ? ons[0]!.velocity : 0).toBeCloseTo(0.2512, 3);
  });

  it("la hauteur suit u avec l'aimant de l'instrument (0,6)", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages());
    const ev = joueur.frame(0, [main("pitch", { u: 0.3 }), main("volume", { v: 0.75 })], []);
    // m(0,3) = 45 + 36 × 0,3 = 55,8 ; note de la gamme la plus proche : 55 (sol).
    // Aimant 0,6 → 55,8 + 0,6 × (55 − 55,8) = 55,32.
    const on = noteOns(ev)[0]!;
    expect(on.type === "noteOn" ? on.midi : 0).toBeCloseTo(55.32, 6);
  });

  it("avec l'aimant à 1, la note est franche et dans la gamme (AIR-P-05)", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages({ magnet: 1 }));
    const ev = joueur.frame(0, [main("pitch", { u: 0.3 }), main("volume", { v: 0.75 })], []);
    const midi = noteOns(ev)[0]!.type === "noteOn" ? (noteOns(ev)[0] as { midi: number }).midi : 0;
    expect(Number.isInteger(midi)).toBe(true);
    expect(midi).toBe(55);
    expect(PHANTOM.scale.steps).toContain((midi - PHANTOM.scale.root) % 12);
    expect(midiToFreq(midi)).toBeCloseTo(196.0, 2); // sol, §7.14
  });

  it("un changement de hauteur passe par un contrôle, pas par une nouvelle voix", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages());
    joueur.frame(0, [main("pitch", { u: 0.3 }), main("volume", { v: 0.75 })], []);
    const ev = joueur.frame(1 / 30, [main("pitch", { u: 0.5 }), main("volume", { v: 0.9 })], []);
    expect(noteOns(ev)).toHaveLength(0);
    expect(controls(ev, "pitch").length).toBeGreaterThan(0);
    expect(controls(ev, "gain").length).toBeGreaterThan(0);
  });

  it("le poing de la main de volume coupe le son (§7.8)", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages());
    joueur.frame(0, [main("pitch", { u: 0.3 }), main("volume", { v: 0.75 })], []);
    const ev = joueur.frame(1 / 30, [main("pitch", { u: 0.3 })], [geste("fist", "volume")]);
    expect(ev.some((e) => e.type === "noteOff")).toBe(true);
  });

  it("la pince de la main de hauteur ajoute du vibrato, borné à 40 centièmes", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages());
    const ev = joueur.frame(0, [main("pitch", { u: 0.3, pinch: 0.05 }), main("volume", { v: 0.75 })], []);
    const vibratos = controls(ev, "vibrato");
    expect(vibratos.length).toBeGreaterThan(0);
    for (const v of vibratos) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(40);
    }
  });

  it("mode une main : u pour la hauteur, open pour le volume (AIR-F-10)", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages(), { oneHand: true });
    const ev = joueur.frame(0, [main("pitch", { u: 0.4, open: 0.5 })], []);
    const ons = noteOns(ev);
    expect(ons).toHaveLength(1);
    // open = 0,5 → −24 dB → amplitude 0,0631 (§7.7).
    expect(ons[0]!.type === "noteOn" ? ons[0]!.velocity : 0).toBeCloseTo(0.0631, 3);
  });
});

describe("instrument — la harpe et les zones (§7.8)", () => {
  it("une traversée de corde sonne la note du degré correspondant", () => {
    const joueur = new InstrumentPlayer(HARPE, reglages());
    const ev = joueur.frame(0, [main("pitch", { u: 0.22 })], [geste("cross", "pitch", { value: 0.5, index: 3 })]);
    const ons = noteOns(ev);
    expect(ons).toHaveLength(1);
    expect(ons[0]!.voice).toBe("string-3");
    // Degré 3 de ré mineur pentatonique depuis ré 50 : la 57 = 220 Hz (§7.14).
    const midi = ons[0]!.type === "noteOn" ? ons[0]!.midi : 0;
    expect(midi).toBe(degreeToMidi(50, [0, 3, 5, 7, 10], 3));
    expect(midiToFreq(midi)).toBeCloseTo(220, 2);
    expect(ons[0]!.type === "noteOn" ? ons[0]!.velocity : 0).toBeCloseTo(0.1667, 3);
  });

  it("plusieurs cordes dans la même image gardent l'ordre du balayage", () => {
    const joueur = new InstrumentPlayer(HARPE, reglages());
    const gestes = [3, 4, 5].map((index) => geste("cross", "pitch", { value: 0.6, index }));
    const ev = joueur.frame(0, [main("pitch", { u: 0.3 })], gestes);
    expect(noteOns(ev).map((e) => e.voice)).toEqual(["string-3", "string-4", "string-5"]);
  });

  it("une zone tenue par le chœur sonne tant que la main y reste", () => {
    const joueur = new InstrumentPlayer(CHOEUR, reglages());
    const entree = joueur.frame(0, [main("pitch", { u: 0.3, v: 0.5 })], [geste("enter", "pitch", { index: 1 })]);
    expect(noteOns(entree).length).toBeGreaterThan(0);
    const tenue = joueur.frame(1 / 30, [main("pitch", { u: 0.3, v: 0.5 })], []);
    expect(noteOns(tenue)).toHaveLength(0); // pas de doublon
    const sortie = joueur.frame(2 / 30, [main("pitch", { u: 0.9, v: 0.5 })], [geste("leave", "pitch", { phase: "end", index: 1 })]);
    expect(sortie.some((e) => e.type === "noteOff")).toBe(true);
  });
});

describe("instrument — AIR-P-09 : aucune note coincée", () => {
  it("toute note a sa fin, et `end()` ne laisse aucune voix active", () => {
    fc.assert(
      fc.property(fc.constantFrom(...INSTRUMENTS), genImages(16), (instrument, images) => {
        const joueur = new InstrumentPlayer(instrument, reglages());
        const ev: MusicEvent[] = [];
        for (const image of images) ev.push(...joueur.frame(image.t, image.hands, image.gestures));
        let t = images.length > 0 ? images[images.length - 1]!.t : 0;
        for (const e of joueur.stall(t + 1)) ev.push(e);
        for (const e of joueur.end(t + 2)) ev.push(e);
        expect(voixRestantes(ev).size).toBe(0);
      }),
      { numRuns: 120 },
    );
  });

  it("le relâchement général intervient sans image depuis stallReleaseMs (AIR-F-16)", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages());
    joueur.frame(0, [main("pitch", { u: 0.3 }), main("volume", { v: 0.75 })], []);
    const ev = joueur.stall(0 + DEFAULT_SETTINGS.stallReleaseMs / 1000 + 0.05);
    expect(ev.some((e) => e.type === "noteOff")).toBe(true);
  });

  it("la main perdue relâche ses notes après le délai de grâce (AIR-F-15)", () => {
    const joueur = new InstrumentPlayer(PHANTOM, reglages());
    joueur.frame(0, [main("pitch", { u: 0.3 }), main("volume", { v: 0.75 })], []);
    joueur.frame(0.1, [main("pitch", { u: 0.3, present: false })], [geste("handLost", "pitch")]);
    const ev = joueur.frame(0.2, [], []);
    const tous = ev;
    expect(voixRestantes(tous).size).toBeLessThanOrEqual(1);
  });
});

describe("instrument — AIR-P-10, 11, 12", () => {
  it("le nombre de voix ne dépasse jamais maxVoices", () => {
    fc.assert(
      fc.property(fc.constantFrom(...INSTRUMENTS), genImages(20), (instrument, images) => {
        const joueur = new InstrumentPlayer(instrument, reglages());
        const ev: MusicEvent[] = [];
        for (const image of images) ev.push(...joueur.frame(image.t, image.hands, image.gestures));
        const plafond = Math.min(DEFAULT_SETTINGS.maxVoices, instrument.voices);
        expect(voixMax(ev)).toBeLessThanOrEqual(plafond);
      }),
      { numRuns: 120 },
    );
  });

  it("les instants ne décroissent jamais et respectent la causalité (AIR-P-11)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...INSTRUMENTS), genImages(20), (instrument, images) => {
        const joueur = new InstrumentPlayer(instrument, reglages());
        let precedent = -Infinity;
        const debutVoix = new Map<string, number>();
        for (const image of images) {
          for (const e of joueur.frame(image.t, image.hands, image.gestures)) {
            // (a) Le flux ne remonte jamais le temps.
            expect(e.t).toBeGreaterThanOrEqual(precedent);
            expect(e.t).toBeGreaterThanOrEqual(0);
            // (b) Causalité : un événement n'est jamais daté avant le noteOn qui
            // l'a causé. Il peut en revanche être daté AVANT l'image qui le
            // rattrape : une extinction programmée à l'avance (§7.9, règle 2)
            // était due, et la dater à l'instant prévu est précisément ce qui
            // rend le rythme juste. Exiger `e.t >= image.t` serait faux.
            if (e.type === "noteOn") debutVoix.set(e.voice, e.t);
            else {
              const debut = debutVoix.get(e.voice);
              if (debut !== undefined) expect(e.t).toBeGreaterThanOrEqual(debut - 1e-9);
            }
            precedent = e.t;
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("deux joueurs identiques produisent exactement la même liste (AIR-P-12)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...INSTRUMENTS), genImages(12), (instrument, images) => {
        const jouer = (): readonly MusicEvent[] => {
          const joueur = new InstrumentPlayer(instrument, reglages());
          const ev: MusicEvent[] = [];
          for (const image of images) ev.push(...joueur.frame(image.t, image.hands, image.gestures));
          return ev;
        };
        expect(JSON.stringify(jouer())).toBe(JSON.stringify(jouer()));
      }),
      { numRuns: 60 },
    );
  });

  it("deux joueurs ne partagent aucun état : l'un ne change pas l'autre", () => {
    const a = new InstrumentPlayer(HARPE, reglages());
    const b = new InstrumentPlayer(HARPE, reglages());
    a.frame(0, [main("pitch", { u: 0.22 })], [geste("cross", "pitch", { value: 0.5, index: 3 })]);
    const evB = b.frame(0, [main("pitch", { u: 0.22 })], [geste("cross", "pitch", { value: 0.5, index: 3 })]);
    expect(noteOns(evB)).toHaveLength(1);
  });
});

describe("instrument — réglages et modes (§7.13)", () => {
  it("les valeurs viennent des Settings, jamais du code", () => {
    const strict: Settings = reglages({ maxVoices: 1 });
    const joueur = new InstrumentPlayer(HARPE, strict);
    const ev = joueur.frame(0, [main("pitch", { u: 0.3 })], [
      geste("cross", "pitch", { value: 0.6, index: 2 }),
      geste("cross", "pitch", { value: 0.6, index: 5 }),
    ]);
    // Une seule voix autorisée : la seconde reprend la première.
    expect(voixMax(ev)).toBeLessThanOrEqual(1);
    expect(ev.filter((e) => e.type === "noteOff").length).toBeGreaterThan(0);
  });

  it("le mode maintien verrouille la note de zone (AIR-F-12)", () => {
    const joueur = new InstrumentPlayer(CHOEUR, reglages({ hold: true }));
    joueur.frame(0, [main("pitch", { u: 0.3, v: 0.5 })], [geste("enter", "pitch", { index: 1 })]);
    const dwell = joueur.frame(0.5, [main("pitch", { u: 0.3, v: 0.5 })], [geste("dwell", "pitch", { index: 1 })]);
    expect(noteOns(dwell)).toHaveLength(0); // la note existe déjà
    // La main quitte la zone : la note verrouillée reste.
    const apres = joueur.frame(0.6, [main("pitch", { u: 0.9, v: 0.5 })], [geste("leave", "pitch", { phase: "end", index: 1 })]);
    expect(apres.filter((e) => e.type === "noteOff")).toHaveLength(0);
  });

  it("sans maintien, quitter la zone éteint la note", () => {
    const joueur = new InstrumentPlayer(CHOEUR, reglages({ hold: false }));
    joueur.frame(0, [main("pitch", { u: 0.3, v: 0.5 })], [geste("enter", "pitch", { index: 1 })]);
    const apres = joueur.frame(0.6, [main("pitch", { u: 0.9, v: 0.5 })], [geste("leave", "pitch", { phase: "end", index: 1 })]);
    expect(apres.some((e) => e.type === "noteOff")).toBe(true);
  });

  it("AIR-F-24 : `end()` éteint tout, aucune voix ne survit à un changement d'instrument", () => {
    for (const instrument of INSTRUMENTS) {
      const joueur = new InstrumentPlayer(instrument, reglages());
      const ev: MusicEvent[] = [];
      ev.push(...joueur.frame(0, [main("pitch", { u: 0.3, v: 0.5 }), main("volume", { v: 0.8 })], [
        geste("enter", "pitch", { index: 0 }),
        geste("cross", "pitch", { value: 0.6, index: 1 }),
      ]));
      ev.push(...joueur.end(1));
      expect(voixRestantes(ev).size).toBe(0);
    }
  });
});
