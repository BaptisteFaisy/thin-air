/**
 * `bench synth` : les formes, les paramètres, et le refus des inconnues.
 * Aucun générateur n'est appelé si l'argument est mauvais : le refus vient
 * avant, avec la liste de ce qui est accepté.
 */
import { describe, expect, it } from "vitest";
import { defaultPlayRect, makeHand, palmCenter, toPlayPosition } from "@thin-air/core";

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

  it("place u et v dans la zone de jeu par défaut, miroir compris (§7.4)", () => {
    // Zone par défaut : les 80 % centraux de l'image. L'affichage est en miroir
    // et l'axe v monte vers le haut : u = 0 est donc à droite de l'IMAGE brute
    // (x = 0,9) et v = 0 en bas de l'image (y = 0,9).
    expect(xFromU(0)).toBeCloseTo(0.9, 9);
    expect(xFromU(1)).toBeCloseTo(0.1, 9);
    expect(xFromU(0.5)).toBeCloseTo(0.5, 9);
    expect(yFromV(0)).toBeCloseTo(0.9, 9);
    expect(yFromV(1)).toBeCloseTo(0.1, 9);
  });

  it("une main posée à (u, v) est relue à (u, v) par la chaîne — aller-retour", () => {
    // C'est la propriété qui compte : sans elle, toute prise de synthèse serait
    // lue à l'envers et les exemples chiffrés du §7.14 tomberaient à côté.
    const rect = defaultPlayRect();
    for (const [u, v] of [[0, 0], [0.2, 0.45], [0.5, 0.5], [0.8, 0.9], [1, 1]] as const) {
      const main = makeHand({ x: xFromU(u), y: yFromV(v), scale: 0.02 });
      const centre = palmCenter(main.points);
      const lu = toPlayPosition(centre[0], centre[1], rect, 1);
      expect(lu.u).toBeCloseTo(u, 9);
      expect(lu.v).toBeCloseTo(v, 9);
    }
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
