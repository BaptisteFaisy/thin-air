/** La sonde de retard : ce que le moteur déclare, relu une fois par seconde. */
import type { Engine } from "../lib/engine.js";
import type { LatencyParts } from "./latency.js";

export function mesurerRetard(engine: Engine | null, cameraAssumedMs: number): LatencyParts {
  const rapport = engine?.latency() ?? null;
  return {
    inferenceMs: rapport?.inferenceMs ?? 0,
    processingMs: rapport?.processingMs ?? 0,
    audioBaseMs: engine?.audioBaseMs() ?? 0,
    audioOutputMs: engine?.audioOutputMs() ?? null,
    cameraAssumedMs,
    frameIntervalMs: rapport?.frameIntervalMs ?? 0,
  };
}
