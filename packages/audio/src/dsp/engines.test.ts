import { describe, expect, it } from "vitest";
import { buildWaveTable, makeNoise, pluckDelayLength, pluckExcitation } from "./engines.js";

describe("moteurs — briques déterministes (cahier §7.8, §7.9)", () => {
  it("la longueur de la ligne à retard fixe la note : 326,9 échantillons pour ré 146,83 Hz", () => {
    const longueur = pluckDelayLength(146.83, 48_000);
    expect(longueur).toBeCloseTo(326.9, 1);
    expect(longueur).toBe(48_000 / 146.83);
  });

  it("la longueur de la ligne est proportionnelle à la fréquence", () => {
    expect(pluckDelayLength(293.66, 48_000)).toBeCloseTo(163.45, 1);
    expect(pluckDelayLength(146.83, 44_100)).toBeCloseTo(300.35, 1);
  });

  it("la table d'ondes porte l'harmonique 2 d'amplitude `second`", () => {
    const table = buildWaveTable("sine", 0.25, 64);
    const pure = buildWaveTable("sine", 0, 64);
    // À la phase 1/8 l'harmonique 2 est à son maximum : elle remonte la valeur.
    expect(table[8]).toBeCloseTo((Math.SQRT1_2 + 0.25) / 1.25, 5);
    expect(pure[8]).toBeCloseTo(Math.SQRT1_2, 5);
    // À la phase 1/4 l'harmonique 2 s'annule : il ne reste que la fondamentale.
    expect(table[16]).toBeCloseTo(1 / 1.25, 5);
    expect(pure[16]).toBeCloseTo(1, 5);
    expect(Math.max(...Array.from(table))).toBeLessThanOrEqual(1.0001);
  });

  it("les trois autres formes d'onde sont pures et bornées", () => {
    for (const onde of ["triangle", "sawtooth", "square"] as const) {
      const table = buildWaveTable(onde, 0.5, 128);
      const maxi = Math.max(...Array.from(table));
      const mini = Math.min(...Array.from(table));
      expect(maxi).toBeLessThanOrEqual(1.0001);
      expect(mini).toBeGreaterThanOrEqual(-1.0001);
    }
  });

  it("le bruit est à graine : deux tirages identiques, deux graines différentes", () => {
    const a = makeNoise(42);
    const b = makeNoise(42);
    const c = makeNoise(43);
    const suiteA = Array.from({ length: 16 }, () => a());
    const suiteB = Array.from({ length: 16 }, () => b());
    const suiteC = Array.from({ length: 16 }, () => c());
    expect(suiteA).toEqual(suiteB);
    expect(suiteA).not.toEqual(suiteC);
    for (const valeur of suiteA) {
      expect(valeur).toBeGreaterThanOrEqual(-1);
      expect(valeur).toBeLessThan(1);
    }
  });

  it("l'excitation d'une corde est déterministe et de la bonne longueur", () => {
    const une = pluckExcitation(326, 7);
    const deux = pluckExcitation(326, 7);
    expect(une).toHaveLength(326);
    expect(Array.from(une)).toEqual(Array.from(deux));
    expect(pluckExcitation(0, 7)).toHaveLength(0);
  });
});
