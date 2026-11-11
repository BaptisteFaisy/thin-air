/**
 * The session file, validated (cahier §7.10, §11.5, AIR-F-43).
 *
 * A session is a loop: a tempo, a length in bars, layers of musical events and
 * the settings of the player. It never holds a take and never holds sound: the
 * events are the seam of §11.3, so the schema is built on that union and on the
 * settings shape of `settings.ts` — one definition each.
 *
 * Coherence rules, refused rather than repaired:
 * - at most six layers, because the player draws six (cahier §7.10);
 * - layer ids are unique, so removing "the last layer" is unambiguous;
 * - `bars` and `beatsPerBar` are at least 1, `tempo` is positive;
 * - a note is a MIDI note with a velocity from 0 to 1, and a control names one
 *   of the four parameters of the seam.
 */

import { z } from "zod";
import type { Session } from "@thin-air/core";
import { numberSchema, parseWith, type ParseResult } from "./common.js";
import { settingsSchema } from "./settings.js";
import { SESSION_FORMAT, TARGETS } from "./vocab.js";

/** The player draws six layers at most (cahier §7.10). */
export const MAX_LAYERS = 6;

const midi = numberSchema.int().min(0).max(127);
const velocity = numberSchema.min(0).max(1);
const voice = z.string().min(1);
const time = numberSchema.min(0);

const noteOnSchema = z.strictObject({
  type: z.literal("noteOn"),
  t: time,
  voice,
  midi,
  velocity,
});
const noteOffSchema = z.strictObject({ type: z.literal("noteOff"), t: time, voice });
const controlSchema = z.strictObject({
  type: z.literal("control"),
  t: time,
  voice,
  param: z.enum(TARGETS),
  value: numberSchema,
});

/** The seam of §11.3: three kinds of event, told apart by `type`. */
export const musicEventSchema = z.discriminatedUnion("type", [
  noteOnSchema,
  noteOffSchema,
  controlSchema,
]);

const layerSchema = z.strictObject({
  id: numberSchema.int().nonnegative(),
  instrument: z.string().min(1),
  events: z.array(musicEventSchema),
  muted: z.boolean(),
});

const sessionShape = z.strictObject({
  format: z.literal(SESSION_FORMAT),
  tempo: numberSchema.positive(),
  bars: numberSchema.int().min(1),
  beatsPerBar: numberSchema.int().min(1),
  layers: z.array(layerSchema).max(MAX_LAYERS),
  settings: settingsSchema,
});

function checkSession(session: z.infer<typeof sessionShape>, ctx: z.RefinementCtx): void {
  const seen = new Set<number>();
  session.layers.forEach((layer, index) => {
    if (seen.has(layer.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["layers", index, "id"],
        message: `layer id ${layer.id} appears twice`,
      });
    }
    seen.add(layer.id);
  });
}

/** Zod schema of the session file, format `thin-air-session/1`. */
export const sessionSchema = sessionShape.superRefine(checkSession);

type SessionPinned = z.infer<typeof sessionShape> extends Session ? true : never;
const sessionMatchesContract: SessionPinned = true;
void sessionMatchesContract;

export function parseSession(json: unknown): ParseResult<Session> {
  return parseWith(sessionSchema, json);
}

export function stringifySession(session: Session): string {
  return `${JSON.stringify(session, null, 2)}\n`;
}
