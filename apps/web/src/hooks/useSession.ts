/**
 * Le démarrage et le suivi (AIR-F-01, 02 ; parcours P1, P2, P6). La caméra, le
 * modèle de mains et le moteur audio sont demandés ici, après le clic, et
 * jamais avant. Les modules des autres lots sont chargés à la demande : tant
 * qu'un corps manque, le jeu bascule au pointeur avec un message clair, et
 * aucune note ne reste en cours (AIR-F-16).
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import { toPlayPosition, type DetectedHand, type HandRole, type Instrument, type PlayRect, type Settings } from "@thin-air/core";
import { DEFAULT_SETTINGS, defaultPlayRect } from "@thin-air/core";
import { reduceUi, initialUiState, type UiEvent, type UiState } from "../state/machine.js";
import { createEngine, type Engine } from "../lib/engine.js";
import type { CameraSource } from "@thin-air/vision";
import type { HandInput } from "../scene/geometry.js";
import { pousserAnalyse, reinitialiserAnalyse } from "./analysisStore.js";

/**
 * Chemin du modèle et de ses fichiers d'exécution, RELATIFS à la racine du
 * site : `import.meta.env.BASE_URL` vaut `/thin-air/` sur GitHub Pages et `/`
 * en développement. Un chemin absolu casserait la page publiée (§11.9).
 */
const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
/** La racine du site, avec sa barre finale : sers aussi au service worker (`lib/offline.ts`). */
export const RACINE_SITE = base;
export const MODEL_URL = `${base}models/hand_landmarker.task`;
export const WASM_ROOT = `${base}models/wasm`;

export interface SessionApi {
  readonly rectRef: { current: PlayRect };
  readonly state: UiState;
  readonly dispatch: (event: UiEvent) => void;
  readonly videoRef: { readonly current: HTMLVideoElement | null };
  readonly handsRef: { readonly current: readonly HandInput[] };
  /** Les mains telles que le modèle les donne : c'est ce que lit le suivi. */
  readonly detectedRef: { readonly current: readonly DetectedHand[] };
  readonly engineRef: { readonly current: Engine | null };
  readonly startCamera: () => Promise<void>;
  readonly startPointer: () => Promise<void>;
  readonly stop: () => void;
  readonly resumeAudio: () => Promise<void>;
  readonly setInstrument: (instrument: Instrument) => void;
  readonly setSettings: (settings: Settings) => void;
}

