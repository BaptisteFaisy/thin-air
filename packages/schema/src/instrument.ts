/**
 * The instrument file, validated (cahier §11.4, annexe B, AIR-F-43, AIR-P-19).
 *
 * Design choices, all of them "refuse, never repair":
 * - every object is strict: an unknown key refuses the whole file, because
 *   dropping it silently would be a hidden default;
 * - the enum values are written once and pinned to the types of
 *   `@thin-air/core` with `satisfies`, so the schema cannot drift from the
 *   contract;
 * - coherence rules (scale, range, strings, zones, sound engine) refine the same
 *   schema and produce English reasons (AIR-N-14).
 */

import { z } from "zod";
import type {
  Instrument,
  InstrumentScale,
  InstrumentSound,
  InstrumentZones,
  InstrumentZone,
  SoundEngine,
} from "@thin-air/core";
import {
  deflateRaw,
  describe,
  fail,
  fromBase64Url,
  inflateRaw,
  parseWith,
  toBase64Url,
  utf8Bytes,
  utf8Text,
  type ParseResult,
} from "./common.js";
import { partialSettingsSchema } from "./settings.js";
import {
  ACTIONS,
  AXES,
  BRIGHTNESS_FEATURES,
  CURVES,
  ENGINES,
  FEATURES,
  GESTURES,
  GESTURE_HANDS,
  HAND_ROLES,
  INSTRUMENT_FORMAT,
  POINTERS,
  TARGETS,
  VELOCITIES,
  WAVES,
} from "./vocab.js";

export type { ParseOk, ParseErr, ParseResult } from "./common.js";

const number = z.number();
/** A MIDI note: a whole number the synth can actually play. */
const midi = number.int().min(0).max(127);
/** A ratio such as `snap` or `second`: 0 to 1. */
const ratio = number.min(0).max(1);
/**
 * An ordered pair of bounds, such as `from` or `into`. Exactly two finite
 * numbers; the order of the bounds is free, because the reference file of the
 * cahier §11.4 reads a descending input span: `from: [0.4, 0.1]`.
 */
const pair = z.tuple([number, number]);

const scaleSchema = z.strictObject({ root: midi, steps: z.array(number) });
const rangeSchema = z.strictObject({ low: midi, high: midi });
const stringsSchema = z.strictObject({ count: number.int().min(1), axis: z.enum(AXES) });
const zoneSchema = z.strictObject({
  id: z.string().min(1),
  u0: ratio,
  u1: ratio,
  v0: ratio,
  v1: ratio,
  midi: midi.optional(),
  degree: number.int().optional(),
});
const zonesSchema = z.strictObject({ zones: z.array(zoneSchema) });

const featureMapSchema = z.strictObject({
  hand: z.enum(HAND_ROLES).optional(),
  feature: z.enum(FEATURES),
  to: z.enum(TARGETS),
  curve: z.enum(CURVES).optional(),
  from: pair.optional(),
  into: pair.optional(),
});

const gestureMapSchema = z.strictObject({
  hand: z.enum(GESTURE_HANDS),
  gesture: z.enum(GESTURES),
  do: z.enum(ACTIONS),
  velocity: z.enum(VELOCITIES).optional(),
  value: number.optional(),
});

const brightnessSchema = z.strictObject({ feature: z.enum(BRIGHTNESS_FEATURES), into: pair });

const soundSchema = z.strictObject({
  engine: z.enum(ENGINES),
  wave: z.enum(WAVES).optional(),
  second: ratio.optional(),
  attackMs: number.min(0).optional(),
  releaseMs: number.min(0).optional(),
  glideMs: number.min(0).optional(),
  decay: ratio.optional(),
  brightness: brightnessSchema.optional(),
  fmRatio: number.positive().optional(),
  fmIndex: number.min(0).optional(),
  detuneCents: number.optional(),
  noiseMs: number.min(0).optional(),
  toneHz: number.positive().optional(),
});

/**
 * What each sound engine needs, and what belongs to another engine.
 * A missing requirement means the engine cannot make a sound at all; a field of
 * another engine means the file mixes two instruments, so it is refused rather
 * than half-read. `wave` stays optional for `osc` (the engine owns a default
 * waveform), but `second` — the amplitude of harmonic 2 — only means something
 * once a waveform is named.
 */
