/**
 * Le jeu direct, côté Web Audio (cahier §7.9).
 *
 * Ce barillet existe pour que `packages/audio/src/index.ts` (lot A5) puisse
 * raccorder le jeu direct en une ligne : `export * from "./graph/index.js";`.
 * Le module de corde (`../worklets/pluck-processor.ts`) n'est PAS réexporté
 * ici : il est chargé par `audioWorklet.addModule()` à partir d'une URL, pas
 * importé par le site.
 */
export * from "./live.js";
export * from "./latency.js";
export * from "./params.js";
export * from "./scheduler.js";
export * from "./voices.js";
export * from "./worklet.js";
export {
  buildImpulse,
  buildLiveGraph,
  createLiveVoice,
  setMasterGain,
  setReverbAmount,
  DEFAULT_CUTOFF_HZ,
  VIBRATO_DEPTH_CENTS,
  type ControlParamName,
  type LiveGraph,
  type LiveVoice,
  type LiveVoiceOptions,
} from "./nodes.js";
