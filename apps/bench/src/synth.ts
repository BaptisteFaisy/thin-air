/** `bench synth <forme> [paramètres]` : fabrique une prise de synthèse. */
import type { Take } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export type SynthShape = "line" | "tremor" | "sweep" | "leave" | "cross" | "left-only" | "jab";

export function synthTake(shape: SynthShape, args?: Record<string, number | string>): Take {
  void shape; void args;
  return todo("bench.synthTake", "A4");
}
