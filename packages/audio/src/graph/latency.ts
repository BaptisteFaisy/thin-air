/**
 * Le retard affiché, composante par composante (cahier §5.1, §5.2, §5.4,
 * AIR-F-31, AIR-F-32). Ce qui est mesuré est distingué de ce qui est estimé :
 * la caméra ne se mesure pas dans un navigateur, elle est estimée.
 *
 * Vocabulaire imposé (§5.4) : jamais « temps réel », « instantané »,
 * « zéro latence » dans un libellé.
 */
import type { LatencyReport } from "@thin-air/core";

/** Les parts du retard, en ms. `null` = le navigateur ne peut pas la déclarer. */
export interface LatencyParts {
  /** Intervalle entre deux images analysées (mesuré). */
  readonly frameIntervalMs: number;
  /** Analyse des mains (mesuré côté vision ; 0 si le côté vision ne le donne pas). */
  readonly inferenceMs: number;
  /** Filtrage, gestes, correspondance (mesuré). */
  readonly processingMs: number;
  /** `AudioContext.baseLatency` (mesuré). */
  readonly audioBaseMs: number;
  /** `AudioContext.outputLatency` (mesuré s'il existe, sinon `null`). */
  readonly audioOutputMs: number | null;
  /** `true` si le côté vision ne donne pas son temps d'analyse. */
  readonly inferenceUnknown?: boolean;
}

/** Temps d'analyse retenu : zéro quand le côté vision ne le déclare pas. */
export function knownInferenceMs(parts: LatencyParts): number {
  return parts.inferenceUnknown === true ? 0 : parts.inferenceMs;
}

/** Somme des parts mesurées, la sortie audio non déclarée comptant pour zéro. */
export function measuredTotalMs(parts: LatencyParts): number {
  return (
    parts.frameIntervalMs +
    knownInferenceMs(parts) +
    parts.processingMs +
    parts.audioBaseMs +
    (parts.audioOutputMs ?? 0)
  );
}

/** Assemble le rapport : ce qui est mesuré, ce qui est estimé (§5.1). */
export function computeLatencyReport(parts: LatencyParts, cameraAssumedMs: number): LatencyReport {
  const measured = measuredTotalMs(parts);
  return {
    frameIntervalMs: parts.frameIntervalMs,
    inferenceMs: knownInferenceMs(parts),
    processingMs: parts.processingMs,
    audioBaseMs: parts.audioBaseMs,
    audioOutputMs: parts.audioOutputMs,
    cameraAssumedMs,
    measuredTotalMs: measured,
    estimatedTotalMs: measured + cameraAssumedMs,
    partial: parts.audioOutputMs === null || parts.inferenceUnknown === true,
  };
}

/**
 * Sortie audio déclarée : la somme des deux valeurs du navigateur (§7.9).
 * `null` quand le navigateur ne déclare pas `outputLatency` : on ne peut alors
 * rien affirmer sur la sortie (mesure partielle).
 */
export function declaredOutputMs(report: LatencyReport): number | null {
  if (report.audioOutputMs === null) return null;
  return report.audioBaseMs + report.audioOutputMs;
}

/**
 * AIR-F-32 : si la sortie audio déclarée dépasse `wirelessWarnMs` (100 ms),
 * conseiller une sortie filaire. Aucun mot du §5.4 n'apparaît ici.
 */
export function wirelessWarning(report: LatencyReport, wirelessWarnMs: number): string | null {
  const declared = declaredOutputMs(report);
  if (declared === null) return null;
  if (declared <= wirelessWarnMs) return null;
  return "Sortie audio probablement sans fil : une sortie filaire est conseillée.";
}

/** Les lignes du panneau de retard (§5.2) : mesuré d'abord, estimé ensuite. */
export function latencyLines(report: LatencyReport): readonly string[] {
  const lines = [
    `images ${report.frameIntervalMs.toFixed(1)} ms (mesuré)`,
    `analyse ${report.inferenceMs.toFixed(1)} ms (mesuré)`,
    `traitement ${report.processingMs.toFixed(1)} ms (mesuré)`,
    `sortie audio ${declaredOutputText(report)} (${
      report.audioOutputMs === null ? "partiellement mesuré" : "mesuré"
    })`,
    `caméra ${report.cameraAssumedMs.toFixed(0)} ms (estimé, non mesurable)`,
    `retard estimé ${report.estimatedTotalMs.toFixed(0)} ms`,
  ];
  if (report.partial) lines.push("mesure partielle : le navigateur ne déclare pas toute la sortie audio");
  return lines;
}

function declaredOutputText(report: LatencyReport): string {
  const declared = declaredOutputMs(report);
  return declared === null ? `${report.audioBaseMs.toFixed(1)} ms déclarées` : `${declared.toFixed(1)} ms`;
}
