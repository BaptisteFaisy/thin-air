/**
 * Share link for a take (cahier §7.11, AIR-F-45 model, AIR-F-47, AIR-F-48).
 *
 * Same layout as the instrument fragment, but on a different marker and a
 * different payload: a take is a thousand times heavier than an instrument, so
 * the payload is not JSON — it reuses the 16-bit binary coding of
 * `take-codec.ts` (`encodeTake` / `decodeTake`, with its CRC-32). The fragment
 * stays short and carries the points and nothing else: no image, ever
 * (§7.11, AIR-N-01).
 *
 * Layout: one marker byte, then the payload, then base64url without padding
 * (no character a URL needs to escape, AIR-F-45).
 * - marker `2`: the payload is `encodeTake(take)` — the synchronous flavour, a
 *   documented no-compression fallback because `CompressionStream` is
 *   asynchronous (same reason the instrument fragment has a raw marker).
 * - marker `3`: the payload is `deflate-raw` of `encodeTake(take)`, written by
 *   `takeToFragmentAsync` when the runtime has `CompressionStream` and read by
 *   `takeFromFragmentAsync`.
 *
 * The instrument fragment owns markers `0` and `1`; take fragments start at
 * `2` in the other direction, so the two kinds can never collide: each reader
 * refuses the other's marker with a readable reason (language English,
 * AIR-N-14). A take fragment is never accepted as an instrument and
 * reciprocally.
 */

import type { Take } from "@thin-air/core";
import {
  deflateRaw,
  fail,
  fromBase64Url,
  inflateRaw,
  toBase64Url,
  type ParseErr,
  type ParseResult,
} from "./common.js";
import { decodeTake, encodeTake } from "./take-codec.js";

const TAKE_FRAGMENT_RAW = 2;
const TAKE_FRAGMENT_DEFLATE = 3;
const INSTRUMENT_RAW = 0;
const INSTRUMENT_DEFLATE = 1;

type UnwrappedFragment =
  | { readonly ok: true; readonly marker: number; readonly payload: Uint8Array }
  | ParseErr;

function unwrap(fragment: string): UnwrappedFragment {
  const bytes = fromBase64Url(fragment);
  if (bytes === null || bytes.length === 0) {
    return fail("fragment: not a base64url payload, or empty");
  }
  return { ok: true, marker: bytes[0] ?? -1, payload: bytes.subarray(1) };
}

/** Markers `0` and `1` belong to the instrument fragment; `3` is the async. */
function refuseWrongMarker(marker: number): ParseResult<never> {
  if (marker === INSTRUMENT_RAW || marker === INSTRUMENT_DEFLATE) {
    const reader = marker === INSTRUMENT_DEFLATE ? "instrumentFromFragmentAsync" : "instrumentFromFragment";
    return fail(`fragment: marker ${marker} is an instrument fragment (AIR-F-45), not a take — read it with ${reader}`);
  }
  if (marker === TAKE_FRAGMENT_DEFLATE) {
    return fail("fragment: compressed take, read it with takeFromFragmentAsync");
  }
  return fail(`fragment: unknown marker ${marker}`);
}

/**
 * One marker byte then the payload, base64url without padding. The same
 * `wrap` lives, private, in `instrument.ts`; the contract forbids touching
 * that file, so the four-line layout is stated here once, not imported.
 */
function wrap(marker: number, payload: Uint8Array): string {
  const bytes = new Uint8Array(payload.length + 1);
  bytes[0] = marker;
  bytes.set(payload, 1);
  return toBase64Url(bytes);
}

/** Synchronous, uncompressed fragment: the documented no-compression fallback. */
export function takeToFragment(take: Take): string {
  return wrap(TAKE_FRAGMENT_RAW, encodeTake(take));
}

export function takeFromFragment(fragment: string): ParseResult<Take> {
  const lu = unwrap(fragment);
  if (!lu.ok) return lu;
  if (lu.marker !== TAKE_FRAGMENT_RAW) return refuseWrongMarker(lu.marker);
  return decodeTake(lu.payload);
}

/** Native `deflate-raw` when the runtime has it, raw binary otherwise. */
export async function takeToFragmentAsync(take: Take): Promise<string> {
  const bytes = encodeTake(take);
  const compressed = await deflateRaw(bytes);
  return compressed === null ? wrap(TAKE_FRAGMENT_RAW, bytes) : wrap(TAKE_FRAGMENT_DEFLATE, compressed);
}

export async function takeFromFragmentAsync(fragment: string): Promise<ParseResult<Take>> {
  const lu = unwrap(fragment);
  if (!lu.ok) return lu;
  if (lu.marker === TAKE_FRAGMENT_RAW) return decodeTake(lu.payload);
  if (lu.marker !== TAKE_FRAGMENT_DEFLATE) return refuseWrongMarker(lu.marker);
  const inflated = await inflateRaw(lu.payload);
  if (inflated === null) return fail("fragment: compressed and this runtime has no DecompressionStream");
  return decodeTake(inflated);
}