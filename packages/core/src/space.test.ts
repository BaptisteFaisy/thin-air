import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  axisValue,
  calibratePlayRect,
  clamp01,
  isotropicDistance,
  mirrorX,
  toPlayPosition,
  type CalibrationSample,
} from "./space.js";
import { defaultPlayRect } from "./defaults.js";
import type { PlayRect } from "./types.js";

/** Un rectangle de jeu valide : ordonné et dans l'image. */
const borne = fc.double({ min: 0, max: 1, noNaN: true });
const rectArb: fc.Arbitrary<PlayRect> = fc
  .tuple(borne, borne, borne, borne)
  .map(([a, b, c, d]) => ({
    u0: Math.min(a, b),
    u1: Math.max(a, b),
    v0: Math.min(c, d),
    v1: Math.max(c, d),
    calibratedAt: null,
  }));

const aspectArb = fc.double({ min: 0.25, max: 4, noNaN: true });

describe("space — miroir et zone de jeu (§7.4)", () => {
  it("le miroir retourne l'abscisse et reste dans l'image", () => {
    expect(mirrorX(0)).toBe(1);
    expect(mirrorX(1)).toBe(0);
    expect(mirrorX(0.3)).toBeCloseTo(0.7, 12);
    expect(mirrorX(-2)).toBe(1); // 1 − (−2) = 3, borné à 1
    expect(mirrorX(5)).toBe(0); // 1 − 5 = −4, borné à 0
    expect(mirrorX(Number.NaN)).toBe(0);
  });

  it("le centre de la zone par défaut donne (0,5 ; 0,5)", () => {
    const rect = defaultPlayRect();
    // x brut 0,5 → écran 0,5 ; y brut 0,5 → écran 0,5.
    expect(toPlayPosition(0.5, 0.5, rect, 4 / 3)).toEqual({ u: 0.5, v: 0.5, edge: false });
  });

  it("aller vers la droite de l'écran fait croître u", () => {
    const rect = defaultPlayRect();
    // Écran = miroir du brut : x brut 0,1 → écran 0,9 (à droite).
    const droite = toPlayPosition(0.1, 0.5, rect, 4 / 3);
    const gauche = toPlayPosition(0.9, 0.5, rect, 4 / 3);
    expect(droite.u).toBeGreaterThan(gauche.u);
    expect(droite.u).toBeCloseTo(1, 6);
    expect(gauche.u).toBeCloseTo(0, 6);
  });

  it("le bas de l'image est v = 0, le haut v = 1", () => {
    const rect = defaultPlayRect();
    expect(toPlayPosition(0.5, 0.95, rect, 1).v).toBeCloseTo(0, 6);
    expect(toPlayPosition(0.5, 0.05, rect, 1).v).toBeCloseTo(1, 6);
  });

  it("hors du rectangle : valeurs bornées et indicateur de bord", () => {
    const rect = defaultPlayRect();
    const hors = toPlayPosition(0.99, 0.99, rect, 1); // écran (0,01 ; 0,01)
    expect(hors).toEqual({ u: 0, v: 0, edge: true });
    const dedans = toPlayPosition(0.5, 0.5, rect, 1);
    expect(dedans.edge).toBe(false);
  });

  it("un rectangle dégénéré ne divise pas par zéro", () => {
    const plat: PlayRect = { u0: 0.5, u1: 0.5, v0: 0.5, v1: 0.5, calibratedAt: null };
    expect(toPlayPosition(0.5, 0.5, plat, 1)).toEqual({ u: 0, v: 0, edge: true });
    expect(clamp01(Infinity)).toBe(1);
    expect(clamp01(-Infinity)).toBe(0);
  });

  it("les distances sont corrigées du rapport largeur/hauteur", () => {
    // 640 × 480 : 0,1 en x vaut 64 px, 0,1 en y vaut 48 px.
    const carre = isotropicDistance(0, 0, 0.1, 0.1, 640 / 480);
    expect(carre).toBeCloseTo(Math.hypot(0.1 * (4 / 3), 0.1), 12);
    expect(isotropicDistance(0, 0, 0.1, 0, 1)).toBeCloseTo(0.1, 12);
    expect(Number.isFinite(isotropicDistance(0, 0, 1, 1, Number.NaN))).toBe(true);
  });

  it("axisValue lit l'axe demandé", () => {
    expect(axisValue({ u: 0.25, v: 0.75, edge: false }, "u")).toBe(0.25);
    expect(axisValue({ u: 0.25, v: 0.75, edge: false }, "v")).toBe(0.75);
  });

  it("clamp01 borne et remplace les non-finis", () => {
    expect([clamp01(-1), clamp01(2), clamp01(Number.NaN), clamp01(Infinity)]).toEqual([0, 1, 0, 1]);
    expect(clamp01(0.42)).toBe(0.42);
  });
});

