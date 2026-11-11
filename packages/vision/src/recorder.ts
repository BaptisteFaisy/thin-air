/**
 * Les prises (cahier §7.11) : le flux des points, jamais l'image. Une prise
 * n'est enregistrée que sur demande et reste sur l'appareil (AIR-F-47).
 */
import type { Take } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";
import type { VisionFrame } from "./source.js";

export interface TakeRecorder {
  start(): void;
  push(frame: VisionFrame): void;
  stop(): Take;
  readonly seconds: number;
}

export function createTakeRecorder(fps?: number): TakeRecorder {
  void fps;
  return todo("vision.createTakeRecorder", "A5");
}

/** Propose la prise en téléchargement, sans aucun envoi réseau (AIR-F-57). */
export function downloadTake(take: Take, filename?: string): void {
  void take; void filename;
  todo("vision.downloadTake", "A5");
}
