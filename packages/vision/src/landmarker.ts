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
 * construction du détecteur et l'enveloppe vivent dans `landmarker-core.ts`
 * (sans import runtime de MediaPipe) : le worker les réutilise telles quelles.
 *
 * `detect(video, timestampMs)` est SYNCHRONE : c'est l'appel
 * `detectForVideo`, qui occupe la page le temps de l'analyse. Le temps mesuré
 * autour de cet appel est la part mesurable du retard (§5.1, AIR-F-31) ; le
 * reste (capture, sortie) est estimé ailleurs.
 */
import type { VisionModule } from "./landmarker-core.js";
import {
  createWithCpuFallback,
  mediaPipeDetector,
  wrapDetector,
  type Landmarker,
  type LandmarkerOptions,
} from "./landmarker-core.js";
import { defaultNow } from "./source.js";

export * from "./landmarker-core.js";

/** Charge le paquet MediaPipe. Séparé pour rester testable et paresseux. */
export async function loadVisionModule(): Promise<VisionModule> {
  const module = (await import("@mediapipe/tasks-vision")) as unknown as VisionModule;
  return module;
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