/**
 * Gestes à seuils doubles (cahier §7.6). Sans l'écart entre le seuil qui
 * enclenche et celui qui relâche, une main hésitante sur une frontière ferait
 * basculer la note dix fois par seconde.
 *
 * | geste | s'enclenche | se relâche |
 * |---|---|---|
 * | pince | `pinch` < pinchOn (0,25) | `pinch` > pinchOff (0,40) |
 * | poing | `open` < fistOn (0,20) | `open` > fistOff (0,35) |
 * | entrée de zone | dans la zone réduite de zoneMargin (10 %) | hors de la zone agrandie |
 * | traversée de corde | changement de côté, à plus de minPluckSpeed | réarmement après stringRearmMs |
 * | sortie de main | absente depuis plus de graceMs | — |
 *
 * Toutes ces valeurs viennent des `Settings` : aucune n'est recopiée ici.
 * Les seuils sont lus sur le canal VIF (§7.5) : une attaque n'attend pas le
 * lissage. Une traversée de corde est un instant, pas un état : elle n'émet
 * qu'un `start` (c'est ce que le mapping `cross → pluck` consomme).
 */
import type { GestureEvent, HandRole, Instrument, Settings, TrackedHand } from "./types.js";
import { axisValue } from "./space.js";

/** Position des cordes : la corde i est à (i + 0,5) / count (§7.14). */
export function stringPositions(count: number): readonly number[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  return Array.from({ length: Math.floor(count) }, (_, i) => (i + 0.5) / Math.floor(count));
}

/** Toutes les cordes franchies entre deux positions, dans l'ordre du parcours. */
export function crossedStrings(
  previous: number,
  next: number,
  positions: readonly number[],
): readonly number[] {
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous === next) return [];
  const montant = next > previous;
  const franchies: number[] = [];
  positions.forEach((position, index) => {
    const avant = montant ? previous < position : previous > position;
    const apres = montant ? next >= position : next <= position;
    if (avant && apres) franchies.push(index);
  });
  return montant ? franchies : franchies.reverse();
}

/** La première corde franchie, ou `null`. */
export function crossedString(
  previous: number,
  next: number,
  positions: readonly number[],
): number | null {
  return crossedStrings(previous, next, positions)[0] ?? null;
}

/** Force d'un pincement : vitesse / 3, bornée entre 0,1 et 1 (§7.6). */
export function pluckVelocity(speed: number): number {
  if (!Number.isFinite(speed)) return 0.1;
  return Math.min(1, Math.max(0.1, Math.abs(speed) / 3));
}

interface EtatGeste {
  pinch: boolean;
  fist: boolean;
  zones: Set<number>;
  entreeZone: Map<number, number>;
  dwellPose: Set<number>;
  dernierCross: Map<number, number>;
  positionPrecedente: number | null;
  perdue: boolean;
}

function etatNeuf(): EtatGeste {
  return {
    pinch: false,
    fist: false,
    zones: new Set(),
    entreeZone: new Map(),
    dwellPose: new Set(),
    dernierCross: new Map(),
    positionPrecedente: null,
    perdue: false,
  };
}

/** Zone réduite ou agrandie de la marge (§7.6) : la marge évite les bascules. */
function borne(zone: [number, number], marge: number, agrandir: boolean): [number, number] {
  const span = zone[1] - zone[0];
  const delta = span * marge * (agrandir ? 1 : -1);
  return [zone[0] - delta, zone[1] + delta];
}

function dansZone(u: number, v: number, zone: readonly [number, number, number, number], marge: number, agrandir: boolean): boolean {
  const [u0, u1] = borne([zone[0], zone[1]], marge, agrandir);
  const [v0, v1] = borne([zone[2], zone[3]], marge, agrandir);
  return u >= u0 && u <= u1 && v >= v0 && v <= v1;
}

export class GestureTracker {
  private etats = new Map<HandRole, EtatGeste>();
  private readonly cordes: readonly number[];
  private readonly axe: "u" | "v";

