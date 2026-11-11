/**
 * Plafond (AIR-F-28, AIR-P-13) : la sortie ne dépasse jamais `ceilingDb`.
 * Hors ligne, un limiteur à fenêtre ; en direct, un compresseur réglé en
 * limiteur puis le même plafond.
 */
import { todo } from "@thin-air/core/internal";

export function applyCeiling(samples: Float32Array, ceilingDb: number): void {
  void samples; void ceilingDb;
  todo("audio.applyCeiling", "A4");
}

export function applyMasterGain(samples: Float32Array, gainDb: number): void {
  void samples; void gainDb;
  todo("audio.applyMasterGain", "A4");
}
