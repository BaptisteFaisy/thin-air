/**
 * `bench render --take <prise> --instrument <fichier> --out <dossier>` :
 * écrit `events.json`, `render.wav` et `report.json`. Aucun périphérique
 * audio, aucun haut-parleur, aucun son émis (AIR-N-02, AIR-F-49).
 */
import type { Instrument, RenderReport, Settings, Take } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export interface RenderOutOptions {
  readonly settings?: Partial<Settings>;
  readonly outDir?: string;
  /** Ne pas écrire le WAV : seulement les nombres (CI). */
  readonly noWav?: boolean;
  readonly oneHand?: boolean;
  readonly hold?: boolean;
}

export function renderTake(take: Take, instrument: Instrument, options?: RenderOutOptions): RenderReport {
  void take; void instrument; void options;
  return todo("bench.renderTake", "A4");
}

export function writeRenderOut(report: RenderReport, outDir: string, wav?: Uint8Array): string[] {
  void report; void outDir; void wav;
  return todo("bench.writeRenderOut", "A4");
}
