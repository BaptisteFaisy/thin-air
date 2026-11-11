/**
 * Accès aux contrats des autres lots, chargés à la demande.
 *
 * Deux raisons, toutes deux apprises ici :
 *  - `@thin-air/schema` (lot A4) lève dès le chargement tant que ses schémas
 *    sont des `todo(...)` : un import statique empêcherait `bench --help` de
 *    s'exécuter ;
 *  - `@thin-air/audio` (lot A5) importe `@thin-air/core/internal`, que l'alias
 *    de `vitest.config.ts` ne couvre pas (il n'alias que `@thin-air/core`) :
 *    un import statique ferait échouer tous les tests du banc, y compris ceux
 *    qui ne rendent rien.
 *
 * Dans les deux cas, une dépendance pas encore livrée devient un message clair
 * (code 1), jamais une trace de pile.
 */
import type { Instrument, MusicEvent, Take } from "@thin-air/core";
import type { ParseResult } from "@thin-air/schema";

import { BenchError, UsageError, isUnavailableContract } from "./errors.js";

export interface TakeSchemaModule {
  readonly parseTake: (json: unknown) => ParseResult<Take>;
}

export interface InstrumentSchemaModule {
  readonly parseInstrument: (json: unknown) => ParseResult<Instrument>;
}

export interface EncodingModule {
  readonly encodeTake: (take: Take) => Uint8Array;
}

/** Ce que le banc demande au moteur hors ligne, et rien de plus. */
export interface AudioModule {
  readonly renderEvents: (events: readonly MusicEvent[], options: RenderCallOptions) => RenderCallResult;
  readonly encodeWav: (samples: Float32Array, sampleRate: number) => Uint8Array;
}

/** Les options de `renderEvents`, telles que le contrat les déclare. */
export interface RenderCallOptions {
  readonly instrument: Instrument;
  readonly sampleRate?: number;
  readonly durationS?: number;
  readonly masterGainDb?: number;
  readonly ceilingDb?: number;
  readonly reverb?: number;
  readonly maxVoices?: number;
  readonly paramTauMs?: number;
}

export interface RenderCallResult {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly durationS: number;
  readonly maxVoices: number;
}

/** La première ligne d'un message : le détail d'une trace n'aide pas ici. */
function premiereLigne(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/** Charge un module de contrat ; son absence est dite, pas contournée. */
async function load<T>(name: string, what: string): Promise<T> {
  try {
    return (await import(name)) as T;
  } catch (error) {
    if (isUnavailableContract(error)) {
      throw new BenchError(`${what} indisponible : ${premiereLigne(error)}`);
    }
    throw error;
  }
}

export function loadTakeSchema(): Promise<TakeSchemaModule> {
  return load<TakeSchemaModule>("@thin-air/schema", "le schéma de prise (lot A4)");
}

export function loadInstrumentSchema(): Promise<InstrumentSchemaModule> {
  return load<InstrumentSchemaModule>("@thin-air/schema", "le schéma d'instrument (lot A4)");
}

export function loadEncoding(): Promise<EncodingModule> {
  return load<EncodingModule>("@thin-air/schema", "le codage compact des prises (lot A4)");
}

export function loadAudio(): Promise<AudioModule> {
  return load<AudioModule>("@thin-air/audio", "le rendu hors ligne et le WAV (lot A5)");
}

/** Refuse un fichier en entier, avec les raisons du schéma (code 2). */
export function accept<T>(result: ParseResult<T>, source: string, what: string): T {
  if (result.ok) return result.value;
  throw new UsageError(`${what} refusé : ${source}`, result.reasons.join("\n  - "));
}
