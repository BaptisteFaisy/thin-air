/**
 * La calibration (cahier §7.4, AIR-F-09, écran §12.1) : consigne, décompte,
 * relevé, rectangle obtenu, « recommencer ». Le calcul du rectangle est celui
 * du lot A1 (`core.space.calibratePlayRect`), déjà écrit : rien n'est recopié.
 */
import {
  calibratePlayRect,
  defaultPlayRect,
  type CalibrationSample,
  type PlayRect,
} from "@thin-air/core";

export const COUNTDOWN_S = 3;
export const RECORD_S = 5;

export type CalibrationPhase = "idle" | "instructions" | "countdown" | "recording" | "result" | "failed";

export interface CalibrationState {
  readonly phase: CalibrationPhase;
  /** Secondes restantes avant le relevé. */
  readonly remainingS: number;
  readonly samples: readonly CalibrationSample[];
  readonly rect: PlayRect | null;
  readonly stored: PlayRect;
}

export function idleCalibration(stored?: PlayRect): CalibrationState {
  return {
    phase: "idle",
    remainingS: COUNTDOWN_S,
    samples: [],
    rect: null,
    stored: stored ?? defaultPlayRect(),
  };
}

export function beginCalibration(state: CalibrationState): CalibrationState {
  return { ...state, phase: "instructions", samples: [], rect: null, remainingS: COUNTDOWN_S };
}

export function startCountdown(state: CalibrationState): CalibrationState {
  if (state.phase !== "instructions") return state;
  return { ...state, phase: "countdown", remainingS: COUNTDOWN_S };
}

/** Une seconde écoulée : décompte, puis relevé, puis fin automatique. */
export function tickCalibration(state: CalibrationState): CalibrationState {
  if (state.phase === "countdown") {
    const reste = state.remainingS - 1;
    return reste <= 0 ? { ...state, phase: "recording", remainingS: RECORD_S } : { ...state, remainingS: reste };
  }
  if (state.phase === "recording") {
    const reste = state.remainingS - 1;
    return reste <= 0 ? finishCalibration(state) : { ...state, remainingS: reste };
  }
  return state;
}

/** Un point de main pendant le relevé ; ignoré en dehors. */
export function sampleCalibration(state: CalibrationState, sample: CalibrationSample): CalibrationState {
  if (state.phase !== "recording") return state;
  return { ...state, samples: [...state.samples, sample] };
}

/**
 * Fin du relevé : le rectangle est déduit par `core.space`. Un relevé trop
 * petit rend `null` : l'écran propose de recommencer ou de garder la zone
 * par défaut (AIR-F-09).
 */
export function finishCalibration(state: CalibrationState, calibratedAt = Date.now()): CalibrationState {
  const rect = calibratePlayRect(state.samples, { calibratedAt });
  if (rect === null) return { ...state, phase: "failed", rect: null };
  return { ...state, phase: "result", rect };
}

/** « Garder la zone par défaut » après un relevé trop petit. */
export function keepDefault(state: CalibrationState): CalibrationState {
  const parDefaut = defaultPlayRect();
  return { ...state, phase: "result", rect: parDefaut, stored: parDefaut };
}

/** « Recommencer » : on repart de la consigne, sans perdre la zone enregistrée. */
export function restartCalibration(state: CalibrationState): CalibrationState {
  return beginCalibration({ ...state, stored: state.rect ?? state.stored });
}

export function cancelCalibration(state: CalibrationState): CalibrationState {
  return idleCalibration(state.rect ?? state.stored);
}

/** Ce que l'écran conserve sur l'appareil. */
export function storedRect(state: CalibrationState): PlayRect {
  return state.rect ?? state.stored;
}

/** La consigne est-elle en cours ? (le canevas dessine alors la zone visée) */
export function isCalibrating(state: CalibrationState): boolean {
  return state.phase === "countdown" || state.phase === "recording";
}
