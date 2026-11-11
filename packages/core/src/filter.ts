/**
 * Filtre « One Euro » (Casiez, Roussel, Vogel 2012) et ses deux canaux
 * (cahier §7.5). Propriété : AIR-P-02 (borné, converge, jamais non numérique).
 */
import { todo } from "./internal.js";

export interface FilterOptions {
  /** Coupure minimale, Hz. */
  readonly fcMin: number;
  /** Coefficient de vitesse. */
  readonly beta: number;
  /** Coupure du lissage de la vitesse, Hz. */
  readonly fcD: number;
}

export class OneEuroFilter {
  constructor(
    readonly options: FilterOptions,
    /** Coupure fixe : si définie, le filtre ne suit pas la vitesse (canal vif). */
    readonly fixedCutoffHz?: number,
  ) {}

  /** Oublie l'historique (changement de main, reprise après absence). */
  reset(): void {
    todo("filter.OneEuroFilter.reset", "A2");
  }

  /**
   * `tSeconds` est l'horodatage réel de l'image. Deux images portant le même
   * horodatage ne doivent produire ni NaN ni saut : le filtre reste borné.
   */
  filter(value: number, tSeconds: number): number {
    void value; void tSeconds;
    return todo("filter.OneEuroFilter.filter", "A2");
  }

  /** Dernière sortie, pour lecture sans nouveau calcul. */
  get last(): number {
    return todo("filter.OneEuroFilter.last", "A2");
  }
}

export interface DualChannel {
  /** Réglages continus : hauteur, volume, timbre. */
  readonly smooth: OneEuroFilter;
  /** Déclenchements : coupure fixe, aucune attente de lissage. */
  readonly fast: OneEuroFilter;
}

export function makeDualChannel(options: FilterOptions, fcTriggerHz: number): DualChannel {
  void options; void fcTriggerHz;
  return todo("filter.makeDualChannel", "A2");
}

/** Constante de temps et α pour une coupure et un pas donnés (tableau §7.5). */
export function alphaFor(cutoffHz: number, teSeconds: number): number {
  void cutoffHz; void teSeconds;
  return todo("filter.alphaFor", "A2");
}
