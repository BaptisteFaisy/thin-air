/**
 * Générateurs de prises de synthèse (cahier §7.11). Ce sont elles qui
 * nourrissent les propriétés de la section 13 : aucune caméra réelle n'est
 * utilisée en CI (AIR-N-10).
 *
 * Convention géométrique : les points d'une main sont posés dans l'image
 * autour d'une paume centrale ; `u` croît vers la droite de l'image APRÈS
 * miroir. Une main de synthèse est donc déjà exprimée en coordonnées
 * « écran » : `space.mirrorX` n'est appliquée qu'aux prises réelles.
 */
import type { DetectedHand, HandSide, Take, TakeFrame } from "./types.js";
import { todo } from "./internal.js";

export interface HandPose {
  /** Position du centre de la paume, en coordonnées d'image 0..1. */
  readonly x: number;
  readonly y: number;
  /** Distance poignet-base du majeur, en fraction de l'image. */
  readonly scale?: number;
  /** 0 = poing, 1 = main à plat. */
  readonly open?: number;
  /** 0 = pince serrée, 1 = pouce et index écartés. */
  readonly pinch?: number;
  readonly side?: HandSide;
}

export interface SynthOptions {
  readonly fps?: number;
  readonly durationS?: number;
  readonly seed?: number;
}

/** Fabrique les 21 points d'une main plausible pour une pose donnée. */
export function makeHand(pose: HandPose): DetectedHand {
  void pose;
  return todo("takeGen.makeHand", "A2");
}

/** Main qui avance à vitesse constante d'un point à un autre. */
export function linearTake(from: HandPose, to: HandPose, options?: SynthOptions): Take {
  void from; void to; void options;
  return todo("takeGen.linearTake", "A2");
}

/** Main qui tremble autour d'une position, avec une amplitude donnée. */
export function tremorTake(center: HandPose, amplitude: number, options?: SynthOptions): Take {
  void center; void amplitude; void options;
  return todo("takeGen.tremorTake", "A2");
}

/** Index qui traverse des cordes : de `fromU` à `toU` en `durationS`. */
export function sweepTake(fromU: number, toU: number, options?: SynthOptions): Take {
  void fromU; void toU; void options;
  return todo("takeGen.sweepTake", "A2");
}

/** Main qui sort du cadre en plein milieu d'une note. */
export function handLeavesTake(pose: HandPose, leaveAtS: number, options?: SynthOptions): Take {
  void pose; void leaveAtS; void options;
  return todo("takeGen.handLeavesTake", "A2");
}

/** Deux mains qui se croisent sans disparaître (AIR-P-21). */
export function crossingHandsTake(options?: SynthOptions): Take {
  void options;
  return todo("takeGen.crossingHandsTake", "A2");
}

/** Une seule main gauche levée : fixe la convention de côté (§7.3). */
export function leftHandOnlyTake(options?: SynthOptions): Take {
  void options;
  return todo("takeGen.leftHandOnlyTake", "A2");
}

/** Images manquantes et cadence irrégulière, pour éprouver les délais. */
export function withDroppedFrames(take: Take, every: number, options?: SynthOptions): Take {
  void take; void every; void options;
  return todo("takeGen.withDroppedFrames", "A2");
}

/** Ajoute une main à chaque image d'une prise existante. */
export function withHand(take: Take, hand: (t: number) => DetectedHand | null): Take {
  void take; void hand;
  return todo("takeGen.withHand", "A2");
}

export function frame(t: number, hands: readonly DetectedHand[]): TakeFrame {
  return { t, hands };
}
