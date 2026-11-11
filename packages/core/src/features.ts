/**
 * Mesures de la main (cahier §7.6) : u, v, pince, ouverture, vitesses,
 * présence. Deux canaux sortent du filtrage : lissé et vif (§7.5).
 */
import type { DetectedHand, Features, HandPoint, PlayRect, PointerKind, Settings } from "./types.js";
import { todo } from "./internal.js";

/** Distance du poignet (0) à la base du majeur (9) : l'échelle `s`. */
export function palmScale(points: readonly HandPoint[]): number {
  void points;
  return todo("features.palmScale", "A2");
}

/** Centre de la paume : moyenne des points 0, 5, 9, 13, 17. */
export function palmCenter(points: readonly HandPoint[]): HandPoint {
  void points;
  return todo("features.palmCenter", "A2");
}

/** Le point qui vise : bout de l'index (8) ou centre de la paume. */
export function pointerPoint(points: readonly HandPoint[], pointer: PointerKind): HandPoint {
  void points; void pointer;
  return todo("features.pointerPoint", "A2");
}

/** Distance pouce-index (4-8) divisée par `s`. */
export function pinchValue(points: readonly HandPoint[]): number {
  void points;
  return todo("features.pinchValue", "A2");
}

/** Moyenne des distances des quatre bouts (8, 12, 16, 20) au poignet, / `s`, ramenée entre 0 et 1. */
export function openValue(points: readonly HandPoint[]): number {
  void points;
  return todo("features.openValue", "A2");
}

/** Mesures brutes d'une main, avant filtrage. */
export function rawFeatures(
  hand: DetectedHand,
  rect: PlayRect,
  aspect: number,
  pointer: PointerKind,
): Features {
  void hand; void rect; void aspect; void pointer;
  return todo("features.rawFeatures", "A2");
}

/**
 * Suit une main : possède ses filtres, rend le canal lissé et le canal vif,
 * tient les dernières valeurs pendant le délai de grâce, puis déclare la main
 * absente (AIR-F-15).
 */
export class FeatureTracker {
  constructor(
    readonly rect: PlayRect,
    readonly aspect: number,
    readonly settings: Settings,
    readonly pointer: PointerKind,
  ) {}

  /** `hand` = null si la main n'est pas vue sur cette image. */
  push(tSeconds: number, hand: DetectedHand | null): { readonly smooth: Features; readonly fast: Features } {
    void tSeconds; void hand;
    return todo("features.FeatureTracker.push", "A2");
  }

  reset(): void {
    todo("features.FeatureTracker.reset", "A2");
  }
}
