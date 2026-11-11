/**
 * La machine à états de l'écran (cahier §12.2). Une seule structure, des
 * transitions pures, aucune valeur éparse : ce que l'écran affiche se déduit
 * d'ici, et les tests n'ont besoin ni de DOM ni de caméra.
 */
import { DEFAULT_SETTINGS } from "@thin-air/core";
import { MAX_LAYERS } from "@thin-air/core";

/** Trois secondes sans main alors que l'image change (AIR-F-06). */
export const LOW_LIGHT_SECONDS = 3;
/** Six couches au plus (AIR-F-34). */
export const LOOP_CAPACITY = MAX_LAYERS;

export type Phase = "idle" | "starting" | "playing";
export type PlayMode = "camera" | "pointer";
export type CameraStatus = "before" | "requesting" | "granted" | "denied" | "absent";
export type ModelStatus = "idle" | "loading" | "ready" | "failed";
export type AudioStatus = "closed" | "running" | "suspended";
export type MidiStatus = "unknown" | "available" | "unavailable";
export type GhostStatus = "idle" | "playing";

export interface HandReading {
  readonly count: 0 | 1 | 2;
  readonly atEdge: boolean;
}

export interface UiState {
  readonly phase: Phase;
  readonly mode: PlayMode;
  readonly camera: CameraStatus;
  readonly modelStatus: ModelStatus;
  readonly modelProgress: number;
  readonly hands: HandReading;
  readonly tabHidden: boolean;
  readonly audio: AudioStatus;
  /** Retard de sortie audio déclaré par le navigateur, en ms (AIR-F-31). */
  readonly outputMs: number | null;
  readonly layers: number;
  readonly midi: MidiStatus;
  /** Raison d'un fichier d'instrument refusé, en clair (AIR-F-43). */
  readonly rejection: string | null;
  readonly ghost: GhostStatus;
}

export type UiEvent =
  | { readonly type: "start" }
  | { readonly type: "playWithoutCamera" }
  | { readonly type: "cameraGranted" }
  | { readonly type: "cameraDenied" }
  | { readonly type: "cameraAbsent" }
  | { readonly type: "modelLoading" }
  | { readonly type: "modelProgress"; readonly ratio: number }
  | { readonly type: "modelReady" }
  | { readonly type: "modelFailed" }
  | { readonly type: "hands"; readonly count: number; readonly atEdge: boolean }
  | { readonly type: "visibility"; readonly hidden: boolean }
  | { readonly type: "audio"; readonly status: AudioStatus }
  | { readonly type: "latency"; readonly outputMs: number | null }
  | { readonly type: "layers"; readonly count: number }
  | { readonly type: "midi"; readonly status: MidiStatus }
  | { readonly type: "instrumentAccepted" }
  | { readonly type: "instrumentRejected"; readonly reason: string }
  | { readonly type: "ghost"; readonly playing: boolean }
  | { readonly type: "stop" };

export function initialUiState(): UiState {
  return {
    phase: "idle",
    mode: "camera",
    camera: "before",
    modelStatus: "idle",
    modelProgress: 0,
    hands: { count: 0, atEdge: false },
    tabHidden: false,
    audio: "closed",
    outputMs: null,
    layers: 0,
    midi: "unknown",
    rejection: null,
    ghost: "idle",
  };
}

function clampCount(count: number): 0 | 1 | 2 {
  const entier = Math.trunc(Number.isFinite(count) ? count : 0);
  return entier >= 2 ? 2 : entier <= 0 ? 0 : 1;
}

function clampedRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
}

/** Le seul endroit où l'état change : une transition, un nouvel objet. */
export function reduceUi(state: UiState, event: UiEvent): UiState {
  const demarrage = reduceDemarrage(state, event);
  return demarrage ?? reduceSuivi(state, event);
}

/** Démarrage, caméra, modèle et arrêt : ce qui ouvre ou ferme la séance. */
export function reduceDemarrage(state: UiState, event: UiEvent): UiState | null {
  switch (event.type) {
    case "start":
      return { ...state, phase: "starting", mode: "camera", camera: "requesting" };
    case "playWithoutCamera":
      return {
        ...state,
        phase: "playing",
        mode: "pointer",
        camera: state.camera === "granted" ? "granted" : "denied",
      };
    case "cameraGranted":
      return { ...state, phase: "playing", mode: "camera", camera: "granted" };
    case "cameraDenied":
      return { ...state, phase: "playing", mode: "pointer", camera: "denied" };
    case "cameraAbsent":
      return { ...state, phase: "playing", mode: "pointer", camera: "absent" };
    case "modelLoading":
      return { ...state, modelStatus: "loading", modelProgress: 0 };
    case "modelProgress":
      return { ...state, modelStatus: "loading", modelProgress: clampedRatio(event.ratio) };
    case "modelReady":
      return { ...state, modelStatus: "ready", modelProgress: 1 };
    case "modelFailed":
      // Le modèle manque : le jeu continue au pointeur, avec le même moteur.
      return { ...state, modelStatus: "failed", mode: "pointer", phase: "playing" };
    case "stop":
      return { ...initialUiState(), camera: state.camera, midi: state.midi };
    default:
      return null;
  }
}

