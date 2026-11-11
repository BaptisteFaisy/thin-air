import type { PlayRect, Settings } from "./types.js";

/** Réglages par défaut du cahier §7.13. Aucune valeur ne vit ailleurs. */
export const DEFAULT_SETTINGS: Settings = {
  frameRateIdeal: 60,
  numHands: 2,
  graceMs: 150,
  fcMin: 1.5,
  beta: 5,
  fcD: 1,
  fcTrigger: 6,
  pinchOn: 0.25,
  pinchOff: 0.4,
  fistOn: 0.2,
  fistOff: 0.35,
  zoneMargin: 0.1,
  noteHysteresis: 0.15,
  stringRearmMs: 80,
  minPluckSpeed: 0.15,
  paramTauMs: 20,
  lookaheadMs: 5,
  maxVoices: 8,
  masterGainDb: -12,
  ceilingDb: -1,
  cameraLatencyMs: 50,
  tempo: 90,
  loopBars: 4,
  beatsPerBar: 4,
  dwellMs: 400,
  wirelessWarnMs: 100,
  stallReleaseMs: 300,
  magnet: null,
  leftHanded: false,
  oneHand: false,
  hold: false,
  reverb: 0.25,
  quantize: "off",
  quantizeStrength: 0,
  showCamera: false,
};

/** Zone par défaut : les 80 % centraux de l'image (AIR-F-08). */
export function defaultPlayRect(): PlayRect {
  return { u0: 0.1, u1: 0.9, v0: 0.1, v1: 0.9, calibratedAt: null };
}

export function withSettings(partial: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
}

/** Fréquence d'échantillonnage de référence du rendu hors ligne. */
export const SAMPLE_RATE = 48_000;
