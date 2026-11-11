/**
 * Mesures de la main (§7.6) et suivi filtré (§7.5).
 * Les mains sont fabriquées par `takeGen.makeHand`, dont l'inversabilité est
 * prouvée par ailleurs : ce qui est mesuré ici, c'est la définition des
 * grandeurs et le comportement du filtre, pas la géométrie de la main.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { DetectedHand, Features } from "./types.js";
import { DEFAULT_SETTINGS, defaultPlayRect, withSettings } from "./defaults.js";
import {
  FeatureTracker,
  OPEN_FIST,
  OPEN_FLAT,
  BOUTS_DOIGTS,
  POINTS_PAUME,
  openValue,
  palmCenter,
  palmScale,
  pinchValue,
  pointerPoint,
  rawFeatures,
} from "./features.js";
import { makeHand, tremorTake, uToImageX } from "./takeGen.js";

const RECT = defaultPlayRect();
const ASPECT = 4 / 3;

/**
 * Une main placée à une position `u` de la ZONE DE JEU (et non de l'image) :
 * `uToImageX` fait la conversion inverse du miroir (§7.4), donc `u` se lit
 * directement dans les assertions.
 */
function main(pose: { x: number; y: number; scale?: number; open?: number; pinch?: number; side?: "left" | "right" }): DetectedHand {
  return makeHand(pose);
}
const mainA = (u: number, v = 0.5, scale = 0.05): DetectedHand =>
  makeHand({ x: uToImageX(u), y: 1 - (0.1 + v * 0.8), scale });

describe("features — grandeurs de la main (§7.6)", () => {
  it("l'échelle de la paume est la distance du poignet à la base du majeur", () => {
    const m = main({ x: 0.5, y: 0.5, scale: 0.11 });
    expect(palmScale(m.points)).toBeCloseTo(0.11, 9);
  });

  it("le centre de la paume est la moyenne des points 0, 5, 9, 13, 17", () => {
    expect(POINTS_PAUME).toEqual([0, 5, 9, 13, 17]);
    const m = main({ x: 0.42, y: 0.57 });
    const centre = palmCenter(m.points);
    expect(centre[0]).toBeCloseTo(0.42, 9);
    expect(centre[1]).toBeCloseTo(0.57, 9);
  });

  it("le pointeur est le bout de l'index ou le centre de la paume (§7.4)", () => {
    const m = main({ x: 0.5, y: 0.5 });
    expect(pointerPoint(m.points, "index")).toEqual(m.points[8]);
    expect(pointerPoint(m.points, "palm")).toEqual(palmCenter(m.points));
  });

  it("la pince est l'écart pouce-index divisé par l'échelle", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (pinch) => {
        expect(pinchValue(main({ x: 0.5, y: 0.5, pinch }).points)).toBeCloseTo(pinch, 9);
      }),
      { numRuns: 100 },
    );
  });

  it("l'ouverture croît avec la main ouverte et reste dans [0, 1]", () => {
    const mesures = [0, 0.25, 0.5, 0.75, 1].map((open) => openValue(main({ x: 0.5, y: 0.5, open }).points));
    for (let i = 1; i < mesures.length; i += 1) expect(mesures[i]!).toBeGreaterThan(mesures[i - 1]!);
    for (const valeur of mesures) {
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThanOrEqual(1);
    }
    expect(OPEN_FLAT).toBeGreaterThan(OPEN_FIST);
    expect(BOUTS_DOIGTS).toEqual([8, 12, 16, 20]);
  });

  it("pince et ouverture ne dépendent pas de la distance à la caméra (§7.4)", () => {
    for (const open of [0.2, 0.8]) {
      const proche = main({ x: 0.5, y: 0.5, scale: 0.18, open, pinch: 0.4 }).points;
      const loin = main({ x: 0.5, y: 0.5, scale: 0.05, open, pinch: 0.4 }).points;
      expect(pinchValue(proche)).toBeCloseTo(pinchValue(loin), 9);
      expect(openValue(proche)).toBeCloseTo(openValue(loin), 9);
    }
  });

  it("une main malformée ne produit ni NaN ni division par zéro", () => {
    const vide: DetectedHand = { side: "right", score: 0.5, points: [] };
    expect(palmScale(vide.points)).toBe(0);
    expect(pinchValue(vide.points)).toBe(0);
    expect(openValue(vide.points)).toBe(0);
    expect(palmCenter(vide.points)).toEqual([0, 0, 0]);
  });

  it("rawFeatures donne u et v dans [0, 1] et le bord hors du rectangle", () => {
    const dedans = rawFeatures(main({ x: 0.5, y: 0.5, scale: 0.02 }), RECT, ASPECT, "palm");
    expect(dedans.u).toBeCloseTo(0.5, 6);
    expect(dedans.v).toBeCloseTo(0.5, 6);
    expect(dedans.edge).toBe(false);
    expect(dedans.present).toBe(true);
    expect(dedans.speedU).toBe(0);
    const dehors = rawFeatures(main({ x: 0.99, y: 0.5, scale: 0.02 }), RECT, ASPECT, "palm");
    expect(dehors.edge).toBe(true);
    expect(dehors.u).toBeLessThanOrEqual(1);
  });
});

