/**
 * La main virtuelle du jeu sans caméra (AIR-F-02, parcours P2) : le pointeur
 * devient une main de 21 points, dans les mêmes coordonnées que le modèle de
 * vision. La chaîne en aval est donc exactement la même — c'est ce qui rend ce
 * mode crédible, et testable sans navigateur.
 */
import type { DetectedHand, HandPoint, PlayRect } from "@thin-air/core";

/** Échelle de la main virtuelle, en fractions de l'image. */
export const HAND_SCALE = 0.09;

/**
 * Squelette déterministe : poignet, puis quatre doigts et le pouce. Aucun
 * nombre aléatoire (AIR-N-09) : la même position donne la même main.
 */
const OSSATURE: readonly (readonly [number, number])[] = [
  [0, 0.55],
  [0, 0.25],
  [0, 0.05],
  [0, -0.1],
  [0, -0.2],
  [-0.16, 0.22],
  [-0.18, 0],
  [-0.19, -0.14],
  [-0.19, -0.25],
  [-0.06, 0.24],
  [-0.07, 0.02],
  [-0.07, -0.14],
  [-0.07, -0.27],
  [0.06, 0.24],
  [0.06, 0.02],
  [0.06, -0.13],
  [0.06, -0.25],
  [0.17, 0.2],
  [0.18, 0],
  [0.18, -0.12],
  [0.18, -0.22],
];

/** Position dans l'image (0..1) correspondant à une position dans la zone. */
export function imagePoint(u: number, v: number, rect: PlayRect): readonly [number, number] {
  const ecranX = rect.u0 + borne(u) * (rect.u1 - rect.u0);
  const ecranY = rect.v0 + borne(v) * (rect.v1 - rect.v0);
  return [1 - ecranX, 1 - ecranY];
}

function borne(valeur: number): number {
  if (!Number.isFinite(valeur)) return 0;
  return valeur < 0 ? 0 : valeur > 1 ? 1 : valeur;
}

/** Une main de 21 points centrée sur la position du pointeur. */
export function pointerHand(u: number, v: number, rect: PlayRect): DetectedHand {
  const [x, y] = imagePoint(u, v, rect);
  const points: readonly HandPoint[] = OSSATURE.map(
    ([dx, dy]) => [x + dx * HAND_SCALE, y + dy * HAND_SCALE, 0] as HandPoint,
  );
  return { side: "right", score: 1, points };
}

/** Le clavier joue une corde : la main virtuelle est posée sur cette corde. */
export function keyboardHand(index: number, count: number, v: number, rect: PlayRect): DetectedHand {
  const u = count <= 0 ? 0.5 : (index + 0.5) / count;
  return pointerHand(u, v, rect);
}
