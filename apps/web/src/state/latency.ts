/**
 * Le retard dit, composante par composante (cahier §5.2, §5.4 ; AIR-F-31, 32).
 * Chaque valeur porte son origine : mesurée dans le navigateur, ou estimée.
 * Aucune de ces fonctions ne mesure : elles mettent en forme des nombres.
 */
import type { LatencyReport } from "@thin-air/core";

/** Étalement de l'estimation caméra autour de la valeur supposée (§5.1). */
export const CAMERA_SPREAD_MS = 20;

export type SegmentKey = "analysis" | "processing" | "audioOut" | "camera";
export type SegmentOrigin = "measured" | "estimated";

export interface LatencySegment {
  readonly key: SegmentKey;
  readonly ms: number;
  /** Étendue quand la valeur n'est pas connue exactement (caméra). */
  readonly rangeMs?: readonly [number, number];
  readonly origin: SegmentOrigin;
}

/** Les nombres que l'écran reçoit d'une mesure, ou de ses propres réglages. */
export interface LatencyParts {
  readonly inferenceMs: number;
  readonly processingMs: number;
  readonly audioBaseMs: number;
  readonly audioOutputMs: number | null;
  readonly cameraAssumedMs: number;
  readonly frameIntervalMs?: number;
}

export interface LatencyLabels {
  readonly analysis: string;
  readonly processing: string;
  readonly audioOut: string;
  readonly camera: string;
  readonly measured: string;
  readonly estimated: string;
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function clamped(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * Les quatre composantes de §5.1. La sortie audio additionne le tampon déclaré
 * et, quand le navigateur le donne, le retard de la sortie elle-même.
 */
export function latencySegments(parts: LatencyParts): readonly LatencySegment[] {
  const audio = round(parts.audioBaseMs) + round(parts.audioOutputMs ?? 0);
  const camera = clamped(parts.cameraAssumedMs, 0, 120);
  const bas = Math.max(0, round(camera) - CAMERA_SPREAD_MS);
  const haut = round(camera) + CAMERA_SPREAD_MS;
  return [
    { key: "analysis", ms: round(parts.inferenceMs), origin: "measured" },
    { key: "processing", ms: round(parts.processingMs), origin: "measured" },
    { key: "audioOut", ms: audio, origin: "measured" },
    { key: "camera", ms: round(camera), rangeMs: [bas, haut], origin: "estimated" },
  ];
}

/** Le navigateur ne déclare pas `outputLatency` : la mesure est partielle. */
export function measurementIsPartial(parts: LatencyParts): boolean {
  return parts.audioOutputMs === null;
}

/** Sortie audio déclarée au-delà du seuil : conseiller une sortie filaire (AIR-F-32). */
export function needsWiredOutput(parts: LatencyParts, warnMs: number): boolean {
  const audio = round(parts.audioBaseMs) + round(parts.audioOutputMs ?? 0);
  return audio > warnMs;
}

export function measuredTotalMs(parts: LatencyParts): number {
  return latencySegments(parts)
    .filter((seg) => seg.origin === "measured")
    .reduce((somme, seg) => somme + seg.ms, 0);
}

export function estimatedTotalMs(parts: LatencyParts): number {
  return latencySegments(parts).reduce((somme, seg) => somme + seg.ms, 0);
}

/** « 30–70 ms » : valeur exacte, ou étendue séparée par un tiret demi-cadratin. */
export function formatRange(segment: LatencySegment): string {
  if (segment.rangeMs === undefined) return `${segment.ms} ms`;
  return `${segment.rangeMs[0]}–${segment.rangeMs[1]} ms`;
}

export function formatSegment(segment: LatencySegment, labels: LatencyLabels): string {
  const nom = labels[segment.key];
  const origine = segment.origin === "measured" ? labels.measured : labels.estimated;
  return `${nom} ${formatRange(segment)} (${origine})`;
}

/** Une ligne, quatre composantes, séparées par un point médian (§5.2). */
export function formatLatencyLine(parts: LatencyParts, labels: LatencyLabels): string {
  return latencySegments(parts).map((seg) => formatSegment(seg, labels)).join(" · ");
}

/** Report de `core.measure` (lot A5) vers les nombres affichés. */
export function partsFromReport(report: LatencyReport, cameraAssumedMs: number): LatencyParts {
  return {
    inferenceMs: report.inferenceMs,
    processingMs: report.processingMs,
    audioBaseMs: report.audioBaseMs,
    audioOutputMs: report.audioOutputMs,
    cameraAssumedMs,
    frameIntervalMs: report.frameIntervalMs,
  };
}

/** Le retard affiché avant toute mesure : la caméra reste celle des réglages. */
export function latencyInitiale(settings: { readonly cameraLatencyMs: number }): LatencyParts {
  return {
    inferenceMs: 0,
    processingMs: 0,
    audioBaseMs: 0,
    audioOutputMs: null,
    cameraAssumedMs: settings.cameraLatencyMs,
  };
}
