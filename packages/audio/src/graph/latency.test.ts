/**
 * Retard affiché : mesuré d'un côté, estimé de l'autre (cahier §5.1, §5.2,
 * §5.4). AIR-F-31 (affichage par composante), AIR-F-32 (sortie sans fil),
 * AIR-F-33 (vocabulaire).
 */
import { describe, expect, it } from "vitest";
import {
  computeLatencyReport,
  declaredOutputMs,
  latencyLines,
  measuredTotalMs,
  wirelessWarning,
  type LatencyParts,
} from "./latency.js";

const PARTS: LatencyParts = {
  frameIntervalMs: 33,
  inferenceMs: 12,
  processingMs: 2,
  audioBaseMs: 10,
  audioOutputMs: 21,
};

/** Les mots que le §5.4 interdit dans un libellé. */
const FORBIDDEN = [/temps réel/iu, /instant(ané)?/iu, /zéro latence/iu, /real[- ]?time/iu, /zero latency/iu];

describe("LatencyReport — la somme des parts, mesuré ou estimé", () => {
  it("additionne les parts mesurées, caméra à part (AIR-F-31)", () => {
    const report = computeLatencyReport(PARTS, 50);
    expect(report.measuredTotalMs).toBeCloseTo(33 + 12 + 2 + 10 + 21, 6);
    expect(report.estimatedTotalMs).toBeCloseTo(78 + 50, 6);
    expect(report.partial).toBe(false);
  });

  it("sans outputLatency : `null`, et la mesure est déclarée partielle", () => {
    const report = computeLatencyReport({ ...PARTS, audioOutputMs: null }, 50);
    expect(report.audioOutputMs).toBeNull();
    expect(report.partial).toBe(true);
    expect(report.measuredTotalMs).toBeCloseTo(33 + 12 + 2 + 10, 6);
  });

  it("un côté vision muet rend la mesure partielle sans mentir sur les totaux", () => {
    const report = computeLatencyReport({ ...PARTS, inferenceUnknown: true }, 50);
    expect(report.partial).toBe(true);
    expect(report.inferenceMs).toBe(0);
  });

  it("measuredTotalMs ne compte que les parts fournies", () => {
    expect(measuredTotalMs({ ...PARTS, audioOutputMs: null })).toBeCloseTo(57, 6);
  });

  it("la caméra n'est jamais comptée comme mesurée (§5.1)", () => {
    const report = computeLatencyReport(PARTS, 0);
    expect(report.measuredTotalMs).toBe(report.estimatedTotalMs);
    expect(report.cameraAssumedMs).toBe(0);
  });
});

describe("sortie audio déclarée — AIR-F-32", () => {
  it("somme baseLatency et outputLatency", () => {
    expect(declaredOutputMs(computeLatencyReport(PARTS, 50))).toBeCloseTo(31, 6);
  });

  it("au-delà de 100 ms, conseille une sortie filaire", () => {
    const report = computeLatencyReport({ ...PARTS, audioOutputMs: 150 }, 50);
    const warning = wirelessWarning(report, 100);
    expect(warning).not.toBeNull();
    expect(warning).toContain("sans fil");
    expect(warning).toContain("filaire");
  });

  it("sous le seuil, ne dit rien", () => {
    expect(wirelessWarning(computeLatencyReport(PARTS, 50), 100)).toBeNull();
  });

  it("à exactement le seuil, ne dit rien : c'est un dépassement qui compte", () => {
    const report = computeLatencyReport({ ...PARTS, audioBaseMs: 40, audioOutputMs: 60 }, 50);
    expect(wirelessWarning(report, 100)).toBeNull();
  });

  it("sans outputLatency déclaré, ne devine pas la sortie", () => {
    const report = computeLatencyReport({ ...PARTS, audioOutputMs: null }, 50);
    expect(wirelessWarning(report, 100)).toBeNull();
  });
});

describe("libellés — AIR-F-33, §5.4", () => {
  it("chaque ligne dit si elle est mesurée ou estimée", () => {
    const lines = latencyLines(computeLatencyReport(PARTS, 50));
    const measured = lines.filter((line) => line.includes("mesuré"));
    expect(measured.length).toBeGreaterThanOrEqual(4);
    expect(lines.some((line) => line.includes("estimé"))).toBe(true);
    expect(lines.at(-1)).toContain("retard estimé");
  });

  it("aucun mot interdit dans les libellés", () => {
    const variants = [
      latencyLines(computeLatencyReport(PARTS, 50)),
      latencyLines(computeLatencyReport({ ...PARTS, audioOutputMs: null }, 50)),
      latencyLines(computeLatencyReport({ ...PARTS, inferenceUnknown: true }, 50)),
    ];
    for (const lines of variants) {
      for (const line of lines) {
        for (const pattern of FORBIDDEN) expect(line).not.toMatch(pattern);
      }
    }
  });

  it("dit que la mesure est partielle quand le navigateur se tait", () => {
    const lines = latencyLines(computeLatencyReport({ ...PARTS, audioOutputMs: null }, 50));
    expect(lines.some((line) => line.includes("partielle"))).toBe(true);
  });
});
