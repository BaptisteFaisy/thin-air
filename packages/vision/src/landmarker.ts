/**
 * Détection des mains (cahier §7.3) : `@mediapipe/tasks-vision`, tâche
 * Hand Landmarker, modèle `hand_landmarker.task` servi par le site lui-même —
 * jamais par un tiers (AIR-N-01). Mode vidéo, deux mains, seuils par défaut,
 * processeur graphique avec repli sur processeur.
 */
import type { DetectedHand } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export interface LandmarkerOptions {
  /** Chemin local du modèle : `/models/hand_landmarker.task`. */
  readonly modelUrl: string;
  readonly numHands?: number;
  readonly delegate?: "GPU" | "CPU";
  readonly onProgress?: (ratio: number) => void;
}

export interface Landmarker {
  detect(video: HTMLVideoElement, timestampMs: number): { readonly hands: readonly DetectedHand[]; readonly inferenceMs: number };
  close(): void;
}

export async function loadLandmarker(options: LandmarkerOptions): Promise<Landmarker> {
  void options;
  return todo("vision.loadLandmarker", "A5");
}

/**
 * Le piège du côté : ce que le modèle annonce dépend du miroir. La
 * convention est fixée par la prise `left-hand-only` (cahier §7.3).
 */
export function normaliseSides(hands: readonly DetectedHand[], mirrored: boolean): readonly DetectedHand[] {
  void hands; void mirrored;
  return todo("vision.normaliseSides", "A5");
}
