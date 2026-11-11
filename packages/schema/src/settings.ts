/**
 * The settings of the cahier §7.13, as a schema.
 *
 * `DEFAULT_SETTINGS` stays the only place holding the *values* (core rule 4);
 * this file holds the *shape* and is pinned to it by a test, so a setting added
 * or renamed in core makes the schema package fail instead of drifting.
 *
 * Objects are strict: an unknown setting is a refused file, never a field that
 * is silently dropped (AIR-F-43).
 */

import { z } from "zod";
import type { Settings } from "@thin-air/core";
import { numberSchema } from "./common.js";
import { QUANTIZE } from "./vocab.js";

const positiveNumber = numberSchema.positive();
const wholeNumber = numberSchema.int().nonnegative();
const ratio = numberSchema.min(0).max(1);

export const settingsShape = {
  frameRateIdeal: positiveNumber,
  numHands: wholeNumber,
  graceMs: numberSchema.min(0),
  fcMin: positiveNumber,
  beta: numberSchema.min(0),
  fcD: positiveNumber,
  fcTrigger: positiveNumber,
  pinchOn: ratio,
  pinchOff: ratio,
  fistOn: ratio,
  fistOff: ratio,
  zoneMargin: ratio,
  noteHysteresis: ratio,
  stringRearmMs: numberSchema.min(0),
  minPluckSpeed: numberSchema.min(0),
  paramTauMs: numberSchema.min(0),
  lookaheadMs: numberSchema.min(0),
  maxVoices: wholeNumber,
  masterGainDb: numberSchema,
  ceilingDb: numberSchema,
  cameraLatencyMs: numberSchema.min(0),
  tempo: positiveNumber,
  loopBars: wholeNumber,
  beatsPerBar: wholeNumber,
  dwellMs: numberSchema.min(0),
  wirelessWarnMs: numberSchema.min(0),
  stallReleaseMs: numberSchema.min(0),
  /** `null` means "use the instrument's own magnet" (cahier §7.13). */
  magnet: ratio.nullable(),
  leftHanded: z.boolean(),
  oneHand: z.boolean(),
  hold: z.boolean(),
  reverb: ratio,
  quantize: z.enum(QUANTIZE),
  quantizeStrength: ratio,
  showCamera: z.boolean(),
};

/** The full settings object, as stored inside a session file. */
export const settingsSchema = z.strictObject(settingsShape);

/**
 * The same shape with every key optional, for `instrument.defaults`. Built from
 * the one shape above (`.partial()` keeps the object strict), so the two cannot
 * drift apart.
 */
export const partialSettingsSchema = settingsSchema.partial();

/** Compile-time pin: the schema output is exactly `Settings`. */
type SettingsInferred = z.infer<typeof settingsSchema>;
type SettingsMatches = SettingsInferred extends Settings
  ? Settings extends SettingsInferred
    ? true
    : never
  : never;
const settingsPinned: SettingsMatches = true;
void settingsPinned;