  constructor(readonly instrument: Instrument, readonly settings: Settings) {
    this.cordes = instrument.strings ? stringPositions(instrument.strings.count) : [];
    this.axe = instrument.strings?.axis ?? "u";
  }

  /** Une image : les gestes qui commencent ou finissent, dans l'ordre. */
  push(tSeconds: number, hands: readonly TrackedHand[]): readonly GestureEvent[] {
    const evenements: GestureEvent[] = [];
    const vus = new Set<string>();
    for (const hand of [...hands].sort((a, b) => a.role.localeCompare(b.role))) {
      vus.add(hand.role);
      evenements.push(...this.pourUneMain(tSeconds, hand));
    }
    for (const role of [...this.etats.keys()]) {
      if (!vus.has(role)) evenements.push(...this.mainDisparue(tSeconds, role));
    }
    return evenements;
  }

  /** Sortie définitive : relâche tout ce qui était enclenché. */
  releaseAll(tSeconds: number): readonly GestureEvent[] {
    const evenements: GestureEvent[] = [];
    for (const role of [...this.etats.keys()].sort()) {
      evenements.push(...this.relacher(tSeconds, role));
      this.etats.delete(role);
    }
    return evenements;
  }

  reset(): void {
    this.etats = new Map();
  }

  /** Tous les gestes d'une main sur une image. */
  private pourUneMain(t: number, hand: TrackedHand): readonly GestureEvent[] {
    const etat = this.etatDe(hand.role);
    if (!hand.present) return this.mainPerdue(t, hand.role, etat);
    etat.perdue = false;
    const sortis: GestureEvent[] = [];
    sortis.push(...this.seuils(t, hand, etat));
    sortis.push(...this.traversees(t, hand, etat));
    sortis.push(...this.zones(t, hand, etat));
    return sortis;
  }

  private etatDe(role: HandRole): EtatGeste {
    let etat = this.etats.get(role);
    if (etat === undefined) {
      etat = etatNeuf();
      this.etats.set(role, etat);
    }
    return etat;
  }

  /** Pince et poing : deux seuils distincts, lus sur le canal vif (§7.6). */
  private seuils(t: number, hand: TrackedHand, etat: EtatGeste): readonly GestureEvent[] {
    const s = this.settings;
    const sortis: GestureEvent[] = [];
    const pinch = hand.fast.pinch;
    if (!etat.pinch && pinch < s.pinchOn) {
      etat.pinch = true;
      sortis.push({ t, hand: hand.role, gesture: "pinch", phase: "start", value: pinch });
    } else if (etat.pinch && pinch > s.pinchOff) {
      etat.pinch = false;
      sortis.push({ t, hand: hand.role, gesture: "pinch", phase: "end", value: pinch });
    }
    const open = hand.fast.open;
    if (!etat.fist && open < s.fistOn) {
      etat.fist = true;
      sortis.push({ t, hand: hand.role, gesture: "fist", phase: "start", value: open });
    } else if (etat.fist && open > s.fistOff) {
      etat.fist = false;
      sortis.push({ t, hand: hand.role, gesture: "fist", phase: "end", value: open });
    }
    return sortis;
  }

  /** Traversées de cordes : une par corde franchie, avec réarmement (§7.6). */
  private traversees(t: number, hand: TrackedHand, etat: EtatGeste): readonly GestureEvent[] {
    if (this.cordes.length === 0) return [];
    const position = axisValue(hand.fast, this.axe);
    const precedent = etat.positionPrecedente;
    etat.positionPrecedente = position;
    if (precedent === null) return [];
    const vitesse = this.axe === "u" ? Math.abs(hand.fast.speedU) : Math.abs(hand.fast.speedV);
    // Une vitesse non finie (deux images au même horodatage) ne déclenche rien :
    // `NaN < seuil` est faux, il faut donc l'écarter explicitement.
    if (!Number.isFinite(vitesse) || vitesse < this.settings.minPluckSpeed) return [];
    const rearmement = this.settings.stringRearmMs / 1000;
    const sortis: GestureEvent[] = [];
    for (const index of crossedStrings(precedent, position, this.cordes)) {
      const dernier = etat.dernierCross.get(index);
      if (dernier !== undefined && t - dernier < rearmement) continue;
      etat.dernierCross.set(index, t);
      sortis.push({ t, hand: hand.role, gesture: "cross", phase: "start", value: vitesse, index });
    }
    return sortis;
  }

