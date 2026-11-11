/**
 * Détection des mains (cahier §7.3) : `@mediapipe/tasks-vision`, tâche Hand
 * Landmarker, modèle `hand_landmarker.task` servi par le site lui-même —
 * jamais par un tiers (AIR-N-01). Mode vidéo, deux mains, seuils de confiance
 * à leur valeur par défaut (0,5), processeur graphique avec repli sur
 * processeur (AIR-N-07).
 *
 * Le paquet MediaPipe est importé dynamiquement, à l'intérieur de
 * `loadLandmarker` : rien ne charge le bundle ni le wasm tant que la caméra
 * n'est pas démarrée, et les tests tournent dans Node sans lui. La
 * construction du détecteur est injectable (`createDetector`), donc le repli
 * GPU → CPU se prouve sans modèle.
 *
 * `detect(video, timestampMs)` est SYNCHRONE : c'est l'appel
 * `detectForVideo`, qui occupe la page le temps de l'analyse. Le temps mesuré
 * autour de cet appel est la part mesurable du retard (§5.1, AIR-F-31) ; le
 * reste (capture, sortie) est estimé ailleurs.
 */
import type { DetectedHand } from "@thin-air/core";
import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { monotonicTimestamp, toDetectedHands } from "./sides.js";
import { defaultNow } from "./source.js";

/** Chemin par défaut du modèle, servi par le site (§11.9). Jamais un tiers. */
export const DEFAULT_MODEL_URL = "/models/hand_landmarker.task";
/** Fichiers d'exécution du modèle, servis par le site aussi (§11.9). */
export const DEFAULT_WASM_ROOT = "/models/wasm";
/** Seuils de confiance du cahier §7.3 : leur valeur par défaut. */
export const DEFAULT_CONFIDENCE = 0.5;

export interface LandmarkerOptions {
  /** Chemin local du modèle : `/models/hand_landmarker.task`. */
  readonly modelUrl?: string;
  readonly numHands?: number;
  readonly delegate?: "GPU" | "CPU";
  readonly onProgress?: (ratio: number) => void;
  /** Racine des fichiers d'exécution, servie par le site (défaut `/models/wasm`). */
  readonly wasmRoot?: string;
  /** Injection : construit le détecteur. Les tests remplacent ceci. */
  readonly createDetector?: DetectorFactory;
  /** Horloge injectable, pour mesurer l'analyse de façon déterministe. */
  readonly now?: () => number;
}

export interface Landmarker {
  detect(video: HTMLVideoElement, timestampMs: number): {
    readonly hands: readonly DetectedHand[];
    readonly inferenceMs: number;
  };
  close(): void;
}

/** Ce dont on a besoin du paquet MediaPipe, réduit au strict minimum. */
export interface VisionModule {
  readonly FilesetResolver: { forVisionTasks(path: string): Promise<unknown> };
  readonly HandLandmarker: {
    createFromOptions(fileset: unknown, options: Record<string, unknown>): Promise<RawLandmarker>;
  };
}

/** Le détecteur brut, tel que MediaPipe le rend. */
export interface RawLandmarker {
  detectForVideo(video: unknown, timestampMs: number): HandLandmarkerResult;
  close(): void;
}

/** Usine de détecteur : un delegate à la fois, GPU d'abord puis CPU. */
export type DetectorFactory = (delegate: "GPU" | "CPU") => Promise<RawLandmarker>;

/** Charge le paquet MediaPipe. Séparé pour rester testable et paresseux. */
export async function loadVisionModule(): Promise<VisionModule> {
  const module = (await import("@mediapipe/tasks-vision")) as unknown as VisionModule;
  return module;
}

async function mediaPipeDetector(
  module: VisionModule,
  options: LandmarkerOptions,
): Promise<DetectorFactory> {
  const wasmRoot = options.wasmRoot ?? DEFAULT_WASM_ROOT;
  const fileset = await module.FilesetResolver.forVisionTasks(wasmRoot);
  return async (delegate) =>
    module.HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: options.modelUrl ?? DEFAULT_MODEL_URL,
        delegate,
      },
      runningMode: "VIDEO",
      numHands: options.numHands ?? 2,
      minHandDetectionConfidence: DEFAULT_CONFIDENCE,
      minHandPresenceConfidence: DEFAULT_CONFIDENCE,
      minTrackingConfidence: DEFAULT_CONFIDENCE,
    });
}

/**
 * Essaie le processeur graphique, puis retombe sur le processeur si le
 * premier échoue (AIR-N-07 : sans accélération graphique, repli CPU). Un
 * delegate explicitement demandé est respecté, sans repli.
 */
export async function createWithCpuFallback(
  factory: DetectorFactory,
  delegate?: "GPU" | "CPU",
): Promise<{ readonly detector: RawLandmarker; readonly delegate: "GPU" | "CPU" }> {
  if (delegate === "CPU") return { detector: await factory("CPU"), delegate: "CPU" };
  if (delegate === "GPU") return { detector: await factory("GPU"), delegate: "GPU" };
  try {
    return { detector: await factory("GPU"), delegate: "GPU" };
  } catch {
    return { detector: await factory("CPU"), delegate: "CPU" };
  }
}

/**
 * Charge le modèle et rend l'enveloppe `Landmarker`. Ne fait aucune requête
 * vers un tiers : les deux chemins sont locaux au site (AIR-N-01).
 */
export async function loadLandmarker(options: LandmarkerOptions = {}): Promise<Landmarker> {
  const now = options.now ?? defaultNow;
  options.onProgress?.(0);
  const factory = options.createDetector ?? (await mediaPipeDetector(await loadVisionModule(), options));
  options.onProgress?.(0.4);
  const { detector, delegate } = await createWithCpuFallback(factory, options.delegate);
  options.onProgress?.(1);
  return wrapDetector(detector, delegate, now);
}

/** Enveloppe le détecteur brut : horodatages croissants et temps mesuré. */
export function wrapDetector(
  detector: RawLandmarker,
  delegate: "GPU" | "CPU",
  now: () => number = defaultNow,
): Landmarker {
  let dernierTimestamp: number | null = null;
  let ferme = false;
  return {
    detect(video: HTMLVideoElement, timestampMs: number) {
      if (ferme) throw new Error("vision.loadLandmarker : détecteur fermé");
      const timestamp = monotonicTimestamp(dernierTimestamp, timestampMs);
      dernierTimestamp = timestamp;
      const debut = now();
      const brut = detector.detectForVideo(video, timestamp);
      const inferenceMs = now() - debut;
      return { hands: toDetectedHands(brut), inferenceMs };
    },
    close() {
      if (ferme) return;
      ferme = true;
      detector.close();
    },
    /** Le délégué effectivement retenu, pour l'écran « Show the physics ». */
    get delegate() {
      return delegate;
    },
  } as Landmarker & { readonly delegate: "GPU" | "CPU" };
}
