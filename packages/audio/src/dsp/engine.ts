/**
 * Le contrat commun des quatre moteurs (cahier §7.8) : un moteur rend un
 * échantillon à la fois, sans état global, et se laisse borner par la voix.
 * La voix fournit la hauteur déjà lissée : le moteur ne fait que sonner.
 */
import type { VoiceParams } from "./voice.js";
import { createDrumEngine } from "./drum.js";
import { createFmEngine } from "./fm.js";
import { createOscEngine } from "./osc.js";
import { createPluckEngine } from "./pluck.js";

export interface EngineContext {
  /** Fréquence courante, en Hz, déjà lissée par la voix. */
  readonly freqHz: number;
  /** Coupure du filtre de brillance, en Hz. */
  readonly cutoffHz: number;
  /** Temps écoulé depuis le début de la voix, en secondes. */
  readonly timeS: number;
}

export interface Engine {
  /** Un échantillon. */
  next(ctx: EngineContext): number;
  /** Une nouvelle frappe : l'excitation (corde, percussion). */
  strike(velocity: number): void;
  /** Vrai quand le moteur n'a plus rien à rendre. */
  readonly finished: boolean;
}

/** Le moteur du moteur : la voix choisit, l'instrument décide. */
export function createEngine(params: VoiceParams): Engine {
  switch (params.engine) {
    case "osc":
      return createOscEngine(params);
    case "pluck":
      return createPluckEngine(params);
    case "fm":
      return createFmEngine(params);
    case "drum":
      return createDrumEngine(params);
  }
}
