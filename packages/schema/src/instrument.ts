import type { Instrument } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

/** Schéma Zod du fichier d'instrument, format `thin-air-instrument/1`. */
export const instrumentSchema: unknown = todo("schema.instrumentSchema", "A4");

export interface ParseOk<T> {
  readonly ok: true;
  readonly value: T;
}
export interface ParseErr {
  readonly ok: false;
  readonly reasons: readonly string[];
}
export type ParseResult<T> = ParseOk<T> | ParseErr;

export function parseInstrument(json: unknown): ParseResult<Instrument> {
  void json;
  return todo("schema.parseInstrument", "A4");
}

export function stringifyInstrument(instrument: Instrument): string {
  void instrument;
  return todo("schema.stringifyInstrument", "A4");
}

/** L'instrument tient dans le fragment d'une adresse (AIR-F-45). */
export function instrumentToFragment(instrument: Instrument): string {
  void instrument;
  return todo("schema.instrumentToFragment", "A4");
}

export function instrumentFromFragment(fragment: string): ParseResult<Instrument> {
  void fragment;
  return todo("schema.instrumentFromFragment", "A4");
}
