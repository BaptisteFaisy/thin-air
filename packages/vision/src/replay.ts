/**
 * Rejouer une prise comme si les mains étaient devant la caméra
 * (AIR-F-48) : le fantôme de la page et la preuve de bout en bout (§13.1,
 * niveau 3) passent tous les deux par là.
 */
import type { Take } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";
import type { HandSource } from "./source.js";

export interface ReplayOptions {
  /** Vitesse de rejeu ; 0,5 pour montrer la scène au ralenti. */
  readonly speed?: number;
  readonly loop?: boolean;
  /** Horloge injectable, pour les tests déterministes. */
  readonly now?: () => number;
}

export function createReplaySource(take: Take, options?: ReplayOptions): HandSource {
  void take; void options;
  return todo("vision.createReplaySource", "A5");
}
