/**
 * Le retard dit (cahier §5.2, AIR-F-31, 32, 33) : chaque composante, et son
 * origine. Le temps d'analyse des mains y est détaillé : moyenne et maximum
 * sur les 60 dernières images, et un petit histogramme de sa répartition
 * (§5.4). Tout ce qui est mesuré porte la mention « mesuré » ; le thread où
 * tourne l'analyse (worker, ou fil principal en repli) est dit, pour comparer
 * les deux à intervalle d'images et temps de traitement égaux.
 */
import type { JSX } from "react";
import { useSyncExternalStore } from "react";
import type { Messages } from "../i18n/index.js";
import { lireAnalyse, suivreAnalyse } from "../hooks/analysisStore.js";
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

/** Le petit histogramme : une barre par classe, hauteur proportionnelle. */
function Histogramme({ bins, max }: { readonly bins: readonly number[]; readonly max: number }): JSX.Element {
  return (
    <span
      className="analysis-histogram"
      style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 28, verticalAlign: "middle" }}
    >
      {bins.map((nombre, index) => (
        <span
          key={index}
          className="bar"
          style={{
            width: 5,
            height: `${Math.round((nombre / max) * 100)}%`,
            minHeight: nombre > 0 ? 2 : 0,
            background: "currentColor",
            opacity: 0.7,
          }}
        />
      ))}
    </span>
  );
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
  // La fenêtre glissante du temps d'analyse : publiée ~1×/s par la sonde de
  // retard (useSeanceEffects), lue ici sans horloge ni mesure supplémentaire.
  const analyse = useSyncExternalStore(suivreAnalyse, lireAnalyse, lireAnalyse);
  const { snapshot, thread } = analyse;
  const maxBin = Math.max(1, ...snapshot.bins);
  const moyenne = Math.round(snapshot.meanInferenceMs);
  const maximum = Math.round(snapshot.maxInferenceMs);
  return (
    <section className="latency" aria-label={m.latency.heading}>
      <h2>{m.latency.heading}</h2>
      <p className="line">{formatLatencyLine(parts, labels)}</p>
      {snapshot.count > 0 ? (
        <p className="analysis-detail">
          {m.latency.analysis} {moyenne} ms · max {maximum} ms ({m.common.measured})
          {thread !== null ? ` · ${thread}` : ""}
          {" "}
          <Histogramme bins={snapshot.bins} max={maxBin} />
        </p>
      ) : null}
      <p className="totals">
        {m.latency.totals(measuredTotalMs(parts), estimatedTotalMs(parts))}
      </p>
      {measurementIsPartial(parts) ? <p className="partial">{m.latency.partial}</p> : null}
      {wireless ? <p className="wireless" role="status">{m.latency.wireless}</p> : null}
    </section>
  );
}
