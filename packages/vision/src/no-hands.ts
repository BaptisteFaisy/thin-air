/**
 * Le conseil « plus de lumière ou plus de recul » (cahier §7.2, AIR-F-06).
 *
 * Règle : SI aucune main n'est reconnue pendant trois secondes ALORS QUE
 * l'image change, ALORS conseiller. La condition « l'image change » est portée
 * par l'appelant : il n'appelle `push` que sur une image nouvelle
 * (`newFrame: false` ignore la mesure). Une série noire ne déclenche le
 * conseil qu'une seule fois ; il se réarme dès qu'une main réapparaît.
 */
export interface NoHandsOptions {
  /** Seuil en secondes (3 dans le cahier). */
  readonly thresholdS?: number;
}

export interface NoHandsPush {
  /** Instant, en secondes, sur la même horloge que `VisionFrame.t`. */
  readonly t: number;
  readonly hasHands: boolean;
  /** Cette mesure porte-t-elle sur une image réellement nouvelle ? */
  readonly newFrame: boolean;
}

export interface NoHandsWatcher {
  /** Le seuil franchi (3 s), une fois par série, sinon `null`. */
  push(input: NoHandsPush): number | null;
  /** Remet à zéro : nouvelle session, ou image redevenue parlante. */
  reset(t?: number): void;
  /** Silence en cours, en secondes ; 0 dès qu'une main est vue. */
  readonly silentForS: number;
}

const SEUIL_DEFAUT = 3;

export function createNoHandsWatcher(options: NoHandsOptions = {}): NoHandsWatcher {
  const seuil = options.thresholdS ?? SEUIL_DEFAUT;
  let derniereMain = Number.NaN;
  let alerteDonnee = false;
  let dernierT = Number.NaN;

  function push(input: NoHandsPush): number | null {
    if (!input.newFrame) return null;
    dernierT = input.t;
    // L'horloge du silence démarre à la première image mesurée : jouer dans
    // le noir doit aussi conseiller (P6), pas seulement perdre la main.
    if (Number.isNaN(derniereMain)) derniereMain = input.t;
    if (input.hasHands) {
      derniereMain = input.t;
      alerteDonnee = false;
      return null;
    }
    if (alerteDonnee) return null;
    if (dernierT - derniereMain < seuil) return null;
    alerteDonnee = true;
    return seuil;
  }

  function reset(t = Number.NaN): void {
    derniereMain = t;
    dernierT = t;
    alerteDonnee = false;
  }

  return {
    push,
    reset,
    get silentForS() {
      if (Number.isNaN(derniereMain) || Number.isNaN(dernierT)) return 0;
      const silence = dernierT - derniereMain;
      return silence > 0 ? silence : 0;
    },
  };
}
