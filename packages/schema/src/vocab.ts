/**
 * The vocabulary of the three file formats, written once.
 *
 * Each list is pinned to the contract with `satisfies`: the compiler refuses a
 * value that is not in `packages/core/src/types.ts`, and a test refuses a list
 * that misses one. So a rule of validity has exactly one definition here, and
 * the instrument, take and session schemas share it (contract rule 4).
 */

import type {
  ControlTarget,
  FeatureName,
  GestureAction,
  GestureMap,
  GestureName,
  HandRole,
  HandSide,
  Instrument,
  InstrumentSound,
  InstrumentStrings,
  PointerKind,
  Session,
  Settings,
  SoundEngine,
  Take,
} from "@thin-air/core";

export const INSTRUMENT_FORMAT = "thin-air-instrument/1" satisfies Instrument["format"];
export const TAKE_FORMAT = "thin-air-take/1" satisfies Take["format"];
export const SESSION_FORMAT = "thin-air-session/1" satisfies Session["format"];

export const POINTERS = ["index", "palm"] as const satisfies readonly PointerKind[];
export const HAND_ROLES = ["pitch", "volume"] as const satisfies readonly HandRole[];
export const HAND_SIDES = ["left", "right"] as const satisfies readonly HandSide[];
/** A gesture map may target either role, or whichever hand is there. */
export const GESTURE_HANDS = [...HAND_ROLES, "any"] as const satisfies readonly GestureMap["hand"][];
export const FEATURES = [
  "u", "v", "pinch", "open", "speedU", "speedV",
] as const satisfies readonly FeatureName[];
export const TARGETS = ["pitch", "gain", "cutoff", "vibrato"] as const satisfies readonly ControlTarget[];
export const CURVES = ["linear", "db48"] as const satisfies readonly NonNullable<Instrument["controls"]>[number]["curve"][];
export const GESTURES = [
  "pinch", "fist", "cross", "enter", "leave", "dwell", "handLost",
] as const satisfies readonly GestureName[];
export const ACTIONS = ["pluck", "damp", "mute", "hold", "strike"] as const satisfies readonly GestureAction[];
export const VELOCITIES = ["speed", "fixed"] as const satisfies readonly NonNullable<GestureMap["velocity"]>[];
export const ENGINES = ["osc", "pluck", "fm", "drum"] as const satisfies readonly SoundEngine[];
export const WAVES = [
  "sine", "triangle", "sawtooth", "square",
] as const satisfies readonly NonNullable<InstrumentSound["wave"]>[];
export const AXES = ["u", "v"] as const satisfies readonly InstrumentStrings["axis"][];
export const BRIGHTNESS_FEATURES = [
  "u", "v",
] as const satisfies readonly NonNullable<InstrumentSound["brightness"]>["feature"][];
export const QUANTIZE = ["off", "eighth", "sixteenth"] as const satisfies readonly Settings["quantize"][];
