/**
 * Common helpers for `@thin-air/schema` (cahier §11.4, AIR-F-43, AIR-N-14).
 *
 * Rules kept here, once, and used by every schema of the package:
 * - a file is either valid as a whole or refused as a whole, with reasons;
 * - reasons are human-readable English (the interface is English, AIR-N-14);
 * - nothing is ever repaired silently: objects are strict, no `.default()`.
 */

import { z } from "zod";

export interface ParseOk<T> {
  readonly ok: true;
  readonly value: T;
}
export interface ParseErr {
  readonly ok: false;
  readonly reasons: readonly string[];
}
export type ParseResult<T> = ParseOk<T> | ParseErr;

/** A successful read: the value is exactly what the schema produced. */
export function ok<T>(value: T): ParseOk<T> {
  return { ok: true, value };
}

/** A refused file: at least one reason, always (never an empty list). */
export function fail<T>(...reasons: string[]): ParseErr {
  return { ok: false, reasons: reasons.length > 0 ? reasons : ["invalid file"] };
}

type Issue = {
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly code?: string;
  readonly keys?: readonly string[];
};

/** `"frames.0.hands.1": …` — a path a human can find in the file. */
export function pathOf(path: readonly PropertyKey[]): string {
  return path.length === 0 ? "(root)" : path.join(".");
}

function formatUnrecognizedKeys(issue: Issue): string[] {
  const base = pathOf(issue.path);
  return (issue.keys ?? []).map(
    (key) => `${base === "(root)" ? key : `${base}.${key}`}: unexpected field — refused as a whole`,
  );
}

/** One Zod issue → one or more readable reasons. */
export function formatIssue(issue: Issue): string[] {
  if (issue.code === "unrecognized_keys") return formatUnrecognizedKeys(issue);
  return [`${pathOf(issue.path)}: ${issue.message}`];
}

export function reasonsOf(error: z.ZodError): string[] {
  return error.issues.flatMap(formatIssue);
}

/**
 * The single way a file enters this package: `safeParse` plus a net that
 * turns any unexpected throw into a refusal (AIR-P-19: no escaping exception).
 */
export function parseWith<T>(schema: z.ZodType<T, unknown>, json: unknown): ParseResult<T> {
  try {
    const result = schema.safeParse(json);
    if (result.success) return ok(result.data);
    return fail(...reasonsOf(result.error));
  } catch (error) {
    return fail(`(root): unhandled failure while reading the file (${describe(error)})`);
  }
}

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `z.number()` already refuses NaN and ±Infinity (Zod 4); this is the doc. */
export const numberSchema = z.number();

/** UTF-8 bytes, no Node-only API: works in Node and in the browser. */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8Bytes(text: string): Uint8Array {
  return encoder.encode(text);
}

export function utf8Text(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64RANK: Record<string, number> = {};
for (let i = 0; i < BASE64URL.length; i++) BASE64RANK[BASE64URL[i]!] = i;

/** base64url without padding: safe inside a URL fragment (AIR-F-45). */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64URL[b0 >> 2]! + BASE64URL[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]!;
    if (b1 !== undefined) out += BASE64URL[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]!;
    if (b2 !== undefined) out += BASE64URL[b2 & 63]!;
  }
  return out;
}

/** `null` when the text is not base64url: a truncated fragment is refused. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    const c0 = BASE64RANK[text[i]!];
    const c1 = BASE64RANK[text[i + 1]!] ?? 0;
    const c2 = BASE64RANK[text[i + 2]!];
    const c3 = BASE64RANK[text[i + 3]!];
    if (c0 === undefined || c1 === undefined) return null;
    if ((c2 === undefined) !== (i + 2 >= text.length)) return null;
    if ((c3 === undefined) !== (i + 3 >= text.length)) return null;
    bytes[at++] = (c0 << 2) | (c1 >> 4);
    if (c2 !== undefined) bytes[at++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 !== undefined && c2 !== undefined) bytes[at++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.subarray(0, at);
}

/**
 * Native compression when the runtime has it (Node 22+, browsers), and no
 * compression otherwise. `CompressionStream` is asynchronous, so the fragment
 * API comes in a sync flavour (raw, always available) and an async one.
 */
function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  // A plain ArrayBuffer copy: `Blob` wants a buffer no other view shares.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer]).stream();
}

/**
 * One place for the cast the DOM typings force on us: `CompressionStream` is
 * typed over `BufferSource`, `ReadableStream.pipeThrough` wants byte chunks.
 */
function pipeBytes(source: ReadableStream<Uint8Array>, transform: unknown): ReadableStream<Uint8Array> {
  return source.pipeThrough(transform as never) as ReadableStream<Uint8Array>;
}

export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = pipeBytes(streamOf(bytes), new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** `null` when the payload was compressed but no decoder is available. */
export async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = pipeBytes(streamOf(bytes), new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}
