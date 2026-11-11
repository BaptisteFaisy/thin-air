/**
 * Filtre One Euro — tableau du cahier §7.5, cas limites §14.6, propriété
 * AIR-P-02. Tout est déterministe : graine fast-check fixe, horodatages
 * passés en argument.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_SETTINGS } from "./defaults.js";
import {
  OneEuroFilter,
  alphaFor,
  cutoffFor,
  defaultFilterOptions,
  makeDualChannel,
  timeConstantFor,
  type FilterOptions,
} from "./filter.js";

const OPTIONS: FilterOptions = defaultFilterOptions();
const TE_30 = 1 / 30;

/** Le tableau du cahier §7.5 : vitesse, coupure, constante de temps, α. */
const TABLEAU = [
  { nom: "immobile", vitesse: 0, coupure: 1.5, tauMs: 106, alpha: 0.24 },
  { nom: "une largeur de zone par seconde", vitesse: 1, coupure: 6.5, tauMs: 24, alpha: 0.58 },
  { nom: "deux largeurs par seconde", vitesse: 2, coupure: 11.5, tauMs: 14, alpha: 0.71 },
] as const;

/**
 * Modèle de référence : les formules du cahier §7.5 recopiées à plat, sans
 * le code du filtre. Sert d'oracle pour la sortie du canal lissé.
 */
function referenceSmooth(
  values: readonly number[],
  times: readonly number[],
  options: FilterOptions,
): number[] {
  const premier = values[0] ?? 0;
  const sorties: number[] = [premier];
  let sortie = premier;
  let precedent = premier;
  let dHat = 0;
  for (let i = 1; i < values.length; i++) {
    const x = values[i] as number;
    const te = (times[i] as number) - (times[i - 1] as number);
    const d = (x - precedent) / te;
    const alphaD = alphaFor(options.fcD, te);
    dHat = alphaD * d + (1 - alphaD) * dHat;
    const alpha = alphaFor(cutoffFor(options, dHat), te);
    sortie = alpha * x + (1 - alpha) * sortie;
    precedent = x;
    sorties.push(sortie);
  }
  return sorties;
}

/** Trajectoire déterministe : une traverse droite, puis un tremblement. */
function trajectoire(): { values: number[]; times: number[] } {
  const values: number[] = [];
  const times: number[] = [];
  for (let i = 0; i < 60; i++) {
    const t = i * TE_30;
    const tremblement = (i % 2 === 0 ? 1 : -1) * 0.004;
    values.push(0.2 + i * 0.01 + tremblement);
    times.push(t);
  }
  return { values, times };
}

/** Échantillons arbitraires : valeurs finies, pas de temps négatif ou nul. */
function echantillons() {
  return fc.array(
    fc.record({
      x: fc.double({ min: -1, max: 1, noNaN: true }),
      dt: fc.oneof(
        fc.constant(0),
        fc.double({ min: -0.05, max: 0, noNaN: true }),
        fc.double({ min: 0.001, max: 1, noNaN: true }),
      ),
    }),
    { minLength: 1, maxLength: 40 },
  );
}

describe("filtre — le tableau du cahier §7.5", () => {
  it.each(TABLEAU)(
    "$nom : α vaut $alpha à 30 images par seconde",
    ({ coupure, alpha }) => {
      expect(Math.abs(alphaFor(coupure, TE_30) - alpha)).toBeLessThanOrEqual(0.01);
    },
  );

  it.each(TABLEAU)(
    "$nom : la constante de temps vaut $tauMs ms à ±2 ms",
    ({ coupure, tauMs }) => {
      expect(Math.abs(timeConstantFor(coupure) * 1000 - tauMs)).toBeLessThanOrEqual(2);
    },
  );

  it.each(TABLEAU)(
    "$nom : la coupure vaut fc_min + β · |d̂|",
    ({ vitesse, coupure }) => {
      expect(cutoffFor(OPTIONS, vitesse)).toBeCloseTo(coupure, 10);
    },
  );

  it("la coupure du filtre suit la vitesse mesurée", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    for (let i = 0; i <= 30; i++) {
      // une largeur de zone traversée en une seconde
      filtre.filter(i * TE_30, i * TE_30);
    }
    expect(filtre.speed).toBeCloseTo(1, 1);
    expect(filtre.cutoffHz).toBeCloseTo(6.5, 1);
  });

  it("la sortie suit la récurrence du cahier", () => {
    const { values, times } = trajectoire();
    const filtre = new OneEuroFilter(OPTIONS);
    const obtenu = values.map((x, i) => filtre.filter(x, times[i] as number));
    const attendu = referenceSmooth(values, times, OPTIONS);
    for (let i = 0; i < obtenu.length; i++) {
      expect(obtenu[i] as number).toBeCloseTo(attendu[i] as number, 10);
    }
  });
});

