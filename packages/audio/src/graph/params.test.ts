/**
 * Règle 1 de §7.9 : jamais un réglage fixé pendant qu'une voix sonne.
 * Le test porte sur le contrat d'un `AudioParam` : le moteur n'a pas d'autre
 * moyen d'écrire une valeur que la rampe `setTargetAtTime` (AIR-F-26).
 */
import { describe, expect, it } from "vitest";
import {
  MIN_TAU_S,
  makeCeilingCurve,
  rampParam,
  releaseTauS,
  type AudioParamLike,
} from "./params.js";

/** dB pleine échelle → amplitude linéaire (réimplémenté ici : core/music.ts est un stub du lot A3). */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

interface RampCall {
  readonly value: number;
  readonly at: number;
  readonly tau: number;
}

/** Un `AudioParam` qui n'expose QUE la rampe : impossible d'y fixer une valeur. */
class RampOnlyParam implements AudioParamLike {
  readonly calls: RampCall[] = [];

  setTargetAtTime(value: number, startTime: number, timeConstant: number): unknown {
    this.calls.push({ value, at: startTime, tau: timeConstant });
    return this;
  }
}

describe("rampParam — AIR-F-26, AIR-P-16", () => {
  it("écrit par une rampe, datée, avec τ = paramTauMs / 1000", () => {
    const param = new RampOnlyParam();
    rampParam(param, 0.5, 1.25, 0.02);
    expect(param.calls).toEqual([{ value: 0.5, at: 1.25, tau: 0.02 }]);
  });

  it("n'expose aucune écriture directe : la rampe est le seul chemin", () => {
    const param = new RampOnlyParam() as RampOnlyParam & Record<string, unknown>;
    expect(param.setValueAtTime).toBeUndefined();
    expect(param.value).toBeUndefined();
  });

  it("borne τ par le bas : une rampe nulle redevient une marche", () => {
    const param = new RampOnlyParam();
    rampParam(param, 1, 0, 0);
    expect(param.calls[0]?.tau).toBe(MIN_TAU_S);
  });

  it("ignore une valeur ou un instant non numérique (AIR-P-02)", () => {
    const param = new RampOnlyParam();
    rampParam(param, Number.NaN, 0, 0.02);
    rampParam(param, 1, Number.POSITIVE_INFINITY, 0.02);
    expect(param.calls).toHaveLength(0);
  });

  it("deux mises à jour de suite restent deux rampes, jamais une marche", () => {
    const param = new RampOnlyParam();
    const tau = 0.02;
    for (let i = 0; i < 30; i += 1) rampParam(param, i / 30, i / 30, tau);
    expect(param.calls).toHaveLength(30);
    expect(param.calls.every((call) => call.tau === tau)).toBe(true);
  });
});

describe("releaseTauS — AIR-F-24", () => {
  it("un fondu de relâchement passe aussi par une rampe", () => {
    expect(releaseTauS(0.12)).toBeCloseTo(0.04, 6);
    expect(releaseTauS(0)).toBe(MIN_TAU_S);
  });
});

describe("makeCeilingCurve — plafond du limiteur (AIR-F-28)", () => {
  it("n'écrête rien sous le plafond et écrête tout au-dessus", () => {
    const ceiling = dbToLinear(-1);
    const curve = makeCeilingCurve(ceiling, 513);
    expect(curve).toHaveLength(513);
    for (const value of curve) expect(Math.abs(value)).toBeLessThanOrEqual(ceiling + 1e-7);
    expect(Math.max(...curve)).toBeCloseTo(ceiling, 6);
    expect(Math.min(...curve)).toBeCloseTo(-ceiling, 6);
  });

  it("est paire et croissante : le plafond ne déphase pas le signal", () => {
    const curve = makeCeilingCurve(dbToLinear(-1), 257);
    const centre = 128;
    for (let i = 1; i <= centre; i += 1) {
      expect(curve[centre - i]).toBeCloseTo(-(curve[centre + i] ?? 0), 6);
    }
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i] ?? 0).toBeGreaterThanOrEqual(curve[i - 1] ?? 0);
    }
  });

  it("un plafond à 0 dB laisse passer l'unité sans l'amplifier", () => {
    const curve = makeCeilingCurve(dbToLinear(0), 129);
    expect(Math.max(...curve)).toBeCloseTo(1, 6);
  });
});

describe("l'échelle du plafond", () => {
  it("le plafond de −1 dB vaut 0,891 en amplitude (dB → linéaire)", () => {
    expect(dbToLinear(-1)).toBeCloseTo(0.8913, 4);
    expect(dbToLinear(-12)).toBeCloseTo(0.2512, 4);
  });

  it.todo("`dbToGain` et `midiToFreq` viennent de `core/music.ts` — dépend du lot A3");
});
