/**
 * Les seuils doubles du §7.6, et les propriétés AIR-P-06, 07, 08.
 * Les mains suivies sont construites à la main : on teste le mapping des gestes
 * vers les événements, pas la chaîne de vision (c'est le rôle du lot B2).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Features, GestureEvent, Instrument, Settings, TrackedHand } from "./types.js";
import { DEFAULT_SETTINGS, withSettings } from "./defaults.js";
import { GestureTracker, crossedString, crossedStrings, pluckVelocity, stringPositions } from "./gestures.js";

function mesures(overrides: Partial<Features> = {}): Features {
  return { u: 0.5, v: 0.5, pinch: 0.6, open: 0.8, speedU: 0, speedV: 0, present: true, edge: false, ...overrides };
}

function main(role: "pitch" | "volume", m: Partial<Features> = {}): TrackedHand {
  const f = mesures(m);
  return { role, side: role === "pitch" ? "right" : "left", id: role === "pitch" ? 1 : 2, smooth: f, fast: f, present: m.present ?? true, lastSeenT: 0 };
}

const HARPE: Instrument = {
  format: "thin-air-instrument/1",
  name: "Harp",
  pointer: "index",
  scale: { root: 50, steps: [0, 3, 5, 7, 10] },
  strings: { count: 16, axis: "u" },
  snap: 1,
  voices: 8,
  sound: { engine: "pluck", decay: 0.996 },
};

function zones(n: number): Instrument {
  return {
    ...HARPE,
    name: "Choir",
    strings: undefined,
    zones: {
      zones: Array.from({ length: n }, (_, i) => ({
        id: `z${i}`, u0: i / n, u1: (i + 1) / n, v0: 0, v1: 1, degree: i,
      })),
    },
    sound: { engine: "osc", wave: "sawtooth" },
  };
}

function pousser(tracker: GestureTracker, t: number, mains: TrackedHand[]): GestureEvent[] {
  return [...tracker.push(t, mains)];
}

describe("gestures — cordes (§7.6, §7.14)", () => {
  it("la corde i est à (i + 0,5) / count", () => {
    const positions = stringPositions(16);
    expect(positions).toHaveLength(16);
    expect(positions[3]).toBeCloseTo(0.21875, 9);
    expect(positions[4]).toBeCloseTo(0.28125, 9);
    expect(positions[5]).toBeCloseTo(0.34375, 9);
    expect(positions[6]).toBeCloseTo(0.40625, 9);
    expect(stringPositions(0)).toEqual([]);
  });

  it("une traversée franche donne exactement un index, dans le sens du parcours", () => {
    expect(crossedString(0.2, 0.25, stringPositions(16))).toBe(3);
    expect(crossedString(0.25, 0.2, stringPositions(16))).toBe(3);
    expect(crossedStrings(0.2, 0.45, stringPositions(16))).toEqual([3, 4, 5, 6]);
    expect(crossedStrings(0.45, 0.2, stringPositions(16))).toEqual([6, 5, 4, 3]);
    expect(crossedString(0.2, 0.2, stringPositions(16))).toBeNull();
  });

  it("la force d'un pincement est la vitesse divisée par trois, bornée", () => {
    expect(pluckVelocity(0.5)).toBeCloseTo(0.1667, 3);
    expect(pluckVelocity(0)).toBe(0.1);
    expect(pluckVelocity(-9)).toBe(1);
    expect(pluckVelocity(Number.NaN)).toBe(0.1);
  });

  it("AIR-P-07 : une traversée franche produit exactement un pincement", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const evenements: GestureEvent[] = [];
    for (let i = 0; i <= 15; i += 1) {
      const t = i / 30;
      const u = 0.2 + 0.5 * t; // 0,20 → 0,45 en 0,5 s
      evenements.push(...pousser(tracker, t, [main("pitch", { u, speedU: 0.5 })]));
    }
    const cross = evenements.filter((e) => e.gesture === "cross");
    expect(cross.map((e) => e.index)).toEqual([3, 4, 5, 6]);
    const instants = [0.0375, 0.1625, 0.2875, 0.4125];
    cross.forEach((e, i) => {
      expect(Math.abs(e.t - (instants[i] ?? 0))).toBeLessThanOrEqual(1 / 30 + 1e-9);
      expect(pluckVelocity(e.value)).toBeCloseTo(0.17, 2);
    });
  });

  it("§7.14 : le même geste deux fois plus vite donne les mêmes cordes, rapprochées et plus fortes", () => {
    function traverser(duree: number): GestureEvent[] {
      const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
      const images = Math.round(duree * 60); // assez d'images pour la vitesse
      const sortis: GestureEvent[] = [];
      for (let i = 0; i <= images; i += 1) {
        const t = (i / images) * duree;
        const u = 0.2 + 0.25 * (t / duree);
        sortis.push(...pousser(tracker, t, [main("pitch", { u, speedU: 0.25 / duree })]));
      }
      return sortis.filter((e) => e.gesture === "cross");
    }
    const lent = traverser(0.5);
    const vite = traverser(0.25);
    expect(vite.map((e) => e.index)).toEqual(lent.map((e) => e.index));
    expect(vite[vite.length - 1]!.t).toBeCloseTo(lent[lent.length - 1]!.t / 2, 1);
    expect(vite[0]!.value).toBeCloseTo(lent[0]!.value * 2, 1);
  });

  it("AIR-P-08 : un balayage monte, le balayage inverse descend", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const montant: number[] = [];
    for (let i = 0; i <= 30; i += 1) {
      const u = 0.05 + (0.9 * i) / 30;
      for (const e of pousser(tracker, i / 30, [main("pitch", { u, speedU: 0.9 })])) {
        if (e.gesture === "cross") montant.push(e.index!);
      }
    }
    expect(montant).toEqual([...montant].sort((a, b) => a - b));
    // 31 images de 0,05 à 0,95 : la corde 0 (0,03125) est déjà dépassée au
    // départ et la corde 15 (0,96875) n'est pas atteinte — il en reste 14.
    expect(montant.length).toBe(14);
    expect(montant[0]).toBe(1);
    expect(montant[montant.length - 1]).toBe(14);

    const inverse = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const descendant: number[] = [];
    for (let i = 0; i <= 30; i += 1) {
      const u = 0.95 - (0.9 * i) / 30;
      for (const e of pousser(inverse, i / 30, [main("pitch", { u, speedU: -0.9 })])) {
        if (e.gesture === "cross") descendant.push(e.index!);
      }
    }
    expect(descendant).toEqual([...descendant].sort((a, b) => b - a));
    expect(descendant).toEqual([...montant].reverse());
  });

  it("un geste trop lent ne pince rien (minPluckSpeed)", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const evenements = pousser(tracker, 0, [main("pitch", { u: 0.2, speedU: 0.5 })])
      .concat(pousser(tracker, 1 / 30, [main("pitch", { u: 0.3, speedU: 0.05 })]));
    expect(evenements.filter((e) => e.gesture === "cross")).toHaveLength(0);
  });

  it("un tremblement autour d'une corde ne produit au plus qu'un pincement par délai de réarmement", () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 40 }), fc.integer({ min: 2, max: 10 }), (corde, allerRetour) => {
        const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
        const position = stringPositions(16)[corde] ?? 0.5;
        const sortis: GestureEvent[] = [];
        for (let i = 0; i <= allerRetour * 4; i += 1) {
          const u = position + (i % 2 === 0 ? -0.02 : 0.02);
          sortis.push(...pousser(tracker, i / 200, [main("pitch", { u, speedU: 8 })]));
        }
        const cross = sortis.filter((e) => e.gesture === "cross");
        // Réarmement de 80 ms : à 200 Hz, au plus un toutes les 16 images.
        expect(cross.length).toBeLessThanOrEqual(Math.ceil((allerRetour * 4) / 200 / 0.08) + 1);
      }),
      { numRuns: 100 },
    );
  });

  it("un geste qui s'arrête pile sur une corde puis repart en arrière ne la fait sonner qu'une fois", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const corde = stringPositions(16)[3]!;
    const sortis: GestureEvent[] = [];
    sortis.push(...pousser(tracker, 0, [main("pitch", { u: 0.15, speedU: 0.5 })]));
    sortis.push(...pousser(tracker, 1 / 30, [main("pitch", { u: corde, speedU: 0.5 })]));
    sortis.push(...pousser(tracker, 2 / 30, [main("pitch", { u: corde, speedU: 0 })]));
    sortis.push(...pousser(tracker, 3 / 30, [main("pitch", { u: 0.15, speedU: -0.5 })]));
    const cross = sortis.filter((e) => e.gesture === "cross" && e.index === 3);
    expect(cross).toHaveLength(1);
  });

  it("deux images au même horodatage ne produisent ni NaN ni traversée fantôme", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const a = pousser(tracker, 0.5, [main("pitch", { u: 0.2, speedU: 0.5 })]);
    const b = pousser(tracker, 0.5, [main("pitch", { u: 0.3, speedU: Number.NaN })]);
    expect(a.concat(b).every((e) => Number.isFinite(e.t) && Number.isFinite(e.value))).toBe(true);
    expect(b.filter((e) => e.gesture === "cross")).toHaveLength(0); // vitesse non finie refusée
  });
});

describe("gestures — seuils doubles de la pince et du poing (§7.6)", () => {
  it("la pince s'enclenche sous 0,25 et ne se relâche qu'au-dessus de 0,40", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const suite = [0.6, 0.3, 0.24, 0.3, 0.39, 0.41, 0.3];
    const phases: string[] = [];
    suite.forEach((pinch, i) => {
      for (const e of pousser(tracker, i / 30, [main("volume", { pinch })])) {
        if (e.gesture === "pinch") phases.push(e.phase);
      }
    });
    expect(phases).toEqual(["start", "end"]);
  });

  it("AIR-P-06 : une mesure qui hésite entre les deux seuils ne bascule pas en boucle", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 60 }), (n) => {
        const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
        let bascules = 0;
        for (let i = 0; i <= n; i += 1) {
          // Oscillation entre 0,26 et 0,39 : sous le seuil de relâche, au-dessus de l'enclenchement.
          const pinch = i % 2 === 0 ? 0.26 : 0.39;
          bascules += pousser(tracker, i / 30, [main("volume", { pinch })])
            .filter((e) => e.gesture === "pinch").length;
        }
        expect(bascules).toBe(0);
      }),
      { numRuns: 60 },
    );
  });

  it("le poing s'enclenche sous 0,20 et se relâche au-dessus de 0,35", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    const phases: string[] = [];
    [0.8, 0.19, 0.3, 0.36].forEach((open, i) => {
      for (const e of pousser(tracker, i / 30, [main("volume", { open })])) {
        if (e.gesture === "fist") phases.push(e.phase);
      }
    });
    expect(phases).toEqual(["start", "end"]);
  });

  it("les seuils viennent des réglages, pas du code", () => {
    const reglages = withSettings({ pinchOn: 0.5, pinchOff: 0.7 });
    const tracker = new GestureTracker(HARPE, reglages);
    const e1 = pousser(tracker, 0, [main("volume", { pinch: 0.45 })]).filter((x) => x.gesture === "pinch");
    expect(e1.map((e) => e.phase)).toEqual(["start"]);
    const e2 = pousser(tracker, 1 / 30, [main("volume", { pinch: 0.6 })]).filter((x) => x.gesture === "pinch");
    expect(e2).toHaveLength(0); // 0,6 < 0,7 : toujours enclenché
    const e3 = pousser(tracker, 2 / 30, [main("volume", { pinch: 0.75 })]).filter((x) => x.gesture === "pinch");
    expect(e3.map((e) => e.phase)).toEqual(["end"]);
  });
});

describe("gestures — zones, maintien et sortie de main (§7.6, AIR-F-12, AIR-F-15)", () => {
  it("entrée dans la zone réduite, sortie de la zone agrandie", () => {
    const tracker = new GestureTracker(zones(4), DEFAULT_SETTINGS);
    const phases: string[] = [];
    // Zone 1 : u de 0,25 à 0,5. Réduite de 10 % : 0,275 à 0,475 ; agrandie :
    // 0,225 à 0,525. On ne regarde que la zone 1 : le parcours traverse aussi
    // les zones 0 et 2, qui ont leurs propres entrées et sorties.
    for (const u of [0.24, 0.3, 0.49, 0.51, 0.6]) {
      for (const e of pousser(tracker, 0, [main("pitch", { u, v: 0.5 })])) {
        if ((e.gesture === "enter" || e.gesture === "leave") && e.index === 1) {
          phases.push(`${e.gesture}:${e.phase}:${e.index}`);
        }
      }
    }
    expect(phases).toEqual(["enter:start:1", "leave:end:1"]);
  });

  it("le maintien verrouille la note après dwellMs, une seule fois", () => {
    const reglages = withSettings({ hold: true, dwellMs: 400 });
    const tracker = new GestureTracker(zones(4), reglages);
    const dwells: GestureEvent[] = [];
    for (let i = 0; i <= 30; i += 1) {
      for (const e of pousser(tracker, i / 30, [main("pitch", { u: 0.3, v: 0.5 })])) {
        if (e.gesture === "dwell") dwells.push(e);
      }
    }
    expect(dwells).toHaveLength(1);
    expect(dwells[0]!.t).toBeGreaterThanOrEqual(0.4);
    expect(dwells[0]!.t).toBeLessThan(0.5);
  });

  it("sans le réglage maintien, aucun dwell", () => {
    const tracker = new GestureTracker(zones(4), withSettings({ hold: false }));
    const dwells: GestureEvent[] = [];
    for (let i = 0; i <= 30; i += 1) {
      for (const e of pousser(tracker, i / 30, [main("pitch", { u: 0.3, v: 0.5 })])) {
        if (e.gesture === "dwell") dwells.push(e);
      }
    }
    expect(dwells).toHaveLength(0);
  });

  it("une main qui sort relâche ses gestes et signale la sortie, une seule fois", () => {
    const tracker = new GestureTracker(zones(4), DEFAULT_SETTINGS);
    pousser(tracker, 0, [main("pitch", { u: 0.3, v: 0.5 })]); // dans la zone 1
    pousser(tracker, 1 / 30, [main("pitch", { u: 0.3, v: 0.5, pinch: 0.1 })]); // pince enclenchée
    const sortie1 = pousser(tracker, 0.5, [main("pitch", { present: false })]);
    const sortie2 = pousser(tracker, 0.6, [main("pitch", { present: false })]);
    expect(sortie1.filter((e) => e.gesture === "handLost")).toHaveLength(1);
    expect(sortie1.filter((e) => e.gesture === "pinch" && e.phase === "end")).toHaveLength(1);
    expect(sortie1.filter((e) => e.gesture === "leave" && e.phase === "end")).toHaveLength(1);
    expect(sortie2).toHaveLength(0); // rien ne se répète
  });

  it("une main qui disparaît de la liste est traitée comme perdue", () => {
    const tracker = new GestureTracker(zones(4), DEFAULT_SETTINGS);
    pousser(tracker, 0, [main("pitch", { u: 0.3, v: 0.5 })]);
    const apres = pousser(tracker, 1, []);
    expect(apres.filter((e) => e.gesture === "handLost")).toHaveLength(1);
    expect(apres.filter((e) => e.gesture === "leave" && e.phase === "end")).toHaveLength(1);
    expect(pousser(tracker, 2, [])).toHaveLength(0);
  });

  it("releaseAll relâche tout, sans laisser d'état", () => {
    const tracker = new GestureTracker(zones(4), DEFAULT_SETTINGS);
    pousser(tracker, 0, [main("pitch", { u: 0.3, v: 0.5, pinch: 0.1, open: 0.1 })]);
    const fin = [...tracker.releaseAll(1)];
    const gestes = fin.map((e) => `${e.gesture}:${e.phase}`).sort();
    expect(gestes).toEqual(["fist:end", "leave:end", "pinch:end"]);
    expect(tracker.releaseAll(2)).toEqual([]);
  });

  it("deux mains dans la même zone : chacune ses événements, par rôle", () => {
    const tracker = new GestureTracker(zones(4), DEFAULT_SETTINGS);
    const evenements = pousser(tracker, 0, [
      main("pitch", { u: 0.3, v: 0.5 }),
      main("volume", { u: 0.3, v: 0.5 }),
    ]);
    const entrees = evenements.filter((e) => e.gesture === "enter");
    expect(entrees).toHaveLength(2);
    expect(entrees.map((e) => e.hand).sort()).toEqual(["pitch", "volume"]);
  });

  it("AIR-P-11 (part gestes) : les instants ne décroissent jamais", () => {
    const tracker = new GestureTracker(HARPE, DEFAULT_SETTINGS);
    let precedent = -1;
    for (let i = 0; i <= 60; i += 1) {
      for (const e of pousser(tracker, i / 30, [main("pitch", { u: 0.1 + (0.8 * i) / 60, speedU: 0.8 })])) {
        expect(e.t).toBeGreaterThanOrEqual(precedent);
        precedent = e.t;
      }
    }
  });
});
