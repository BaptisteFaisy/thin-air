/**
 * Compact coding of a take: 16-bit integers, no external dependency
 * (cahier §7.11, AIR-P-20).
 *
 * Layout, little-endian:
 *
 * | offset | size | field |
 * |---|---|---|
 * | 0 | 4 | magic `TAK1` |
 * | 4 | 1 | version, `1` |
 * | 5 | 1 | mode, `0` (reserved, must stay zero) |
 * | 6 | 2 | reserved, must stay zero |
 * | 8 | 8 | `fps`, float64 |
 * | 16 | 4 | frame count, uint32 |
 * | 20 | 4 | CRC-32 of every other byte |
 * | 24 | … | frames |
 *
 * A frame is `t` (float64), a hand count (uint8), then per hand a side
 * (uint8: 0 left, 1 right), a score (uint16) and 21 points of 3 uint16.
 *
 * Coding step (AIR-P-20). x and y are normalised in the image, so they are
 * quantised over [0, 1] on 16 bits: step 1/65535 ≈ 1.53e-5, i.e. about one
 * hundredth of a pixel on a 1080p frame. z is the depth relative to the wrist,
 * quantised over [-1, 1]: step 2/65535 ≈ 3.05e-5. A value outside its span is
 * clamped, which is the documented limit of the codec; the round-trip property
 * is proved inside the span, where real points live.
 *
 * An altered file is refused, never half-read: magic, version, reserved bytes,
 * `fps`, the declared frame count against the real length, trailing bytes, and
 * a CRC-32 over every other byte — one flipped byte changes the checksum.
 */

import type { DetectedHand, HandPoint, HandSide, Take, TakeFrame } from "@thin-air/core";
import { fail, ok, type ParseResult } from "./common.js";
import { HAND_SIDES, TAKE_FORMAT } from "./vocab.js";

export const MAGIC_TEXT = "TAK1";
export const CODEC_VERSION = 1;
export const POINTS_PER_HAND = 21;
const COORDS_PER_POINT = 3;
const UINT16_MAX = 0xffff;
export const HEADER_BYTES = 24;
const CRC_OFFSET = 20;
const TIME_BYTES = 8;
/** side (1) + score (2) + 21 points × 3 coords × 2 bytes. */
export const HAND_BYTES = 1 + 2 + POINTS_PER_HAND * COORDS_PER_POINT * 2;
const FRAME_HEAD_BYTES = TIME_BYTES + 1;

