/**
 * Capture (cahier §7.2) : 640 × 480, 60 images/s souhaitées, 24 au minimum,
 * caméra frontale, SANS audio. Chaque image nouvelle est analysée une fois et
 * une seule (AIR-F-03), sur `requestVideoFrameCallback` quand il existe.
 * La caméra ne démarre qu'après le clic « Start » (AIR-F-01).
 */
import type { HandSource } from "./source.js";
import { todo } from "@thin-air/core/internal";

export interface CameraOptions {
  readonly width?: number;
  readonly height?: number;
  readonly frameRateIdeal?: number;
  readonly frameRateMin?: number;
  readonly facingMode?: "user" | "environment";
  readonly onStats?: (stats: { readonly frameIntervalMs: number; readonly inferenceMs: number }) => void;
  /** Aucune main pendant trois secondes alors que l'image change (AIR-F-06). */
  readonly onNoHands?: (seconds: number) => void;
}

export function createCameraSource(video: HTMLVideoElement, options?: CameraOptions): HandSource {
  void video; void options;
  return todo("vision.createCameraSource", "A5");
}

/** Demande la caméra sans audio ; lève une erreur lisible si refusée. */
export async function openCamera(video: HTMLVideoElement, options?: CameraOptions): Promise<void> {
  void video; void options;
  return todo("vision.openCamera", "A5");
}

/** `requestVideoFrameCallback` existe-t-il ici ? (À vérifier par navigateur.) */
export function hasVideoFrameCallback(video: HTMLVideoElement): boolean {
  void video;
  return todo("vision.hasVideoFrameCallback", "A5");
}