const ENGINE_RULES: Readonly<Record<SoundEngine, {
  readonly requires: readonly (keyof InstrumentSound)[];
  readonly forbids: readonly (keyof InstrumentSound)[];
}>> = {
  osc: { requires: [], forbids: ["decay", "fmRatio", "fmIndex", "noiseMs", "toneHz"] },
  pluck: { requires: ["decay"], forbids: ["wave", "second", "fmRatio", "fmIndex", "noiseMs", "toneHz"] },
  fm: { requires: ["fmRatio"], forbids: ["wave", "second", "decay", "noiseMs", "toneHz"] },
  drum: { requires: ["noiseMs", "toneHz"], forbids: ["wave", "second", "decay", "fmRatio", "fmIndex"] },
};

const instrumentShape = z.strictObject({
  format: z.literal(INSTRUMENT_FORMAT),
  name: z.string().min(1),
  pointer: z.enum(POINTERS),
  scale: scaleSchema,
  range: rangeSchema.optional(),
  strings: stringsSchema.optional(),
  zones: zonesSchema.optional(),
  snap: ratio,
  voices: number.int().min(1),
  controls: z.array(featureMapSchema).optional(),
  gestures: z.array(gestureMapSchema).optional(),
  oneHand: z.array(featureMapSchema).optional(),
  sound: soundSchema,
  defaults: partialSettingsSchema.optional(),
});

type Ctx = z.RefinementCtx;

function add(ctx: Ctx, path: readonly (string | number)[], message: string): void {
  ctx.addIssue({ code: "custom", path: [...path], message });
}

/** Sorted ascending and free of duplicates is the same thing as strictly increasing. */
function checkScale(scale: InstrumentScale, ctx: Ctx): void {
  const steps = scale.steps;
  if (steps.length === 0) {
    add(ctx, ["scale", "steps"], "the scale needs at least one step");
    return;
  }
  let ordered = true;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] ?? 0;
    if (!Number.isInteger(step) || step < 0 || step > 11) {
      add(ctx, ["scale", "steps", i], "a step is a whole number of semitones from 0 to 11");
    }
    if (i > 0 && step <= (steps[i - 1] ?? 0)) ordered = false;
  }
  if (!ordered) {
    add(ctx, ["scale", "steps"], "steps must be sorted ascending, without duplicates");
  }
}

function checkZone(zone: InstrumentZone, at: readonly (string | number)[], ctx: Ctx): void {
  if (zone.u0 > zone.u1) add(ctx, [...at, "u0"], "u0 must be at most u1");
  if (zone.v0 > zone.v1) add(ctx, [...at, "v0"], "v0 must be at most v1");
  const hasMidi = zone.midi !== undefined;
  const hasDegree = zone.degree !== undefined;
  if (hasMidi === hasDegree) {
    add(ctx, at, "a zone holds exactly one of midi or degree");
  }
}

function checkZones(zones: InstrumentZones, ctx: Ctx): void {
  if (zones.zones.length === 0) add(ctx, ["zones"], "a zones instrument needs at least one zone");
  const seen = new Set<string>();
  zones.zones.forEach((zone, index) => {
    const at = ["zones", "zones", index];
    if (seen.has(zone.id)) add(ctx, [...at, "id"], `zone id "${zone.id}" appears twice`);
    seen.add(zone.id);
    checkZone(zone, at, ctx);
  });
}

function checkSound(sound: InstrumentSound, ctx: Ctx): void {
  const rule = ENGINE_RULES[sound.engine];
  for (const key of rule.forbids) {
    if (sound[key] !== undefined) {
      add(ctx, ["sound", key], `"${key}" belongs to another engine than ${sound.engine}`);
    }
  }
  const present = rule.requires.filter((key) => sound[key] !== undefined);
  if (rule.requires.length > 0 && present.length === 0) {
    add(ctx, ["sound"], `engine "${sound.engine}" needs ${rule.requires.join(" or ")}`);
  }
  if (sound.second !== undefined && sound.wave === undefined) {
    add(ctx, ["sound", "second"], "harmonic 2 needs a named wave");
  }
}

function checkInstrument(instrument: z.infer<typeof instrumentShape>, ctx: Ctx): void {
  checkScale(instrument.scale, ctx);
  if (instrument.range && instrument.range.low > instrument.range.high) {
    add(ctx, ["range"], "range.low must be at most range.high");
  }
  if (!instrument.range && !instrument.strings && !instrument.zones) {
    add(ctx, [], "an instrument needs at least one of range, strings or zones");
  }
  if (instrument.zones) checkZones(instrument.zones, ctx);
  checkSound(instrument.sound, ctx);
}

