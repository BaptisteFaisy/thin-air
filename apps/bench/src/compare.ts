/**
 * `bench compare <rapport> <référence>` : tolérances de la section 13.
 * Code de sortie non nul en cas d'écart — c'est ce que regarde la CI.
 */
import type { RenderReport } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export interface Tolerances {
  /** 5 centièmes de demi-ton (cahier §7.14). */
  readonly cents?: number;
  readonly peakDb?: number;
  readonly rmsDb?: number;
  /** Une image près, soit 33 ms à 30 images/s. */
  readonly noteTimeMs?: number;
  readonly silenceAfterMs?: number;
}

export interface ComparisonDiff {
  readonly field: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly tolerance?: number;
}

export function compareReports(
  actual: RenderReport,
  expected: RenderReport,
  tolerances?: Tolerances,
): readonly ComparisonDiff[] {
  void actual; void expected; void tolerances;
  return todo("bench.compareReports", "A4");
}
