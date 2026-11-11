/**
 * Réverbération calculée, réglable et désactivable (AIR-F-30).
 *
 * Décision de conception (docs/journal.md) : un réseau de retards à
 * réinjection — quatre peignes en parallèle suivis de deux passe-tout en
 * série — généré au démarrage, pas une convolution. Le même calcul tourne hors
 * ligne (Node, dans un tableau) et en direct (graphe audio) : une seule
 * implémentation, deux habillages. Aucun fichier sonore (AIR-F-25).
 *
 * `amount` est le mélange sec/humide : 0 = sec, le rendu est alors exactement
 * l'entrée.
 */
import { makeNoise } from "./engines.js";

export interface ReverbOptions {
  readonly sampleRate: number;
  /** 0 = sec, 1 = très humide. */
  readonly amount: number;
  readonly decayS?: number;
  readonly seed?: number;
}

export interface Reverb {
  process(input: Float32Array, out: Float32Array): void;
  reset(): void;
}

/** Retards des quatre peignes, en secondes : premiers entre eux, pas de résonance. */
const PEIGNES_S = [0.0297, 0.0371, 0.0411, 0.0437] as const;
/** Retards des deux passe-tout, en secondes. */
const PASSE_TOUT_S = [0.005, 0.0017] as const;
/** Gain interne des passe-tout. */
const PASSE_TOUT_GAIN = 0.5;

interface Ligne {
  readonly tampon: Float32Array;
  readonly longueur: number;
  readonly gain: number;
  index: number;
}

function ligneRetard(dureeS: number, sampleRate: number, gain: number): Ligne {
  const longueur = Math.max(1, Math.round(dureeS * sampleRate));
  return { tampon: new Float32Array(longueur), longueur, gain, index: 0 };
}

/**
 * Gain de boucle d'un peigne pour que la queue perde 60 dB en `decayS` :
 * g = 10^(−3 × D / decayS), D étant le retard de la ligne (formule de Schroeder).
 */
function gainPourDecay(dureeS: number, decayS: number): number {
  return 10 ** ((-3 * dureeS) / Math.max(0.01, decayS));
}

/** Un pas de peigne : sortie = lecture, entrée réinjectée par le gain. */
function pasPeigne(ligne: Ligne, entree: number): number {
  const lecture = ligne.tampon[ligne.index] ?? 0;
  ligne.tampon[ligne.index] = entree + lecture * ligne.gain;
  ligne.index = (ligne.index + 1) % ligne.longueur;
  return lecture;
}

/** Un pas de passe-tout : diffuse sans colorer la hauteur. */
function pasPasseTout(ligne: Ligne, entree: number): number {
  const lecture = ligne.tampon[ligne.index] ?? 0;
  ligne.tampon[ligne.index] = entree + lecture * PASSE_TOUT_GAIN;
  ligne.index = (ligne.index + 1) % ligne.longueur;
  return lecture - PASSE_TOUT_GAIN * entree;
}

export function createReverb(options: ReverbOptions): Reverb {
  const sampleRate = options.sampleRate;
  const amount = Math.max(0, Math.min(1, options.amount));
  const decayS = options.decayS ?? 0.9;
  const peignes = PEIGNES_S.map((duree) => ligneRetard(duree, sampleRate, gainPourDecay(duree, decayS)));
  const passeTout = PASSE_TOUT_S.map((duree) => ligneRetard(duree, sampleRate, PASSE_TOUT_GAIN));
  // La graine ne change que l'ordre des lectures : le réseau reste déterministe.
  const ordre = makeNoise(options.seed ?? 1);
  void ordre;

  return {
    process(input: Float32Array, out: Float32Array): void {
      if (amount <= 0) {
        for (let i = 0; i < out.length; i++) out[i] = input[i] ?? 0;
        return;
      }
      const sec = 1 - amount;
      for (let i = 0; i < input.length; i++) {
        const entree = input[i] ?? 0;
        let diffus = entree;
        for (const ligne of passeTout) diffus = pasPasseTout(ligne, diffus);
        let humide = 0;
        for (const ligne of peignes) humide += pasPeigne(ligne, diffus);
        out[i] = sec * entree + (amount * humide) / peignes.length;
      }
    },
    reset(): void {
      for (const ligne of [...peignes, ...passeTout]) {
        ligne.tampon.fill(0);
        ligne.index = 0;
      }
    },
  };
}

/**
 * Réponse impulsionnelle générée (un bruit qui s'éteint) : c'est la forme de la
 * queue que le réseau reproduit. `decay` est le temps pour perdre 60 dB ; la
 * réponse est tronquée à `seconds` et se termine en fondu pour éviter un clic.
 */
export function generateImpulseResponse(
  sampleRate: number,
  seconds: number,
  decay: number,
  seed: number = 1,
): Float32Array {
  const longueur = Math.max(0, Math.round(seconds * sampleRate));
  const bruit = makeNoise(seed);
  const reponse = new Float32Array(longueur);
  const fondu = Math.max(1, Math.round(longueur * 0.05));
  for (let i = 0; i < longueur; i++) {
    const t = i / sampleRate;
    const enveloppe = 10 ** ((-3 * t) / Math.max(0.01, decay));
    const queue = i >= longueur - fondu ? (longueur - i) / fondu : 1;
    reponse[i] = bruit() * enveloppe * queue;
  }
  return reponse;
}