/** The coding steps, in the units of the data (normalised image, metres). */
export const CODING_STEP_XY = 1 / UINT16_MAX;
export const CODING_STEP_Z = 2 / UINT16_MAX;
export const CODING_STEP_SCORE = 1 / UINT16_MAX;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE) of every byte except the checksum field itself. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    if (i >= CRC_OFFSET && i < CRC_OFFSET + 4) continue;
    c = (CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function quantize(value: number, min: number, max: number): number {
  return Math.round(clamp((value - min) / (max - min), 0, 1) * UINT16_MAX);
}

function expand(code: number, min: number, max: number): number {
  return min + (code / UINT16_MAX) * (max - min);
}

function writePoint(view: DataView, at: number, point: HandPoint): number {
  view.setUint16(at, quantize(point[0] ?? 0, 0, 1), true);
  view.setUint16(at + 2, quantize(point[1] ?? 0, 0, 1), true);
  view.setUint16(at + 4, quantize(point[2] ?? 0, -1, 1), true);
  return at + COORDS_PER_POINT * 2;
}

function writeHand(view: DataView, at: number, hand: DetectedHand): number {
  view.setUint8(at, hand.side === "left" ? 0 : 1);
  view.setUint16(at + 1, quantize(hand.score, 0, 1), true);
  let next = at + 3;
  for (const point of hand.points) next = writePoint(view, next, point);
  return next;
}

function writeHeader(view: DataView, take: Take, frameCount: number): void {
  for (let i = 0; i < MAGIC_TEXT.length; i++) view.setUint8(i, MAGIC_TEXT.charCodeAt(i));
  view.setUint8(4, CODEC_VERSION);
  view.setUint8(5, 0);
  view.setUint16(6, 0, true);
  view.setFloat64(8, take.fps, true);
  view.setUint32(16, frameCount, true);
}

export function encodeTake(take: Take): Uint8Array {
  let size = HEADER_BYTES + take.frames.length * FRAME_HEAD_BYTES;
  for (const frame of take.frames) size += frame.hands.length * HAND_BYTES;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  writeHeader(view, take, take.frames.length);
  let at = HEADER_BYTES;
  for (const frame of take.frames) {
    view.setFloat64(at, frame.t, true);
    view.setUint8(at + TIME_BYTES, frame.hands.length);
    at += FRAME_HEAD_BYTES;
    for (const hand of frame.hands) at = writeHand(view, at, hand);
  }
  view.setUint32(CRC_OFFSET, crc32(bytes), true);
  return bytes;
}

function readHeader(bytes: Uint8Array, view: DataView): ParseResult<{ fps: number; frameCount: number }> {
  if (bytes.byteLength < HEADER_BYTES) {
    return fail(`take: ${bytes.byteLength} bytes, the header alone needs ${HEADER_BYTES}`);
  }
  const magic = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3),
  );
  if (magic !== MAGIC_TEXT) return fail(`take: magic "${magic}" is not "${MAGIC_TEXT}"`);
  const version = view.getUint8(4);
  if (version !== CODEC_VERSION) return fail(`take: version ${version} is not ${CODEC_VERSION}`);
  if (view.getUint8(5) !== 0 || view.getUint16(6, true) !== 0) {
    return fail("take: reserved header bytes are not zero");
  }
  const fps = view.getFloat64(8, true);
  if (!Number.isFinite(fps) || fps <= 0) return fail(`take: fps ${fps} is not a positive number`);
  if (view.getUint32(CRC_OFFSET, true) !== crc32(bytes)) {
    return fail("take: checksum mismatch — the file is altered");
  }
  return ok({ fps, frameCount: view.getUint32(16, true) });
}

function readHand(view: DataView, at: number): { hand: DetectedHand; next: number } | null {
  const code = view.getUint8(at);
  const side: HandSide | undefined = HAND_SIDES[code];
  if (side === undefined) return null;
  const points: HandPoint[] = [];
  let next = at + 3;
  for (let p = 0; p < POINTS_PER_HAND; p++) {
    points.push([
      expand(view.getUint16(next, true), 0, 1),
      expand(view.getUint16(next + 2, true), 0, 1),
      expand(view.getUint16(next + 4, true), -1, 1),
    ]);
    next += COORDS_PER_POINT * 2;
  }
  return { hand: { side, score: expand(view.getUint16(at + 1, true), 0, 1), points }, next };
}

function readFrames(bytes: Uint8Array, view: DataView, header: { fps: number; frameCount: number }): ParseResult<Take> {
  const frames: TakeFrame[] = [];
  let at = HEADER_BYTES;
  for (let index = 0; index < header.frameCount; index++) {
    if (at + FRAME_HEAD_BYTES > bytes.byteLength) return fail(`take: frame ${index} is truncated`);
    const t = view.getFloat64(at, true);
    if (!Number.isFinite(t) || t < 0) return fail(`take: frame ${index} has time ${t}`);
    const handCount = view.getUint8(at + TIME_BYTES);
    at += FRAME_HEAD_BYTES;
    const hands: DetectedHand[] = [];
    for (let h = 0; h < handCount; h++) {
      if (at + HAND_BYTES > bytes.byteLength) return fail(`take: hand ${h} of frame ${index} is truncated`);
      const read = readHand(view, at);
      if (read === null) return fail(`take: hand ${h} of frame ${index} has an unknown side code`);
      hands.push(read.hand);
      at = read.next;
    }
    frames.push({ t, hands });
  }
  if (at !== bytes.byteLength) return fail(`take: ${bytes.byteLength - at} trailing bytes after the last frame`);
  return ok({ format: TAKE_FORMAT, fps: header.fps, frames });
}

export function decodeTake(bytes: Uint8Array): ParseResult<Take> {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const header = readHeader(bytes, view);
    if (!header.ok) return header;
    return readFrames(bytes, view, header.value);
  } catch (error) {
    return fail(`take: unreadable binary file (${error instanceof Error ? error.message : String(error)})`);
  }
}
