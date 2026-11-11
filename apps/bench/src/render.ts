/**
 * `bench render --take <prise> --instrument <fichier> --out <dossier>` :
 * écrit `events.json`, `render.wav` et `report.json`. Aucun périphérique
 * audio, aucun haut-parleur, aucun son émis (AIR-N-02, AIR-F-49) : les
 * échantillons sont calculés dans un tableau, puis écrits dans un fichier.
 */
import type { Instrument, MusicEvent, RenderReport, Settings, Take } from "@thin-air/core";
import { SAMPLE_RATE, buildReport, measureNotes } from "@thin-air/core";
import { join } from "node:path";

import type { RenderCallResult } from "./contracts.js";
import { loadAudio } from "./contracts.js";
import { BenchError, isUnavailableContract } from "./errors.js";
import { effectiveSettings, eventsOf } from "./events.js";
import type { EventsOptions } from "./events.js";
import { ensureDir, writeBytesFile, writeJsonFile } from "./io.js";

export interface RenderOutOptions extends EventsOptions {
  readonly outDir?: string;
  /** Ne pas écrire le WAV : seulement les nombres (CI). */
  readonly noWav?: boolean;
  /** Étiquette de la prise dans le rapport (le nom du fichier, en général). */
  readonly takeName?: string;
  readonly sampleRate?: number;
}

/** Un rendu : le rapport, les événements et les échantillons qui l'ont produit. */
export interface RenderedTake {
  readonly report: RenderReport;
  readonly events: readonly MusicEvent[];
  readonly samples: Float32Array;
  readonly sampleRate: number;
}

/** Un palier de note, tel que `measureNotes` l'attend. */
export interface NoteSpan {
  readonly t: number;
  readonly midi: number;
  readonly untilT: number;
}

/** Relaie un contrat pas encore livré en échec de calcul lisible (code 1). */
export function callOrExplain<T>(what: string, lot: string, compute: () => T): T {
  try {
    return compute();
  } catch (error) {
    if (isUnavailableContract(error)) {
      throw new BenchError(`${what} indisponible : ${String((error as Error).message)} — lot ${lot}`);
    }
    throw error;
  }
}

/** Les paliers d'un rendu : de chaque noteOn à son noteOff, sinon à la fin. */
export function noteSpans(events: readonly MusicEvent[], durationS: number): readonly NoteSpan[] {
  const spans: NoteSpan[] = [];
  events.forEach((event, index) => {
    if (event.type !== "noteOn") return;
    const off = events.findIndex(
      (other, j) => j > index && other.type === "noteOff" && other.voice === event.voice,
    );
    const until = off >= 0 ? (events[off]?.t ?? durationS) : durationS;
    spans.push({ t: event.t, midi: event.midi, untilT: Math.max(until, event.t) });
  });
  return spans;
}

async function renderSamples(
  events: readonly MusicEvent[],
  instrument: Instrument,
  settings: Settings,
  sampleRate: number,
): Promise<RenderCallResult> {
  const audio = await loadAudio();
  return callOrExplain("le rendu hors ligne", "A5", () =>
    audio.renderEvents(events, {
      instrument,
      sampleRate,
      masterGainDb: settings.masterGainDb,
      ceilingDb: settings.ceilingDb,
      reverb: settings.reverb,
      maxVoices: settings.maxVoices,
      paramTauMs: settings.paramTauMs,
    }),
  );
}

async function buildFrom(
  events: readonly MusicEvent[],
  rendered: RenderCallResult,
  instrument: Instrument,
  settings: Settings,
  takeName: string,
): Promise<RenderReport> {
  const notes = callOrExplain("la mesure des notes", "A5", () =>
    measureNotes(rendered.samples, noteSpans(events, rendered.durationS), {
      sampleRate: rendered.sampleRate,
      ceilingDb: settings.ceilingDb,
    }),
  );
  return callOrExplain("le rapport de rendu", "A5", () =>
    buildReport({
      take: takeName,
      instrument: instrument.name,
      samples: rendered.samples,
      sampleRate: rendered.sampleRate,
      notes,
      maxVoices: rendered.maxVoices,
    }),
  );
}

/** Le rendu complet : événements, échantillons, rapport. */
export async function renderedTake(
  take: Take,
  instrument: Instrument,
  options?: RenderOutOptions,
): Promise<RenderedTake> {
  const settings = effectiveSettings(instrument, options);
  const events = eventsOf(take, instrument, options);
  const sampleRate = options?.sampleRate ?? SAMPLE_RATE;
  const rendered = await renderSamples(events, instrument, settings, sampleRate);
  const report = await buildFrom(events, rendered, instrument, settings, options?.takeName ?? "prise");
  return { report, events, samples: rendered.samples, sampleRate: rendered.sampleRate };
}

/** `bench render` : le rapport seul (annexe B). */
export async function renderTake(
  take: Take,
  instrument: Instrument,
  options?: RenderOutOptions,
): Promise<RenderReport> {
  return (await renderedTake(take, instrument, options)).report;
}

/**
 * Écrit `events.json`, `render.wav` (sauf `--no-wav`) et `report.json` dans
 * `outDir`, créé s'il manque. Rend la liste des chemins écrits.
 */
export function writeRenderOut(
  report: RenderReport,
  outDir: string,
  wav?: Uint8Array,
  events?: readonly MusicEvent[],
): string[] {
  const dir = ensureDir(outDir);
  const written: string[] = [];
  if (events !== undefined) written.push(writeJsonFile(join(dir, "events.json"), events));
  if (wav !== undefined) written.push(writeBytesFile(join(dir, "render.wav"), wav));
  written.push(writeJsonFile(join(dir, "report.json"), report));
  return written;
}

/** Les octets du WAV d'un rendu (16 bits mono, AIR-F-38). */
export async function wavOf(rendered: RenderedTake): Promise<Uint8Array> {
  const audio = await loadAudio();
  return callOrExplain("l'encodage WAV", "A5", () => audio.encodeWav(rendered.samples, rendered.sampleRate));
}