describe("filtre — cas limites (cahier §14.6)", () => {
  it("première image : la sortie vaut l'entrée", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    expect(filtre.filter(0.42, 0)).toBe(0.42);
    expect(filtre.last).toBe(0.42);
  });

  it("deux images au même horodatage : ni NaN ni saut", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    filtre.filter(0.1, 0);
    const y = filtre.filter(0.9, 0);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0.1);
    expect(y).toBeLessThanOrEqual(0.9);
  });

  it("cent images au même horodatage : la sortie reste finie", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    for (let i = 0; i < 100; i++) {
      const y = filtre.filter(0.3 + i * 0.005, 0);
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(0.3);
      expect(y).toBeLessThanOrEqual(0.3 + 99 * 0.005);
    }
  });

  it("un horodatage qui recule : la sortie reste finie et bornée", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    filtre.filter(0.3, 1);
    const y = filtre.filter(0.4, 0.5);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0.3);
    expect(y).toBeLessThanOrEqual(0.4);
  });

  it("un très grand Te (onglet masqué) : la sortie rejoint l'entrée", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    filtre.filter(0.2, 0);
    const y = filtre.filter(0.9, 60);
    expect(Number.isFinite(y)).toBe(true);
    expect(Math.abs(y - 0.9)).toBeLessThan(0.005);
  });

  it("une entrée qui saute brutalement : la sortie reste bornée", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    filtre.filter(0, 0);
    const y = filtre.filter(1, TE_30);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(1);
  });

  it("un Te minuscule : la sortie reste bornée", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    filtre.filter(0.5, 0);
    const y = filtre.filter(0.9, 1e-9);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0.5);
    expect(y).toBeLessThanOrEqual(0.9);
  });

  it("reset : le filtre repart de l'entrée", () => {
    const filtre = new OneEuroFilter(OPTIONS);
    filtre.filter(0.3, 0);
    filtre.filter(0.9, TE_30);
    filtre.reset();
    expect(filtre.filter(0.42, 2 * TE_30)).toBe(0.42);
  });
});

describe("AIR-P-02 — filtre borné", () => {
  it("AIR-P-02 — la sortie reste entre le minimum et le maximum des entrées vues", () => {
    fc.assert(
      fc.property(echantillons(), (liste) => {
        const canal = makeDualChannel(OPTIONS, DEFAULT_SETTINGS.fcTrigger);
        let min = Infinity;
        let max = -Infinity;
        let t = 0;
        for (const e of liste) {
          t += e.dt;
          min = Math.min(min, e.x);
          max = Math.max(max, e.x);
          for (const filtre of [canal.smooth, canal.fast]) {
            const y = filtre.filter(e.x, t);
            expect(Number.isFinite(y)).toBe(true);
            expect(y).toBeGreaterThanOrEqual(min - 1e-9);
            expect(y).toBeLessThanOrEqual(max + 1e-9);
          }
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  it("AIR-P-02 — pour une entrée constante, la sortie converge vers elle", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.integer({ min: 1, max: 40 }),
        (c, n) => {
          const filtre = new OneEuroFilter(OPTIONS);
          let t = 0;
          for (let i = 0; i < n; i++) {
            t += TE_30;
            filtre.filter(c, t);
          }
          expect(Math.abs(filtre.last - c)).toBeLessThan(1e-9);
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });

  it("AIR-P-02 — un tremblement autour d'une valeur ne fait pas sortir la bande", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: 0, max: 0.05, noNaN: true }),
        (c, amplitude) => {
          const filtre = new OneEuroFilter(OPTIONS);
          let t = 0;
          for (let i = 0; i < 60; i++) {
            t += TE_30;
            const x = c + (i % 2 === 0 ? amplitude : -amplitude);
            const y = filtre.filter(x, t);
            expect(y).toBeGreaterThanOrEqual(c - amplitude - 1e-9);
            expect(y).toBeLessThanOrEqual(c + amplitude + 1e-9);
          }
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});

describe("les deux canaux (§7.5)", () => {
  it("le canal vif garde une coupure fixe de 6 Hz", () => {
    const canal = makeDualChannel(OPTIONS, DEFAULT_SETTINGS.fcTrigger);
    for (let i = 0; i <= 30; i++) {
      canal.smooth.filter(i * TE_30, i * TE_30);
      canal.fast.filter(i * TE_30, i * TE_30);
    }
    expect(canal.fast.cutoffHz).toBe(DEFAULT_SETTINGS.fcTrigger);
    expect(canal.smooth.cutoffHz).toBeGreaterThan(canal.fast.cutoffHz);
  });

  it.each([
    { fps: 30, errFast: 0.0443, errSmooth: 0.0538 },
    { fps: 60, errFast: 0.0614, errSmooth: 0.0687 },
  ])(
    "après un pas de 0,1, le canal vif suit l'entrée de plus près ($fps images/s)",
    ({ fps, errFast, errSmooth }) => {
      const te = 1 / fps;
      const canal = makeDualChannel(OPTIONS, DEFAULT_SETTINGS.fcTrigger);
      canal.smooth.filter(0.5, 0);
      canal.fast.filter(0.5, 0);
      const ySmooth = canal.smooth.filter(0.6, te);
      const yFast = canal.fast.filter(0.6, te);
      const erreurLisse = Math.abs(ySmooth - 0.6);
      const erreurVif = Math.abs(yFast - 0.6);
      expect(erreurVif).toBeLessThan(erreurLisse);
      expect(erreurVif).toBeCloseTo(errFast, 2);
      expect(erreurLisse).toBeCloseTo(errSmooth, 2);
    },
  );
});