/** Ce qui se passe pendant le jeu : mains, onglet, audio, boucle, instruments. */
export function reduceSuivi(state: UiState, event: UiEvent): UiState {
  switch (event.type) {
    case "hands":
      return { ...state, hands: { count: clampCount(event.count), atEdge: event.atEdge } };
    case "visibility":
      return { ...state, tabHidden: event.hidden };
    case "audio":
      return { ...state, audio: event.status };
    case "latency":
      return { ...state, outputMs: event.outputMs };
    case "layers":
      return { ...state, layers: Math.max(0, Math.min(LOOP_CAPACITY, Math.trunc(event.count))) };
    case "midi":
      return { ...state, midi: event.status };
    case "instrumentAccepted":
      return { ...state, rejection: null };
    case "instrumentRejected":
      return { ...state, rejection: event.reason };
    case "ghost":
      return { ...state, ghost: event.playing ? "playing" : "idle" };
    default:
      return state;
  }
}

export function reduceAll(state: UiState, events: readonly UiEvent[]): UiState {
  return events.reduce(reduceUi, state);
}

export type NoticeId =
  | "cameraDenied"
  | "cameraAbsent"
  | "modelLoading"
  | "modelFailed"
  | "noHands"
  | "handAtEdge"
  | "tabHidden"
  | "audioSuspended"
  | "wirelessOutput"
  | "loopFull"
  | "midiUnavailable"
  | "instrumentRejected"
  | "ghostPlaying";

export interface NoticeOptions {
  readonly wirelessWarnMs?: number;
  readonly cameraOk?: boolean;
  readonly quiet?: boolean;
}

/**
 * Les messages à afficher, dans l'ordre d'importance. Un message par cause,
 * jamais deux fois : l'écran n'a qu'à les rendre.
 */
export function notices(state: UiState, options?: NoticeOptions): readonly NoticeId[] {
  const seams = options?.wirelessWarnMs ?? DEFAULT_SETTINGS.wirelessWarnMs;
  const cameraOk = options?.cameraOk ?? true;
  const liste: NoticeId[] = [];
  if (state.rejection !== null) liste.push("instrumentRejected");
  if (state.tabHidden) liste.push("tabHidden");
  if (state.audio === "suspended") liste.push("audioSuspended");
  if (state.camera === "denied") liste.push("cameraDenied");
  if (state.camera === "absent") liste.push("cameraAbsent");
  if (state.modelStatus === "loading") liste.push("modelLoading");
  if (state.modelStatus === "failed") liste.push("modelFailed");
  if (state.outputMs !== null && state.outputMs > seams) liste.push("wirelessOutput");
  if (state.phase === "playing" && state.hands.count === 0 && cameraOk) liste.push("noHands");
  if (options?.quiet === true && state.phase === "playing" && state.hands.count === 0) {
    liste.push("noHands");
  }
  if (state.phase === "playing" && state.hands.atEdge) liste.push("handAtEdge");
  if (state.layers >= LOOP_CAPACITY) liste.push("loopFull");
  if (state.midi === "unavailable") liste.push("midiUnavailable");
  if (state.ghost === "playing") liste.push("ghostPlaying");
  return dedupe(liste);
}

function dedupe(liste: readonly NoticeId[]): readonly NoticeId[] {
  return liste.filter((id, index) => liste.indexOf(id) === index);
}

/**
 * Faut-il relâcher toutes les voix ? Onglet masqué, moteur audio suspendu,
 * ou plus rien en cours de jeu (AIR-F-16, AIR-N-08) : aucune note ne reste.
 */
export function mustReleaseAll(state: UiState): boolean {
  if (state.phase !== "playing") return true;
  if (state.tabHidden) return true;
  return state.audio === "suspended";
}

/** Le fantôme ne joue que si aucune main n'est vue et que le jeu est en cours (AIR-F-50). */
export function ghostMayPlay(state: UiState): boolean {
  return state.phase === "playing" && state.hands.count === 0 && !state.tabHidden;
}

/** Le jeu est-il possible au pointeur à ce moment ? (AIR-F-02) */
export function pointerPlaying(state: UiState): boolean {
  return state.phase === "playing" && state.mode === "pointer";
}

/** Progression du modèle, en pourcentage entier, pour l'affichage (§12.2). */
export function modelPercent(state: UiState): number {
  return Math.round(state.modelProgress * 100);
}
