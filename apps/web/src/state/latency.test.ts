import { describe, expect, it } from "vitest";
import {
  CAMERA_SPREAD_MS,
  formatLatencyLine,
  formatRange,
  latencySegments,
  measurementIsPartial,
  measuredTotalMs,
  estimatedTotalMs,
  needsWiredOutput,
  partsFromReport,
  type LatencyLabels,
  type LatencyParts,
} from "./latency.js";

const etiquettes: LatencyLabels = {
  analysis: "analysis",
  processing: "processing",
  audioOut: "audio out",
  camera: "camera",
  measured: "measured",
  estimated: "estimated",
};

const filaire: LatencyParts = {
  inferenceMs: 12,
  processingMs: 2,
  audioBaseMs: 21,
  audioOutputMs: 0,
  cameraAssumedMs: 50,
};

describe("retard par composante (AIR-F-31)", () => {
  it("AIR-F-31 — chaque composante porte son origine", () => {
    const segments = latencySegments(filaire);
    expect(segments.map((s) => s.key)).toEqual(["analysis", "processing", "audioOut", "camera"]);
    expect(segments.map((s) => s.origin)).toEqual([
      "measured",
      "measured",
      "measured",
      "estimated",
    ]);
  });

  it("AIR-F-31 — la ligne d'exemple du cahier se reconstitue", () => {
    expect(formatLatencyLine(filaire, etiquettes)).toBe(
      "analysis 12 ms (measured) · processing 2 ms (measured) · audio out 21 ms (measured) · camera 30–70 ms (estimated)",
    );
  });

  it("AIR-F-31 — la caméra s'annonce comme une étendue, jamais comme une mesure", () => {
    const camera = latencySegments(filaire)[3];
    expect(camera?.rangeMs).toEqual([50 - CAMERA_SPREAD_MS, 50 + CAMERA_SPREAD_MS]);
    expect(camera === undefined ? "" : formatRange(camera)).toBe("30–70 ms");
  });

  it("AIR-F-31 — l'étendue caméra ne descend pas sous zéro", () => {
    const bas = latencySegments({ ...filaire, cameraAssumedMs: 5 })[3];
    expect(bas?.rangeMs?.[0]).toBe(0);
  });

  it("AIR-F-31 — la sortie audio additionne tampon et sortie déclarés", () => {
    const segments = latencySegments({ ...filaire, audioBaseMs: 10, audioOutputMs: 21 });
    expect(segments[2]?.ms).toBe(31);
  });

  it("AIR-F-31 — sans `outputLatency`, la mesure est dite partielle", () => {
    const partiel = { ...filaire, audioOutputMs: null };
    expect(measurementIsPartial(partiel)).toBe(true);
    expect(measurementIsPartial(filaire)).toBe(false);
    expect(latencySegments(partiel)[2]?.ms).toBe(21);
  });

  it("AIR-F-31 — les totaux séparent mesuré et estimé", () => {
    expect(measuredTotalMs(filaire)).toBe(35);
    expect(estimatedTotalMs(filaire)).toBe(85);
  });

  it("AIR-F-32 — une sortie déclarée au-delà du seuil demande le filaire", () => {
    expect(needsWiredOutput({ ...filaire, audioOutputMs: 120 }, 100)).toBe(true);
    expect(needsWiredOutput({ ...filaire, audioOutputMs: 60 }, 100)).toBe(false);
  });

  it("AIR-F-32 — le seuil vient des réglages, pas d'une constante recopiée", () => {
    expect(needsWiredOutput({ ...filaire, audioBaseMs: 90 }, 80)).toBe(true);
    expect(needsWiredOutput({ ...filaire, audioBaseMs: 90 }, 150)).toBe(false);
  });

  it("mise en forme — les valeurs non finies tombent à zéro, sans exception", () => {
    const segments = latencySegments({ ...filaire, inferenceMs: Number.NaN, cameraAssumedMs: Number.POSITIVE_INFINITY });
    expect(segments[0]?.ms).toBe(0);
    expect(segments[3]?.ms).toBe(0);
  });

  it("report de mesure — les champs de `LatencyReport` gardent leur origine", () => {
    const parts = partsFromReport(
      {
        frameIntervalMs: 17,
        inferenceMs: 9,
        processingMs: 3,
        audioBaseMs: 12,
        audioOutputMs: null,
        cameraAssumedMs: 0,
        measuredTotalMs: 24,
        estimatedTotalMs: 24,
        partial: true,
      },
      50,
    );
    expect(parts.cameraAssumedMs).toBe(50);
    expect(measurementIsPartial(parts)).toBe(true);
    expect(parts.frameIntervalMs).toBe(17);
  });
});
