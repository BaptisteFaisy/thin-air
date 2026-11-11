import { describe, expect, it } from "vitest";
import { BELLS, CHOIR, HARP, PHANTOM } from "../state/presets.js";
import { pathFor, pluckPath, toPolyline, wavePath, WAVE_POINTS } from "./waveform.js";

describe("la courbe du son (AIR-F-53, parcours P5)", () => {
  it("chaque forme d'onde donne le nombre de points demandé", () => {
    for (const instrument of [PHANTOM, HARP, CHOIR, BELLS]) {
      expect(pathFor(instrument.sound).length).toBe(WAVE_POINTS);
    }
    expect(wavePath(PHANTOM.sound, 8).length).toBe(8);
  });

  it("les points restent dans la boîte : rien ne déborde du dessin", () => {
    for (const point of pathFor(PHANTOM.sound)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it("l'harmonique 2 du thérémine change la forme, sans la faire déborder", () => {
    const simple = wavePath({ ...PHANTOM.sound, second: 0 });
    const double = wavePath(PHANTOM.sound);
    expect(simple).not.toEqual(double);
    for (const point of double) expect(Math.abs(point.y - 0.5)).toBeLessThanOrEqual(0.5);
  });

  it("la corde pincée s'amortit : la fin est plus plate que le début", () => {
    const amortie = pluckPath(HARP.sound);
    const debut = Math.abs((amortie[1]?.y ?? 0.5) - 0.5);
    const fin = Math.abs((amortie[amortie.length - 1]?.y ?? 0.5) - 0.5);
    expect(fin).toBeLessThan(debut);
  });

  it("AIR-N-02 — la courbe est un dessin : aucun échantillon audio n'est produit", () => {
    const points = toPolyline(pathFor(CHOIR.sound), 240, 72);
    expect(points.split(" ").length).toBe(WAVE_POINTS);
    expect(points).toMatch(/^[\d.]+,[\d.]+/);
  });
});
