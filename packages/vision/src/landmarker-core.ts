/**
 * Le cœur déterministe et sans dépendance runtime de la détection des mains
 * (cahier §7.3) : seuils, usine de détecteur, repli GPU → CPU, enveloppe
 * `Landmarker` avec horodatages croissants et temps mesuré.
 *
 * Ce module n'importe JAMAIS le paquet MediaPipe à l'exécution (seulement ses
 * types, effacés), donc il se charge aussi bien dans le fil principal que dans
 * le worker, et ses tests tournent dans Node sans modèle. Les deux chemins
 * (`landmarker.ts` au fil principal, `worker/analysis-worker.ts` au worker) le
 * réutilisent au lieu de dupliquer la logique.
 */
import type { DetectedHand } from "@thin-air/core";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
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

/**
 * Construit l'usine de détecteur à partir d'un module MediaPipe déjà chargé.
 * Séparée du chargement du paquet pour rester testable et réutilisable dans
 * le worker (qui importe le paquet statiquement, sans code-splitting).
 */
export async function mediaPipeDetector(
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