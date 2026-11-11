/**
 * Attribution des rôles (cahier §7.3) : une main « de hauteur » et une main
 * « de volume ». Une fois attribué, un rôle suit la main par continuité (la
 * paume la plus proche de sa position précédente) et ne change pas tant
 * qu'elle n'a pas disparu plus d'une demi-seconde : deux mains qui se croisent
 * n'échangent pas leurs rôles (AIR-P-21).
 */
import type { DetectedHand, HandRole, HandSide, Settings } from "./types.js";
import { palmCenter } from "./features.js";

export interface AssignedHand {
  readonly role: HandRole;
  readonly side: HandSide;
  readonly id: number;
  readonly hand: DetectedHand;
}

/** Durée au-delà de laquelle une main disparue perd son rôle (§7.3). */
export const ROLE_MEMORY_S = 0.5;

interface Suivi {
  id: number;
  role: HandRole;
  /** Dernier côté annoncé par le modèle : la clé principale de continuité. */
  cote: HandSide;
  x: number;
  y: number;
  vuA: number;
}

/** Rôle d'après le côté, en tenant compte du réglage gaucher (AIR-F-11). */
export function roleForSide(side: HandSide, leftHanded: boolean): HandRole {
  const droite = leftHanded ? "volume" : "pitch";
  return side === "right" ? droite : droite === "pitch" ? "volume" : "pitch";
}

export class RoleTracker {
  private suivis: Suivi[] = [];
  private prochainId = 1;

  constructor(readonly settings: Settings) {}

  push(tSeconds: number, hands: readonly DetectedHand[]): readonly AssignedHand[] {
    this.purger(tSeconds);
    const restants = [...this.suivis];
    const affectes: AssignedHand[] = [];
    // Continuité d'abord : le côté annoncé par le modèle, puis la proximité.
    const paires = this.apparier(hands, restants);
    for (const [indexMain, suivi] of paires) {
      const hand = hands[indexMain]!;
      const centre = palmCenter(hand.points);
      suivi.x = centre[0];
      suivi.y = centre[1];
      suivi.cote = hand.side;
      suivi.vuA = tSeconds;
      affectes.push({ role: suivi.role, side: hand.side, id: suivi.id, hand });
      const place = restants.indexOf(suivi);
      if (place >= 0) restants.splice(place, 1);
    }
    // Les mains nouvelles prennent un rôle libre, d'après leur côté.
    const prises = new Set(affectes.map((a) => a.role));
    hands.forEach((hand, index) => {
      if (paires.some(([i]) => i === index)) return;
      // Une main seule est la main de hauteur : c'est elle qui joue (AIR-F-10).
      const seule = hands.length === 1 && this.suivis.length === 0;
      const souhaite = seule ? "pitch" : roleForSide(hand.side, this.settings.leftHanded);
      const role: HandRole = prises.has(souhaite) ? autre(souhaite) : souhaite;
      if (prises.has(role)) return; // un seul rôle par main
      prises.add(role);
      const centre = palmCenter(hand.points);
      const suivi: Suivi = {
        id: this.prochainId++, role, cote: hand.side,
        x: centre[0], y: centre[1], vuA: tSeconds,
      };
      this.suivis.push(suivi);
      affectes.push({ role, side: hand.side, id: suivi.id, hand });
    });
    return affectes.sort((a, b) => a.role.localeCompare(b.role));
  }

  /**
   * Appariement : le CÔTÉ d'abord, la proximité ensuite.
   *
   * Pourquoi pas la seule proximité : au croisement, deux mains échangent leurs
   * positions en une image — la plus proche d'un suivi devient l'autre main, et
   * les rôles s'échangent (AIR-P-21 serait violée). Le côté anatomique annoncé
   * par le modèle ne change pas pendant un croisement : c'est donc la clé
   * principale. La proximité départage deux mains du même côté, et récupère un
   * suivi dont le modèle a perdu le côté.
   */
  private apparier(hands: readonly DetectedHand[], suivis: readonly Suivi[]): [number, Suivi][] {
    const candidats: { prio: number; d: number; index: number; suivi: Suivi }[] = [];
    suivis.forEach((suivi) => {
      hands.forEach((hand, index) => {
        const centre = palmCenter(hand.points);
        const d = Math.hypot(centre[0] - suivi.x, centre[1] - suivi.y);
        candidats.push({ prio: suivi.cote === hand.side ? 0 : 1, d, index, suivi });
      });
    });
    candidats.sort((a, b) => a.prio - b.prio || a.d - b.d || a.suivi.id - b.suivi.id);
    const mainsPrises = new Set<number>();
    const suivisPris = new Set<Suivi>();
    const paires: [number, Suivi][] = [];
    for (const c of candidats) {
      if (mainsPrises.has(c.index) || suivisPris.has(c.suivi)) continue;
      mainsPrises.add(c.index);
      suivisPris.add(c.suivi);
      paires.push([c.index, c.suivi]);
    }
    return paires;
  }

  /** Oublie les mains disparues depuis plus de ROLE_MEMORY_S. */
  private purger(tSeconds: number): void {
    this.suivis = this.suivis.filter((s) => tSeconds - s.vuA <= ROLE_MEMORY_S);
  }

  reset(): void {
    this.suivis = [];
    this.prochainId = 1;
  }
}

function autre(role: HandRole): HandRole {
  return role === "pitch" ? "volume" : "pitch";
}
