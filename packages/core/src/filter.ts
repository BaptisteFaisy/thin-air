/**
 * Filtre « One Euro » (Casiez, Roussel, Vogel 2012) et ses deux canaux
 * (cahier §7.5). Propriété : AIR-P-02 (borné, converge, jamais non numérique).
 *
 * Tout le temps vient des horodatages passés en argument : aucune lecture
 * d'horloge ici, le paquet `core` est du calcul pur.
 */
import { DEFAULT_SETTINGS } from "./defaults.js";

export interface FilterOptions {
  /** Coupure minimale, Hz. */
  readonly fcMin: number;
  /** Coefficient de vitesse. */
  readonly beta: number;
  /** Coupure du lissage de la vitesse, Hz. */
  readonly fcD: number;
}

const DEUX_PI = 2 * Math.PI;

/**
 * Cadence de repli quand aucun écart d'horodatage valide n'a encore été vu
 * (première image, horodatages identiques ou en recul). Elle vient des
 * réglages par défaut, jamais d'une constante écrite ici.
 */
function teDeRepli(): number {
  const fps = DEFAULT_SETTINGS.frameRateIdeal;
  return fps > 0 ? 1 / fps : 1 / 60;
}

/**
 * α = 1 / (1 + 1 / (2π · fc · Te)) — la formule exacte du cahier §7.5.
 *
 * Bornée par construction : 0 ≤ α ≤ 1 pour fc ≥ 0 et Te ≥ 0, et 0 quand le
 * produit s'annule (Te = 0 : on tient la sortie précédente, aucun saut).
 */
export function alphaFor(cutoffHz: number, teSeconds: number): number {
  const fc = Number.isFinite(cutoffHz) ? Math.max(cutoffHz, 0) : 0;
  const te = Number.isFinite(teSeconds) ? Math.max(teSeconds, 0) : 0;
  const denom = DEUX_PI * fc * te;
  if (!(denom > 0)) return 0;
  return 1 / (1 + 1 / denom);
}

/** Constante de temps d'un passe-bas de premier ordre : τ = 1 / (2π · fc). */
export function timeConstantFor(cutoffHz: number): number {
  const fc = Number.isFinite(cutoffHz) ? Math.max(cutoffHz, 0) : 0;
  if (!(fc > 0)) return 0;
  return 1 / (DEUX_PI * fc);
}

/** Coupure adaptative du cahier §7.5 : fc = fc_min + β · |d̂|. */
export function cutoffFor(options: FilterOptions, smoothedSpeed: number): number {
  const fcMin = Number.isFinite(options.fcMin) ? options.fcMin : 0;
  const beta = Number.isFinite(options.beta) ? options.beta : 0;
  const vitesse = Number.isFinite(smoothedSpeed) ? Math.abs(smoothedSpeed) : 0;
  return fcMin + beta * vitesse;
}

export class OneEuroFilter {
  /** Valeur d'entrée précédente, `null` tant qu'aucune image n'est arrivée. */
  private valuePrec: number | null = null;
  /** Horodatage précédent, `null` tant qu'aucune image n'est arrivée. */
  private tPrec: number | null = null;
  /** Dernière sortie calculée. */
  private sortie = 0;
  /** Vitesse lissée d̂ (unités de zone par seconde). */
  private vitesseLissee = 0;
  /** Dernier écart d'horodatage valide, utilisé en repli. */
  private teValide: number | null = null;
  /** Coupure en cours d'emploi (constante pour le canal vif). */
  private coupureCourante = 0;

  constructor(
    readonly options: FilterOptions,
    /** Coupure fixe : si définie, le filtre ne suit pas la vitesse (canal vif). */
    readonly fixedCutoffHz?: number,
  ) {}

  /** Oublie l'historique (changement de main, reprise après absence). */
  reset(): void {
    this.valuePrec = null;
    this.tPrec = null;
    this.sortie = 0;
    this.vitesseLissee = 0;
    this.teValide = null;
    this.coupureCourante = this.coupureInitiale();
  }

  /**
   * `tSeconds` est l'horodatage réel de l'image. Deux images portant le même
   * horodatage ne doivent produire ni NaN ni saut : le filtre reste borné.
   */
  filter(value: number, tSeconds: number): number {
    const x = Number.isFinite(value) ? value : this.sortie;
    const t = Number.isFinite(tSeconds) ? tSeconds : (this.tPrec ?? 0);
    const precedent = this.valuePrec;
    const tPrec = this.tPrec;

    if (precedent === null || tPrec === null) {
      // Première image : pas d'historique, la sortie vaut l'entrée.
      this.valuePrec = x;
      this.tPrec = t;
      this.sortie = x;
      this.vitesseLissee = 0;
      this.coupureCourante = this.coupureInitiale();
      return this.sortie;
    }

    const te = this.effectiveTe(t, tPrec);
    const vitesse = (x - precedent) / te;
    const alphaD = alphaFor(this.options.fcD, te);
    this.vitesseLissee = alphaD * vitesse + (1 - alphaD) * this.vitesseLissee;
    this.coupureCourante = this.fixedCutoffHz ?? cutoffFor(this.options, this.vitesseLissee);

    const alpha = alphaFor(this.coupureCourante, te);
    this.sortie = alpha * x + (1 - alpha) * this.sortie;

    this.valuePrec = x;
    this.tPrec = t;
    return this.sortie;
  }

  /** Dernière sortie, pour lecture sans nouveau calcul. */
  get last(): number {
    return this.sortie;
  }

  /** Coupure employée à la dernière image (constante pour le canal vif). */
  get cutoffHz(): number {
    return this.coupureCourante;
  }

  /** Vitesse lissée d̂ à la dernière image, en unités de zone par seconde. */
  get speed(): number {
    return this.vitesseLissee;
  }

  /**
   * Coupure employée avant la première image : la coupure imposée du canal
   * vif, ou la coupure minimale du canal adaptatif.
   */
  private coupureInitiale(): number {
    return this.fixedCutoffHz ?? cutoffFor(this.options, 0);
  }

  /**
   * Écart réel entre deux images. Un écart nul, négatif ou non fini
   * n'invalide pas le filtre : on reprend le dernier écart valide, sinon la
   * cadence de repli. La sortie reste ainsi bornée et finie (AIR-P-02).
   */
  private effectiveTe(t: number, tPrec: number): number {
    const brut = t - tPrec;
    if (Number.isFinite(brut) && brut > 0) {
      this.teValide = brut;
      return brut;
    }
    return this.teValide ?? teDeRepli();
  }
}

export interface DualChannel {
  /** Réglages continus : hauteur, volume, timbre. */
  readonly smooth: OneEuroFilter;
  /** Déclenchements : coupure fixe, aucune attente de lissage. */
  readonly fast: OneEuroFilter;
}

export function makeDualChannel(options: FilterOptions, fcTriggerHz: number): DualChannel {
  return {
    smooth: new OneEuroFilter(options),
    fast: new OneEuroFilter(options, fcTriggerHz),
  };
}

/** Réglages de filtrage du cahier §7.13, pris dans `defaults.ts`. */
export function defaultFilterOptions(): FilterOptions {
  return {
    fcMin: DEFAULT_SETTINGS.fcMin,
    beta: DEFAULT_SETTINGS.beta,
    fcD: DEFAULT_SETTINGS.fcD,
  };
}