export function useSession(
  instrument: Instrument,
  settings: Settings,
  onEvents: (events: readonly import("@thin-air/core").MusicEvent[]) => void,
): SessionApi {
  const [state, dispatch] = useReducer(reduceUi, undefined, initialUiState);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<readonly HandInput[]>([]);
  const detectedRef = useRef<readonly DetectedHand[]>([]);
  const engineRef = useRef<Engine | null>(null);
  const sourceRef = useRef<{ stop: () => void } | null>(null);
  const rectRef = useRef<PlayRect>(defaultPlayRect());
  const instrumentRef = useRef(instrument);
  const settingsRef = useRef(settings);
  instrumentRef.current = instrument;
  settingsRef.current = settings;

  const ouvrirMoteur = useCallback(async () => {
    if (engineRef.current !== null) return engineRef.current;
    const engine = await createEngine(instrumentRef.current, settingsRef.current);
    engineRef.current = engine;
    dispatch({ type: "audio", status: engine.ready ? "running" : "suspended" });
    const sortie = engine.audioOutputMs();
    dispatch({ type: "latency", outputMs: sortie });
    void onEvents;
    return engine;
  }, [onEvents]);

  const startPointer = useCallback(async () => {
    dispatch({ type: "playWithoutCamera" });
    await ouvrirMoteur();
    detecterMidi();
  }, [ouvrirMoteur]);

  const startCamera = useCallback(async () => {
    dispatch({ type: "start" });
    await ouvrirMoteur();
    detecterMidi();
    let source: CameraSource | null = null;
    try {
      const vision = await import("@thin-air/vision");
      const video = videoRef.current;
      if (video === null) throw new Error("video");
      dispatch({ type: "modelLoading" });
      // La caméra et le modèle sont ouverts ensemble par la source : le modèle
      // est chargé UNE fois, dans le worker quand c'est possible (AIR-F-07),
      // avec les chemins du site — jamais absolus, jamais tiers (AIR-N-01).
      source = vision.createCameraSource(video, {
        frameRateIdeal: settingsRef.current.frameRateIdeal,
        modelUrl: MODEL_URL,
        wasmRoot: WASM_ROOT,
        numHands: settingsRef.current.numHands,
        onStats: (mesure) =>
          pousserAnalyse(
            { inferenceMs: mesure.inferenceMs, frameIntervalMs: mesure.frameIntervalMs },
            mesure.analysisThread ?? null,
          ),
      });
      sourceRef.current = source;
      source.onFrame((frame) => {
        const mains = vision.normaliseSides(frame.hands, true);
        detectedRef.current = mains;
        handsRef.current = mainsToInputs(mains, settingsRef.current.leftHanded, rectRef.current);
        const bord = handsRef.current.some((main) => main.u <= 0 || main.u >= 1 || main.v <= 0 || main.v >= 1);
        dispatch({ type: "hands", count: mains.length, atEdge: bord });
      });
      await source.start();
      dispatch({ type: "cameraGranted" });
      dispatch({ type: "modelReady" });
    } catch {
      // Caméra refusée, absente, ou modèle non livré : le jeu continue au
      // pointeur, avec le même moteur (AIR-F-02, P6).
      try {
        source?.stop();
      } catch {
        /* déjà arrêté */
      }
      sourceRef.current = null;
      reinitialiserAnalyse();
      dispatch({ type: "cameraDenied" });
    }
  }, [ouvrirMoteur]);

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      /* déjà arrêté */
    }
    sourceRef.current = null;
    handsRef.current = [];
    detectedRef.current = [];
    reinitialiserAnalyse();
    engineRef.current?.releaseAll();
    engineRef.current?.close();
    engineRef.current = null;
    dispatch({ type: "stop" });
  }, []);

  const resumeAudio = useCallback(async () => {
    await engineRef.current?.resume();
    dispatch({ type: "audio", status: "running" });
  }, []);

  const setInstrument = useCallback((suivant: Instrument) => {
    engineRef.current?.releaseAll();
    engineRef.current?.setInstrument(suivant);
  }, []);

  const setSettings = useCallback((suivants: Settings) => {
    engineRef.current?.setSettings(suivants);
  }, []);

  useEffect(() => {
    const visibilite = () => dispatch({ type: "visibility", hidden: document.hidden });
    document.addEventListener("visibilitychange", visibilite);
    visibilite();
    return () => document.removeEventListener("visibilitychange", visibilite);
  }, []);

  return {
    state,
    dispatch,
    videoRef,
    rectRef,
    handsRef,
    detectedRef,
    engineRef,
    startCamera,
    startPointer,
    stop,
    resumeAudio,
    setInstrument,
    setSettings,
  };
}


/** Mains détectées → positions dans la zone de jeu, rôles inversés si gaucher (AIR-F-11). */
export function mainsToInputs(
  hands: readonly DetectedHand[],
  leftHanded: boolean,
  rect: PlayRect,
  aspect = 4 / 3,
): readonly HandInput[] {
  return hands.slice(0, 2).map((main): HandInput => {
    const naturel: HandRole = main.side === "left" ? "pitch" : "volume";
    const role: HandRole = leftHanded ? (naturel === "pitch" ? "volume" : "pitch") : naturel;
    const poignet = main.points[0] ?? [0.5, 0.5, 0];
    const majeur = main.points[9] ?? poignet;
    const position = toPlayPosition(
      (poignet[0] + majeur[0]) / 2,
      (poignet[1] + majeur[1]) / 2,
      rect,
      aspect,
    );
    return { role, side: main.side, u: position.u, v: position.v };
  });
}

/** Web MIDI existe-t-il ici ? La fonction est masquée quand il manque (§7.12). */
export function detecterMidi(): boolean {
  if (typeof navigator === "undefined") return false;
  return "requestMIDIAccess" in navigator;
}

export { DEFAULT_SETTINGS };
