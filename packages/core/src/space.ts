/**
 * Repère de jeu et calibration (cahier §7.4).
 * Propriétés : AIR-P-01 (u,v bornés, u monotone), AIR-P-22 (calibration).
 */
import type { PlayRect } from "./types.js";
import { todo } from "./internal.js";

export interface PlayPosition {
  readonly u: number;
  readonly v: number;
  readonly edge: boolean;
}

/** Miroir : l'abscisse est retournée (AIR-F-05). */
export function mirrorX(x: number): number {
  void x;
  return todo("space.mirrorX", "A2");
}

/**
 * Position d'un point d'image dans la zone de jeu.
 * `aspect` = largeur / hauteur de l'image : les distances sont calculées
 * après correction du rapport (cahier §7.4). Hors rectangle, borné et `edge`.
 */
export function toPlayPosition(
  x: number,
  y: number,
  rect: PlayRect,
  aspect: number,
): PlayPosition {
  void x; void y; void rect; void aspect;
  return todo("space.toPlayPosition", "A2");
}

export interface CalibrationSample {
  readonly u: number;
  readonly v: number;
}

export interface CalibrationOptions {
  /** Du 5ᵉ au 95ᵉ centile, élargi de 5 % (cahier §7.4). */
  readonly lowPercentile?: number;
  readonly highPercentile?: number;
  readonly expand?: number;
  /** En dessous, la zone est jugée trop petite : on rend `null`. */
  readonly minSpan?: number;
}

/**
 * Rectangle de jeu déduit d'un relevé de portée (AIR-F-09).
 * Rend `null` si le relevé couvre moins de 20 % de l'image sur un axe :
 * l'écran propose alors de recommencer ou de garder la zone par défaut.
 */
export function calibratePlayRect(
  samples: readonly CalibrationSample[],
  options?: CalibrationOptions,
): PlayRect | null {
  void samples; void options;
  return todo("space.calibratePlayRect", "A2");
}

/** Position relative dans un axe de corde ou de zone (0 = première, 1 = dernière). */
export function axisValue(position: PlayPosition, axis: "u" | "v"): number {
  void position; void axis;
  return todo("space.axisValue", "A2");
}
