/**
 * Les tests de `compare` : des rapports fabriqués à la main, jamais un rendu.
 * C'est la partie du banc qui doit passer même quand le lot A5 n'a rien livré.
 */
import type { RenderReport } from "@thin-air/core";
import { describe, expect, it } from "vitest";

import { DEFAULT_TOLERANCES, compareReports, formatComparison, isConforming } from "./compare.js";

function report(overrides: Partial<RenderReport> = {}): RenderReport {
  return {
    take: "slow-rise",
    instrument: "Phantom",
    sampleRate: 48_000,
    samples: 144_000,
    durationS: 3,
    notes: [
      { t: 0, midi: 55, expectedHz: 196.0, measuredHz: 196.02, cents: 0.2 },
      { t: 0.139, midi: 57, expectedHz: 220.0, measuredHz: 219.97, cents: -0.2 },
    ],
    peakDb: -13.4,
    rmsDb: -20.5,
    maxVoices: 1,
    silenceAfterMs: 410,
    ...overrides,
  };
}

describe("compare — les tolérances de la section 13", () => {
  it("déclare conformes deux rapports identiques", () => {
    expect(compareReports(report(), report())).toEqual([]);
    expect(isConforming(compareReports(report(), report()))).toBe(true);
  });

  it("accepte la virgule flottante exactement égale", () => {
    const diffs = compareReports(report(), report());
    expect(diffs).toHaveLength(0);
  });

  it("publie les tolérances de la section 13", () => {
    expect(DEFAULT_TOLERANCES).toEqual({
      cents: 5,
      peakDb: 0.5,
      rmsDb: 0.5,
      noteTimeMs: 33,
      silenceAfterMs: 100,
    });
  });

  it("accepte une justesse à 5 centièmes de demi-ton près", () => {
    const actual = report({ notes: [{ t: 0, midi: 55, expectedHz: 196.0, measuredHz: 196.55, cents: 4.9 }] });
    const expected = report({ notes: [{ t: 0, midi: 55, expectedHz: 196.0, measuredHz: 196.0, cents: 0 }] });
    expect(compareReports(actual, expected)).toEqual([]);
  });

  it("refuse une justesse au-delà de 5 centièmes", () => {
    const actual = report({ notes: [{ t: 0, midi: 55, expectedHz: 196.0, measuredHz: 196.6, cents: 5.1 }] });
    const expected = report({ notes: [{ t: 0, midi: 55, expectedHz: 196.0, measuredHz: 196.0, cents: 0 }] });
    const diffs = compareReports(actual, expected);
    expect(diffs.map((diff) => diff.field)).toContain("notes[0].cents");
    expect(diffs.find((diff) => diff.field === "notes[0].cents")?.tolerance).toBe(5);
  });

  it("accepte un instant de note à une image près (33 ms)", () => {
    const actual = report({ notes: [{ t: 0.172, midi: 57, expectedHz: 220, measuredHz: 220, cents: 0 }] });
    const expected = report({ notes: [{ t: 0.139, midi: 57, expectedHz: 220, measuredHz: 220, cents: 0 }] });
    expect(compareReports(actual, expected)).toEqual([]);
  });

  it("refuse un instant de note à deux images", () => {
    const actual = report({ notes: [{ t: 0.205, midi: 57, expectedHz: 220, measuredHz: 220, cents: 0 }] });
    const expected = report({ notes: [{ t: 0.139, midi: 57, expectedHz: 220, measuredHz: 220, cents: 0 }] });
    const diffs = compareReports(actual, expected);
    expect(diffs.map((diff) => diff.field)).toContain("notes[0].t");
  });

  it("accepte une crête et un niveau moyen à ±0,5 dB", () => {
    const actual = report({ peakDb: -13.9, rmsDb: -20.0 });
    expect(compareReports(actual, report())).toEqual([]);
  });

  it("refuse une crête à plus de 0,5 dB", () => {
    const diffs = compareReports(report({ peakDb: -12.8 }), report());
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.field).toBe("peakDb");
    expect(diffs[0]?.unit).toBe("dB");
  });

  it("refuse un niveau moyen hors tolérance", () => {
    const diffs = compareReports(report({ rmsDb: -21.2 }), report());
    expect(diffs.map((diff) => diff.field)).toContain("rmsDb");
  });

  it("accepte un silence final à ±100 ms", () => {
    expect(compareReports(report({ silenceAfterMs: 500 }), report({ silenceAfterMs: 400 }))).toEqual([]);
  });

  it("refuse un silence final hors tolérance", () => {
    const diffs = compareReports(report({ silenceAfterMs: 520 }), report({ silenceAfterMs: 400 }));
    expect(diffs.map((diff) => diff.field)).toContain("silenceAfterMs");
  });

  it("exige le même nombre de notes", () => {
    const diffs = compareReports(report({ notes: [] }), report());
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.field).toBe("notes");
    expect(diffs[0]).toMatchObject({ expected: 2, actual: 0 });
  });

  it("exige la même hauteur, sans tolérance", () => {
    const actual = report({ notes: [{ t: 0, midi: 56, expectedHz: 196, measuredHz: 196, cents: 0 }] });
    const expected = report({ notes: [{ t: 0, midi: 55, expectedHz: 196, measuredHz: 196, cents: 0 }] });
    const diffs = compareReports(actual, expected);
    expect(diffs.map((diff) => diff.field)).toContain("notes[0].midi");
  });

  it("exige le même nombre d'échantillons, sans tolérance", () => {
    const diffs = compareReports(report({ samples: 143_999 }), report());
    expect(diffs.map((diff) => diff.field)).toEqual(["samples"]);
  });

  it("exige la même prise et le même instrument", () => {
    const diffs = compareReports(report({ take: "autre", instrument: "Harp" }), report());
    expect(diffs.map((diff) => diff.field)).toEqual(["take", "instrument"]);
  });

  it("accepte une durée à un échantillon près", () => {
    expect(compareReports(report({ durationS: 3 + 1 / 48_000 }), report())).toEqual([]);
    expect(compareReports(report({ durationS: 3.001 }), report())).toHaveLength(1);
  });

  it("exige le même nombre de voix au plus", () => {
    const diffs = compareReports(report({ maxVoices: 2 }), report());
    expect(diffs.map((diff) => diff.field)).toEqual(["maxVoices"]);
  });

  it("accepte des tolérances resserrées par l'appelant", () => {
    const actual = report({ notes: [{ t: 0, midi: 55, expectedHz: 196, measuredHz: 196.5, cents: 4 }] });
    const expected = report({ notes: [{ t: 0, midi: 55, expectedHz: 196, measuredHz: 196, cents: 0 }] });
    expect(compareReports(actual, expected, { cents: 0.5 }).map((diff) => diff.field)).toEqual(["notes[0].cents"]);
  });

  it("refuse un non-nombre, au lieu de le laisser passer", () => {
    const diffs = compareReports(report({ peakDb: Number.NaN }), report());
    expect(diffs.map((diff) => diff.field)).toEqual(["peakDb"]);
  });
});

describe("compare — le compte rendu lisible", () => {
  it("dit la conformité en une ligne", () => {
    expect(formatComparison([])).toContain("conforme");
  });

  it("donne attendu, obtenu, écart et tolérance, ligne à ligne", () => {
    const texte = formatComparison(compareReports(report({ peakDb: -12.8 }), report()));
    expect(texte).toContain("1 écart(s)");
    expect(texte).toContain("peakDb");
    expect(texte).toContain("attendu");
    expect(texte).toContain("obtenu");
    expect(texte).toContain("écart");
    expect(texte).toContain("tolérance 0,50 dB");
  });

  it("donne une ligne par écart", () => {
    const texte = formatComparison(compareReports(report({ peakDb: -12, maxVoices: 3 }), report()));
    expect(texte.split("\n")).toHaveLength(3);
  });
});
