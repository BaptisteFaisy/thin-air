/** Le retard dit (cahier §5.2, AIR-F-31, 32, 33) : chaque composante, et son origine. */
import type { JSX } from "react";
import type { Messages } from "../i18n/index.js";
import {
  formatLatencyLine,
  measurementIsPartial,
  measuredTotalMs,
  estimatedTotalMs,
  type LatencyParts,
} from "../state/latency.js";

export interface LatencyReadoutProps {
  readonly m: Messages;
  readonly parts: LatencyParts;
  readonly wireless: boolean;
}

export function LatencyReadout({ m, parts, wireless }: LatencyReadoutProps): JSX.Element {
  const labels = {
    analysis: m.latency.analysis,
    processing: m.latency.processing,
    audioOut: m.latency.audioOut,
    camera: m.latency.camera,
    measured: m.common.measured,
    estimated: m.common.estimated,
  };
  return (
    <section className="latency" aria-label={m.latency.heading}>
      <h2>{m.latency.heading}</h2>
      <p className="line">{formatLatencyLine(parts, labels)}</p>
      <p className="totals">
        {m.latency.totals(measuredTotalMs(parts), estimatedTotalMs(parts))}
      </p>
      {measurementIsPartial(parts) ? <p className="partial">{m.latency.partial}</p> : null}
      {wireless ? <p className="wireless" role="status">{m.latency.wireless}</p> : null}
    </section>
  );
}