describe("features — AIR-P-01 : u et v bornés, u monotone vers la droite", () => {
  it("pour toute pose dans l'image, u et v restent dans [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        fc.double({ min: 0.02, max: 0.2, noNaN: true }),
        (x, y, scale) => {
          const f = rawFeatures(main({ x, y, scale }), RECT, ASPECT, "palm");
          expect(f.u).toBeGreaterThanOrEqual(0);
          expect(f.u).toBeLessThanOrEqual(1);
          expect(f.v).toBeGreaterThanOrEqual(0);
          expect(f.v).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("features — le suivi filtré (§7.5)", () => {
  function suivi(settings = DEFAULT_SETTINGS, pointer: "index" | "palm" = "palm"): FeatureTracker {
    return new FeatureTracker(RECT, ASPECT, settings, pointer);
  }

  it("le canal lissé atténue le tremblement plus que le canal vif", () => {
    const prise = tremorTake({ x: 0.5, y: 0.5, scale: 0.05 }, 0.01, { fps: 30, durationS: 2, seed: 3 });
    const tracker = suivi();
    let ecartLisse = 0;
    let ecartVif = 0;
    for (const image of prise.frames) {
      const { smooth, fast } = tracker.push(image.t, image.hands[0] ?? null);
      ecartLisse = Math.max(ecartLisse, Math.abs(smooth.u - 0.5));
      ecartVif = Math.max(ecartVif, Math.abs(fast.u - 0.5));
    }
    expect(ecartLisse).toBeLessThan(ecartVif);
    expect(ecartLisse).toBeGreaterThan(0);
  });

  it("une main immobile converge vers sa position", () => {
    const tracker = suivi();
    let smooth: Features = tracker.push(0, mainA(0.3, 0.6)).smooth;
    for (let i = 1; i <= 90; i += 1) smooth = tracker.push(i / 30, mainA(0.3, 0.6)).smooth;
    expect(smooth.u).toBeCloseTo(0.3, 2);
    expect(smooth.v).toBeCloseTo(0.6, 2);
  });

  it("les vitesses sont en largeurs de zone par seconde, sur le canal vif", () => {
    const tracker = suivi();
    tracker.push(0, main({ x: 0.7, y: 0.5, scale: 0.05 }));
    let derniere: Features | null = null;
    for (let i = 1; i <= 15; i += 1) {
      // x brut descend → u monte (miroir) : 0,3 → 0,7 de la zone en 0,5 s.
      derniere = tracker.push(i / 30, main({ x: 0.7 - (0.4 * i) / 15, y: 0.5, scale: 0.05 })).fast;
    }
    expect(derniere!.speedU).toBeGreaterThan(0.4);
    expect(derniere!.speedU).toBeLessThan(1.4);
    expect(derniere!.speedV).toBeCloseTo(0, 1);
  });

  it("main perdue : valeurs tenues 150 ms, puis main absente (AIR-F-15)", () => {
    const tracker = suivi();
    for (let i = 0; i <= 10; i += 1) tracker.push(i / 30, mainA(0.4));
    // Dernière image à 0,333 s : 0,4 s est dans le délai de grâce de 150 ms.
    const dansLaGrace = tracker.push(0.4, null).smooth;
    expect(dansLaGrace.present).toBe(true);
    expect(dansLaGrace.u).toBeCloseTo(0.4, 1);
    const tropTard = tracker.push(0.4 + 0.2, null).smooth;
    expect(tropTard.present).toBe(false);
  });

  it("le délai de grâce vient des réglages", () => {
    const tracker = suivi(withSettings({ graceMs: 500 }));
    tracker.push(0, mainA(0.4));
    expect(tracker.push(0.4, null).smooth.present).toBe(true);
    expect(tracker.push(0.6, null).smooth.present).toBe(false);
  });

  it("aucune main dès le départ : rien n'est inventé", () => {
    const tracker = suivi();
    const { smooth, fast } = tracker.push(0, null);
    expect(smooth.present).toBe(false);
    expect(fast.present).toBe(false);
    expect(Number.isFinite(smooth.u) && Number.isFinite(fast.u)).toBe(true);
  });

  it("AIR-P-02 : des horodatages répétés ou désordonnés ne produisent jamais de NaN", () => {
    const tracker = suivi();
    const horodatages = [0, 0, 0, 1 / 30, 1 / 30, 0, 5, 5, -1, 2 / 30];
    for (const t of horodatages) {
      const { smooth, fast } = tracker.push(t, mainA(0.45, 0.55));
      for (const f of [smooth, fast]) {
        for (const valeur of [f.u, f.v, f.pinch, f.open, f.speedU, f.speedV]) {
          expect(Number.isFinite(valeur)).toBe(true);
        }
      }
    }
  });

  it("reset oublie l'historique", () => {
    const tracker = suivi();
    for (let i = 0; i <= 10; i += 1) tracker.push(i / 30, mainA(0.2));
    tracker.reset();
    const apres = tracker.push(11 / 30, mainA(0.8)).smooth;
    expect(apres.u).toBeCloseTo(0.8, 1);
    expect(apres.speedU).toBe(0); // pas d'historique : pas de vitesse inventée
  });
});