  /** Entrée, sortie et maintien dans une zone (§7.6, AIR-F-12). */
  private zones(t: number, hand: TrackedHand, etat: EtatGeste): readonly GestureEvent[] {
    const zones = this.instrument.zones?.zones ?? [];
    if (zones.length === 0) return [];
    const marge = this.settings.zoneMargin;
    const sortis: GestureEvent[] = [];
    zones.forEach((zone, index) => {
      const reduite = dansZone(hand.smooth.u, hand.smooth.v, [zone.u0, zone.u1, zone.v0, zone.v1], marge, false);
      const agrandie = dansZone(hand.smooth.u, hand.smooth.v, [zone.u0, zone.u1, zone.v0, zone.v1], marge, true);
      sortis.push(...this.entreeSortieZone(t, hand.role, index, reduite, agrandie, etat));
    });
    return sortis;
  }

  /** Une zone : entrée réduite, sortie agrandie, maintien après dwellMs. */
  private entreeSortieZone(
    t: number,
    role: HandRole,
    index: number,
    reduite: boolean,
    agrandie: boolean,
    etat: EtatGeste,
  ): readonly GestureEvent[] {
    const sortis: GestureEvent[] = [];
    const dedans = etat.zones.has(index);
    if (!dedans && reduite) {
      etat.zones.add(index);
      etat.entreeZone.set(index, t);
      sortis.push({ t, hand: role, gesture: "enter", phase: "start", value: index, index });
    } else if (dedans && !agrandie) {
      etat.zones.delete(index);
      etat.entreeZone.delete(index);
      etat.dwellPose.delete(index);
      sortis.push({ t, hand: role, gesture: "leave", phase: "end", value: index, index });
    }
    const entree = etat.entreeZone.get(index);
    if (this.settings.hold && dedans && entree !== undefined && !etat.dwellPose.has(index)
      && t - entree >= this.settings.dwellMs / 1000) {
      etat.dwellPose.add(index);
      sortis.push({ t, hand: role, gesture: "dwell", phase: "start", value: t - entree, index });
    }
    return sortis;
  }

  /** Main non vue : `handLost` une seule fois, puis plus rien. */
  private mainPerdue(t: number, role: HandRole, etat: EtatGeste): readonly GestureEvent[] {
    if (etat.perdue) return [];
    etat.perdue = true;
    return [{ t, hand: role, gesture: "handLost", phase: "start", value: 0 }, ...this.relacher(t, role)];
  }

  /** Une main qui n'est plus dans la liste du tout : même traitement. */
  private mainDisparue(t: number, role: HandRole): readonly GestureEvent[] {
    const etat = this.etatDe(role);
    if (etat.perdue) return [];
    etat.perdue = true;
    return [{ t, hand: role, gesture: "handLost", phase: "start", value: 0 }, ...this.relacher(t, role)];
  }

  /** Relâche les gestes à état (pince, poing, zones) — jamais une traversée. */
  private relacher(t: number, role: HandRole): readonly GestureEvent[] {
    const etat = this.etats.get(role);
    if (etat === undefined) return [];
    const main = role;
    const sortis: GestureEvent[] = [];
    if (etat.pinch) {
      etat.pinch = false;
      sortis.push({ t, hand: main, gesture: "pinch", phase: "end", value: 0 });
    }
    if (etat.fist) {
      etat.fist = false;
      sortis.push({ t, hand: main, gesture: "fist", phase: "end", value: 0 });
    }
    for (const index of [...etat.zones].sort((a, b) => a - b)) {
      etat.zones.delete(index);
      sortis.push({ t, hand: main, gesture: "leave", phase: "end", value: index, index });
    }
    etat.entreeZone.clear();
    etat.dwellPose.clear();
    return sortis;
  }
}
