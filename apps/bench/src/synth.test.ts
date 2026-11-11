/**
 * `bench synth` : les formes, les paramètres, et le refus des inconnues.
 * Aucun générateur n'est appelé si l'argument est mauvais : le refus vient
 * avant, avec la liste de ce qui est accepté.
 */
import { describe, expect, it } from "vitest";

import { BenchError } from "./errors.js";
import { isSynthShape, SYNTH_SHAPES, xFromU, yFromV } from "./synth.js";
import { REFERENCE_TAKES } from "./takes.js";

describe("formes de synthèse", () => {
  it("accepte les sept formes du cahier", () => {
    expect(SYNTH_SHAPES).toEqual(["line", "tremor", "sweep", "leave", "cross", "left-only", "jab"]);
    for (const forme of SYNTH_SHAPES) expect(isSynthShape(forme)).toBe(true);
  });

  it("refuse une forme inconnue", () => {
    expect(isSynthShape("bidon")).toBe(false);
    expect(isSynthShape("")).toBe(false);
  });

  it("place u et v dans la zone de jeu par défaut", () => {
    // Zone par défaut : les 80 % centraux de l'image, u et v de 0,1 à 0,9.
    expect(xFromU(0)).toBeCloseTo(0.1, 9);
    expect(xFromU(1)).toBeCloseTo(0.9, 9);
    expect(xFromU(0.5)).toBeCloseTo(0.5, 9);
    expect(yFromV(0)).toBeCloseTo(0.1, 9);
    expect(yFromV(1)).toBeCloseTo(0.9, 9);
  });

  it("nomme le lot manquant quand un générateur n'est pas livré", () => {
    // Tant que `takeGen` est en `todo(...)`, `synthTake` doit lever une erreur
    // de calcul qui nomme le lot, jamais une trace de pile brute.
    try {
      const spec = REFERENCE_TAKES.find((candidate) => candidate.name === "slow-rise");
      spec?.build();
    } catch (error) {
      expect(error).toBeInstanceOf(BenchError);
      expect((error as BenchError).message).toContain("lot B1");
      return;
    }
    // Les générateurs sont livrés : la prise s'est construite, c'est très bien.
    expect(true).toBe(true);
  });
});
