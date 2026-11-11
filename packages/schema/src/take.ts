import type { Take } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";
import type { ParseResult } from "./instrument.js";

export const takeSchema: unknown = todo("schema.takeSchema", "A4");

export function parseTake(json: unknown): ParseResult<Take> {
  void json;
  return todo("schema.parseTake", "A4");
}

/**
 * Codage compact : entiers de 16 bits (7,6 Ko/s contre 26 Ko/s en JSON brut,
 * cahier §7.11). Coder puis décoder conserve les points au pas de codage près.
 */
export function encodeTake(take: Take): Uint8Array {
  void take;
  return todo("schema.encodeTake", "A4");
}

export function decodeTake(bytes: Uint8Array): ParseResult<Take> {
  void bytes;
  return todo("schema.decodeTake", "A4");
}

/** Une prise ne contient que des instants, des côtés, des scores et des points. */
export function assertTakePrivacy(json: unknown): ParseResult<true> {
  void json;
  return todo("schema.assertTakePrivacy", "A4");
}

/** Poids en octets par seconde ; le garde `take-privacy-guard` s'en sert. */
export function takeBytesPerSecond(take: Take, encoded: boolean): number {
  void take; void encoded;
  return todo("schema.takeBytesPerSecond", "A4");
}
