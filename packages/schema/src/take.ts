/**
 * The take file, validated (cahier §7.11, annexe B, AIR-F-43, AIR-F-47, AIR-P-20).
 *
 * A take is the stream of hand points, never an image (AIR-N-01). Two readings
 * of the same rule set, from one definition:
 * - `takeShapeSchema` says which fields may exist and of which kind they are;
 *   `assertTakePrivacy` uses it alone, so a file carrying an image, a base64
 *   thumbnail or any other field is refused as a whole;
 * - `takeSchema` adds the coherence of a recording: a positive frame rate and
 *   frame times that never go back.
 *
 * Frame times are required to be non-decreasing, not strictly increasing: the
 * cahier calls them "croissant", and a frame repeated at the same time is a
 * legitimate artefact of a stalled camera, while a frame going back in time is
 * not. `t` and `fps` stay real numbers (a camera reports 29.97), points stay
 * finite — `z.number()` refuses NaN and ±Infinity.
 */

import { z } from "zod";
import type { Take } from "@thin-air/core";
import { fail, numberSchema, ok, parseWith, utf8Bytes, type ParseResult } from "./common.js";
import { encodeTake, POINTS_PER_HAND } from "./take-codec.js";
import { HAND_SIDES, TAKE_FORMAT } from "./vocab.js";

export {
  CODEC_VERSION,
  CODING_STEP_SCORE,
  CODING_STEP_XY,
  CODING_STEP_Z,
  decodeTake,
  encodeTake,
  HAND_BYTES,
  HEADER_BYTES,
  MAGIC_TEXT,
  POINTS_PER_HAND,
} from "./take-codec.js";

/** One hand point: three finite numbers, x and y in the image, z from the wrist. */
const pointSchema = z.tuple([numberSchema, numberSchema, numberSchema]);

const handSchema = z.strictObject({
  side: z.enum(HAND_SIDES),
  score: numberSchema.min(0).max(1),
  points: z.array(pointSchema).length(POINTS_PER_HAND),
});

const frameSchema = z.strictObject({
  t: numberSchema.min(0),
  hands: z.array(handSchema),
});

/** The shape a take may have, and nothing else. This is the privacy rule. */
export const takeShapeSchema = z.strictObject({
  format: z.literal(TAKE_FORMAT),
  fps: numberSchema.positive(),
  frames: z.array(frameSchema),
});

const MAX_REPORTED_FRAMES = 5;

function checkFrameTimes(take: z.infer<typeof takeShapeSchema>, ctx: z.RefinementCtx): void {
  let reported = 0;
  for (let i = 1; i < take.frames.length && reported < MAX_REPORTED_FRAMES; i++) {
    const previous = take.frames[i - 1]?.t ?? 0;
    const current = take.frames[i]?.t ?? 0;
    if (current < previous) {
      ctx.addIssue({
        code: "custom",
        path: ["frames", i, "t"],
        message: `frame time ${current} goes back before ${previous}`,
      });
      reported += 1;
    }
  }
}

/** Zod schema of the take file, format `thin-air-take/1`. */
export const takeSchema = takeShapeSchema.superRefine(checkFrameTimes);

type TakePinned = z.infer<typeof takeShapeSchema> extends Take ? true : never;
const takeMatchesContract: TakePinned = true;
void takeMatchesContract;

export function parseTake(json: unknown): ParseResult<Take> {
  return parseWith(takeSchema, json);
}

/**
 * A take holds times, sides, scores and points — nothing else. No image, no
 * base64 payload, no thumbnail (AIR-F-47, cahier §7.11). The check is the shape
 * schema, so the reason names the offending field.
 */
export function assertTakePrivacy(json: unknown): ParseResult<true> {
  const shape = parseWith(takeShapeSchema, json);
  if (!shape.ok) return fail(...shape.reasons.map((reason) => `privacy: ${reason}`));
  return ok(true);
}

/**
 * Weight in bytes per second, raw JSON or compact coding (cahier §7.11: about
 * 26 kB/s and 7.6 kB/s for two hands at 30 frames per second). The duration is
 * the frame count over the frame rate; an empty take weighs nothing.
 */
export function takeBytesPerSecond(take: Take, encoded: boolean): number {
  const seconds = take.fps > 0 ? take.frames.length / take.fps : 0;
  if (seconds <= 0) return 0;
  const bytes = encoded
    ? encodeTake(take).byteLength
    : utf8Bytes(JSON.stringify(take)).byteLength;
  return bytes / seconds;
}