/** Zod schema of the instrument file, format `thin-air-instrument/1`. */
export const instrumentSchema = instrumentShape.superRefine(checkInstrument);

/** Compile-time pin: what the schema accepts is assignable to `Instrument`. */
type InstrumentPinned = z.infer<typeof instrumentShape> extends Instrument ? true : never;
const instrumentMatchesContract: InstrumentPinned = true;
void instrumentMatchesContract;

export function parseInstrument(json: unknown): ParseResult<Instrument> {
  return parseWith(instrumentSchema, json);
}

/**
 * Writing is JSON, two-space indented: the file stays readable by hand, which
 * is the whole point of "the instrument is a file" (cahier §6.2).
 */
export function stringifyInstrument(instrument: Instrument): string {
  return `${JSON.stringify(instrument, null, 2)}\n`;
}

/**
 * Share link (AIR-F-45): the instrument fits in the fragment of an address, so
 * nothing is sent to a server (AIR-N-01).
 *
 * Layout: one marker byte, then the payload, then base64url without padding
 * (no character that a URL would need to escape).
 * - marker `0`: the payload is the JSON text. The frozen signature of
 *   `instrumentToFragment` is synchronous and `CompressionStream` is
 *   asynchronous, so the synchronous flavour is the documented no-compression
 *   fallback. A Phantom instrument weighs about 1 KB this way, still short
 *   enough for a fragment.
 * - marker `1`: the payload is `deflate-raw` of the JSON text, written by
 *   `instrumentToFragmentAsync` when the runtime has `CompressionStream`
 *   (Node 22+ and every targeted browser), and read back by
 *   `instrumentFromFragmentAsync`.
 */
const FRAGMENT_RAW = 0;
const FRAGMENT_DEFLATE = 1;

function wrap(marker: number, payload: Uint8Array): string {
  const bytes = new Uint8Array(payload.length + 1);
  bytes[0] = marker;
  bytes.set(payload, 1);
  return toBase64Url(bytes);
}

export function instrumentToFragment(instrument: Instrument): string {
  return wrap(FRAGMENT_RAW, utf8Bytes(JSON.stringify(instrument)));
}

export function instrumentFromFragment(fragment: string): ParseResult<Instrument> {
  const bytes = fromBase64Url(fragment);
  if (bytes === null || bytes.length === 0) return fail("fragment: not a base64url payload, or empty");
  const marker = bytes[0] ?? -1;
  const payload = bytes.subarray(1);
  if (marker === FRAGMENT_DEFLATE) {
    return fail("fragment: compressed, read it with instrumentFromFragmentAsync");
  }
  if (marker !== FRAGMENT_RAW) return fail(`fragment: unknown marker ${marker}`);
  let json: unknown;
  try {
    json = JSON.parse(utf8Text(payload));
  } catch (error) {
    return fail(`fragment: not JSON (${describe(error)})`);
  }
  return parseInstrument(json);
}

/** Native `deflate-raw` when the runtime has it, raw JSON otherwise. */
export async function instrumentToFragmentAsync(instrument: Instrument): Promise<string> {
  const json = utf8Bytes(JSON.stringify(instrument));
  const compressed = await deflateRaw(json);
  return compressed === null ? wrap(FRAGMENT_RAW, json) : wrap(FRAGMENT_DEFLATE, compressed);
}

export async function instrumentFromFragmentAsync(fragment: string): Promise<ParseResult<Instrument>> {
  const bytes = fromBase64Url(fragment);
  if (bytes === null || bytes.length === 0) return fail("fragment: not a base64url payload, or empty");
  const marker = bytes[0] ?? -1;
  const payload = bytes.subarray(1);
  if (marker !== FRAGMENT_RAW && marker !== FRAGMENT_DEFLATE) {
    return fail(`fragment: unknown marker ${marker}`);
  }
  if (marker === FRAGMENT_RAW) return instrumentFromFragment(fragment);
  const inflated = await inflateRaw(payload);
  if (inflated === null) return fail("fragment: compressed and this runtime has no DecompressionStream");
  let json: unknown;
  try {
    json = JSON.parse(utf8Text(inflated));
  } catch (error) {
    return fail(`fragment: not JSON (${describe(error)})`);
  }
  return parseInstrument(json);
}

/** Both markers, for the callers that only ever hold the sync reader. */
export function isCompressedFragment(fragment: string): boolean {
  const bytes = fromBase64Url(fragment);
  return bytes !== null && bytes[0] === FRAGMENT_DEFLATE;
}