describe("space — calibration sur la portée (AIR-F-09)", () => {
  /** Nuage couvrant toute l'image : la zone doit être large et contenir 90 % des points. */
  function nuage(n: number, graine: number): CalibrationSample[] {
    let etat = graine >>> 0;
    const suivant = (): number => {
      etat = (etat * 1664525 + 1013904223) >>> 0;
      return etat / 2 ** 32;
    };
    return Array.from({ length: n }, () => ({ u: suivant(), v: suivant() }));
  }

  it("un relevé couvrant l'image donne une zone proche des 80 % centraux", () => {
    const rect = calibratePlayRect(nuage(400, 7), { calibratedAt: 1234 });
    expect(rect).not.toBeNull();
    // 5ᵉ centile ≈ 0,05 puis élargi de 5 % de la largeur (≈ 0,045) → ≈ 0,005.
    expect(rect!.u0).toBeLessThan(0.03);
    expect(rect!.u1).toBeGreaterThan(0.97);
    expect(rect!.v0).toBeLessThan(0.03);
    expect(rect!.v1).toBeGreaterThan(0.97);
    expect(rect!.u1 - rect!.u0).toBeGreaterThanOrEqual(0.2);
    expect(rect?.calibratedAt).toBe(1234);
  });

  it("un relevé trop étroit est refusé : l'écran proposera de recommencer", () => {
    const etroit: CalibrationSample[] = Array.from({ length: 50 }, (_, i) => ({
      u: 0.5 + i / 1000,
      v: 0.5 + i / 1000,
    }));
    expect(calibratePlayRect(etroit)).toBeNull();
  });

  it("un relevé vide ne produit rien", () => {
    expect(calibratePlayRect([])).toBeNull();
  });

  it("le rectangle reste dans l'image même avec des débordements", () => {
    const debordant: CalibrationSample[] = [
      { u: -3, v: -3 }, { u: 4, v: 4 }, { u: 0, v: 1 }, { u: 1, v: 0 },
    ];
    const rect = calibratePlayRect(debordant);
    expect(rect).not.toBeNull();
    expect(rect!.u0).toBeGreaterThanOrEqual(0);
    expect(rect!.u1).toBeLessThanOrEqual(1);
    expect(rect!.v0).toBeGreaterThanOrEqual(0);
    expect(rect!.v1).toBeLessThanOrEqual(1);
  });
});

describe("AIR-P-01 — zone de jeu : u et v bornés, u monotone vers la droite de l'écran", () => {
  it("pour tout point et tout rectangle, u et v sont dans [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -2, max: 3, noNaN: true }),
        fc.double({ min: -2, max: 3, noNaN: true }),
        rectArb,
        aspectArb,
        (x, y, rect, aspect) => {
          const p = toPlayPosition(x, y, rect, aspect);
          expect(p.u).toBeGreaterThanOrEqual(0);
          expect(p.u).toBeLessThanOrEqual(1);
          expect(p.v).toBeGreaterThanOrEqual(0);
          expect(p.v).toBeLessThanOrEqual(1);
          expect(Number.isFinite(p.u) && Number.isFinite(p.v)).toBe(true);
        },
      ),
      { numRuns: 400 },
    );
  });

  it("u ne décroît pas quand la main va vers la droite de l'écran", () => {
    fc.assert(
      fc.property(rectArb, aspectArb, fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
        (rect, aspect, ecranGauche, delta, y) => {
          const ecranDroite = Math.min(1, ecranGauche + delta);
          // L'écran est le miroir du brut : x_brut = 1 − x_écran.
          const a = toPlayPosition(1 - ecranGauche, y, rect, aspect);
          const b = toPlayPosition(1 - ecranDroite, y, rect, aspect);
          expect(b.u).toBeGreaterThanOrEqual(a.u - Number.EPSILON);
        },
      ),
      { numRuns: 400 },
    );
  });
});

describe("AIR-P-22 — calibration : au moins 90 % du nuage, taille minimale, dans l'image", () => {
  const pointsArb = fc.array(
    fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })),
    { minLength: 20, maxLength: 120 },
  ).map((liste) => liste.map(([u, v]) => ({ u, v })));

  it("le rectangle obtenu contient au moins 90 % des points et respecte les bornes", () => {
    fc.assert(
      fc.property(pointsArb, (points) => {
        const rect = calibratePlayRect(points);
        if (rect === null) return; // relevé trop étroit : refus assumé
        expect(rect.u0).toBeGreaterThanOrEqual(0);
        expect(rect.u1).toBeLessThanOrEqual(1);
        expect(rect.v0).toBeGreaterThanOrEqual(0);
        expect(rect.v1).toBeLessThanOrEqual(1);
        expect(rect.u1 - rect.u0).toBeGreaterThanOrEqual(0.2 - Number.EPSILON);
        expect(rect.v1 - rect.v0).toBeGreaterThanOrEqual(0.2 - Number.EPSILON);
        const dedans = points.filter((p) => p.u >= rect.u0 && p.u <= rect.u1 && p.v >= rect.v0 && p.v <= rect.v1);
        expect(dedans.length / points.length).toBeGreaterThanOrEqual(0.9);
      }),
      { numRuns: 200 },
    );
  });
});
