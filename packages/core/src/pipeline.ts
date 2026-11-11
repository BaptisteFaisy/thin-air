/**
 * La chaîne complète, du cadre aux événements (cahier §7.1) :
 * image → rôles → filtrage → mesures → gestes → instrument → événements.
 * C'est ce que rejoue le banc d'essai sur une prise, et ce que la page
 * exécute en direct. `core` est pur : aucune dépendance au navigateur
 * (AIR-N-09).
 */
import type { Instrument, MusicEvent, PlayRect, Settings, Take, TakeFrame } from "./types.js";
import { todo } from "./internal.js";

export interface PipelineOptions {
  readonly oneHand?: boolean;
  readonly hold?: boolean;
  readonly leftHanded?: boolean;
  readonly magnet?: number | null;
  /** Rectangle de jeu calibré ; par défaut les 80 % centraux. */
  readonly rect?: PlayRect;
  readonly aspect?: number;
  /**
   * Après la dernière image : délai de grâce, relâchement et extinction.
   * Désactivé seulement pour mesurer un comportement précis.
   */
  readonly finish?: boolean;
}

export class TakeProcessor {
  constructor(
    readonly instrument: Instrument,
    readonly settings: Settings,
    readonly options?: PipelineOptions,
  ) {}

  push(frame: TakeFrame): readonly MusicEvent[] {
    void frame;
    return todo("pipeline.TakeProcessor.push", "A3");
  }

  /** Fin de prise : grâce (150 ms), relâchement, extinction (AIR-P-09). */
  finish(): readonly MusicEvent[] {
    return todo("pipeline.TakeProcessor.finish", "A3");
  }
}

/**
 * Une prise + un instrument = une liste d'événements, au bit près identique
 * d'un appel à l'autre (AIR-P-12).
 */
export function processTake(
  take: Take,
  instrument: Instrument,
  settings?: Partial<Settings>,
  options?: PipelineOptions,
): readonly MusicEvent[] {
  void take; void instrument; void settings; void options;
  return todo("pipeline.processTake", "A3");
}
