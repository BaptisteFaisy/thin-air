/** Le contrat commun des sources de mains : caméra, pointeur, clavier, rejeu. */
import type { DetectedHand } from "@thin-air/core";

export interface VisionFrame {
  /** Horodatage en secondes, monotone : c'est lui que lit le filtre (§7.5). */
  readonly t: number;
  readonly hands: readonly DetectedHand[];
  /** Temps d'analyse du modèle, en ms ; 0 pour une source sans modèle. */
  readonly inferenceMs: number;
}

export type FrameListener = (frame: VisionFrame) => void;

export interface HandSource {
  readonly kind: "camera" | "pointer" | "keyboard" | "replay";
  start(): Promise<void>;
  stop(): void;
  onFrame(listener: FrameListener): () => void;
}
