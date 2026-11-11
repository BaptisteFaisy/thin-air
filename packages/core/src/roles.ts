/**
 * Attribution des rôles (cahier §7.3) : une main « de hauteur », une main
 * « de volume ». Le rôle suit la main par continuité et ne change pas tant
 * qu'elle n'a pas disparu plus d'une demi-seconde. Propriété : AIR-P-21.
 */
import type { DetectedHand, HandRole, HandSide, Settings } from "./types.js";
import { todo } from "./internal.js";

export interface AssignedHand {
  readonly role: HandRole;
  readonly side: HandSide;
  readonly id: number;
  readonly hand: DetectedHand;
}

/** Durée au-delà de laquelle une main disparue perd son rôle. */
export const ROLE_MEMORY_S = 0.5;

export class RoleTracker {
  constructor(readonly settings: Settings) {}

  push(tSeconds: number, hands: readonly DetectedHand[]): readonly AssignedHand[] {
    void tSeconds; void hands;
    return todo("roles.RoleTracker.push", "A2");
  }

  reset(): void {
    todo("roles.RoleTracker.reset", "A2");
  }
}
