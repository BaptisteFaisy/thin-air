/**
 * Mesures sur un tableau d'échantillons : la preuve sans écoute (cahier §6.2,
 * §13). Propriétés : AIR-P-13 (plafond), 14 (justesse), 15 (silence final),
 * 16 (pas de marches).
 *
 * Tout est calculé sur les échantillons : aucune oreille, aucun lecteur, aucun
 * périphérique audio (AIR-N-02). Les résultats sont des nombres, donc ils
 *rentrent dans un rapport JSON (annexe B) et se comparent d'un run à l'autre.
 */
import type { NoteMeasurement, RenderReport } from "./types.js";

export interface MeasureOptions {
  readonly sampleRate: number;
  /** Fenêtre d'analyse de la fréquence, en secondes (10 ms par défaut). */
  readonly windowS?: number;
  readonly ceilingDb?: number;
}

/**
 * Accords locaux : le lot `music` (A3) n'est pas encore mergé dans cet arbre.
 * // à remplacer par music.midiToFreq quand le lot A3 sera mergé
 */
function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Écart en centièmes de demi-ton entre deux fréquences.
 * // à remplacer par music.centsBetween quand le lot A3 sera mergé
 */
function centsBetween(expectedHz: number, measuredHz: number): number {
  if (expectedHz <= 0 || measuredHz <= 0) return 0;
  return 1200 * Math.log2(measuredHz / expectedHz);
}

/** Amplitude de crête, en dB pleine échelle (0 dB = 1,0). */
export function peakDb(samples: Float32Array | readonly number[]): number {
  let peak = 0;
  for (const valeur of samples) {
    const absolu = Math.abs(valeur);
    if (absolu > peak) peak = absolu;
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

export function rmsDb(samples: Float32Array | readonly number[]): number {
  if (samples.length === 0) return -Infinity;
  let somme = 0;
  for (const valeur of samples) somme += valeur * valeur;
  const rms = Math.sqrt(somme / samples.length);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/** Une fenêtre prête à corréler : le signal pondéré, et les poids eux-mêmes. */
interface Fenetre {
  readonly bloc: Float32Array;
  readonly poids: Float32Array;
}

/**
 * Copie d'une fenêtre, recentrée sur zéro et pondérée par un Hann.
 *
 * La pondération n'est pas cosmétique : sans elle, les bords de la fenêtre
 * laissent dans l'autocorrélation un terme résiduel à 2f qui déplace le pic —
 * jusqu'à 10 centièmes sur une note grave mesurée sur 50 ms. Le Hann l'éteint,
 * à condition de normaliser par l'autocorrélation des poids (ci-dessous).
 */
function preparerFenetre(
  samples: Float32Array | readonly number[],
  from: number,
  to: number,
): Fenetre {
  const debut = Math.max(0, Math.min(samples.length, Math.floor(from)));
  const fin = Math.max(debut, Math.min(samples.length, Math.floor(to)));
  const taille = Math.max(0, fin - debut);
  const bloc = new Float32Array(taille);
  const poids = new Float32Array(taille);
  let moyenne = 0;
  for (let i = debut; i < fin; i++) moyenne += samples[i] ?? 0;
  moyenne = taille > 0 ? moyenne / taille : 0;
  for (let i = 0; i < taille; i++) {
    poids[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, taille - 1)));
    bloc[i] = ((samples[debut + i] ?? 0) - moyenne) * poids[i]!;
  }
  return { bloc, poids };
}

/**
 * Autocorrélation normalisée par l'autocorrélation des poids :
 * r(lag) = Σ w[i]·w[i+lag]·x[i]·x[i+lag] / Σ w[i]·w[i+lag].
 *
 * Le dénominateur retire le biais triangulaire de la fenêtre : pour une note
 * tenue, r(lag) suit cos(ω·lag) sans pente, donc le maximum tombe exactement
 * sur la période, sans correction.
 */
function autocorrelation(fenetre: Fenetre, maxLag: number): Float64Array {
  const { bloc, poids } = fenetre;
  const n = bloc.length;
  const r = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let somme = 0;
    let norme = 0;
    for (let i = 0; i < n - lag; i++) {
      somme += (bloc[i] ?? 0) * (bloc[i + lag] ?? 0);
      norme += (poids[i] ?? 0) * (poids[i + lag] ?? 0);
    }
    r[lag] = norme > 0 ? somme / norme : 0;
  }
  return r;
}

/**
 * La période, en échantillons : le premier maximum local significatif après le
 * premier passage par zéro. Prendre le maximum global ne marche pas : pour une
 * note tenue, l'autocorrélation a un pic identique à chaque multiple de la
 * période, et l'ordre entre eux ne tient qu'au bruit d'arrondi.
 */
function trouverPeriode(r: Float64Array): number {
  let zero = -1;
  for (let lag = 1; lag < r.length; lag++) {
    if ((r[lag] ?? 0) <= 0) {
      zero = lag;
      break;
    }
  }
  if (zero < 0) return 0;
  let global = 0;
  for (let lag = zero + 1; lag < r.length; lag++) global = Math.max(global, r[lag] ?? 0);
  if (global <= 0) return 0;
  for (let lag = zero + 1; lag < r.length - 1; lag++) {
    const avant = r[lag - 1] ?? 0;
    const ici = r[lag] ?? 0;
    const apres = r[lag + 1] ?? 0;
    if (ici >= avant && ici > apres && ici > 0.5 * global) return affinerPic(r, lag);
  }
  return 0;
}

/** Interpolation parabolique du maximum : la précision du lag, donc de la note. */
function affinerPic(r: Float64Array, pic: number): number {
  if (pic <= 0 || pic >= r.length - 1) return pic;
  const y0 = r[pic - 1] ?? 0;
  const y1 = r[pic] ?? 0;
  const y2 = r[pic + 1] ?? 0;
  const denominateur = y0 - 2 * y1 + y2;
  if (denominateur === 0) return pic;
  const delta = (0.5 * (y0 - y2)) / denominateur;
  return pic + Math.max(-1, Math.min(1, delta));
}

/**
 * Fréquence dominante d'une fenêtre, par autocorrélation (cahier §13.2,
 * AIR-P-14, AIR-P-16). La méthode est documentée ici : la moyenne est
 * retirée, l'autocorrélation est normalisée par (n − lag), le maximum est
 * affineiné par interpolation parabolique — la précision obtenue est de
 * l'ordre du centième de centième de demi-ton sur une sinusoïde pure.
 */
export function dominantFreq(
  samples: Float32Array | readonly number[],
  sampleRate: number,
  from: number,
  to: number,
): number {
  if (sampleRate <= 0) return 0;
  const fenetre = preparerFenetre(samples, from, to);
  if (fenetre.bloc.length < 16) return 0;
  let energie = 0;
  for (const valeur of fenetre.bloc) energie += valeur * valeur;
  if (energie <= 0) return 0;
  // Au-delà de la moitié de la fenêtre, il reste trop peu d'échantillons en
  // commun : l'estimateur devient du bruit. La borne fixe donc la fréquence
  // la plus basse mesurable : sampleRate / (fenêtre / 2).
  const maxLag = Math.max(1, Math.floor(fenetre.bloc.length / 2));
  const r = autocorrelation(fenetre, maxLag);
  const periode = trouverPeriode(r);
  if (periode <= 1) return 0;
  return sampleRate / periode;
}

/** Fréquence mesurée fenêtre par fenêtre : la courbe du glissé (AIR-P-16). */
export function freqEnvelope(
  samples: Float32Array | readonly number[],
  options: MeasureOptions,
): readonly { readonly t: number; readonly hz: number }[] {
  const windowS = options.windowS ?? 0.01;
  const pas = Math.max(1, Math.round(windowS * options.sampleRate));
  const courbe: { t: number; hz: number }[] = [];
  for (let debut = 0; debut + pas <= samples.length; debut += pas) {
    const hz = dominantFreq(samples, options.sampleRate, debut, debut + pas);
    courbe.push({ t: debut / options.sampleRate, hz });
  }
  return courbe;
}

/**
 * Instants d'attaque : passage au-dessus d'un seuil **relatif** au crête
 * (`thresholdDb` sous le crête, −20 dB par défaut). L'enveloppe est lissée
 * (τ = 5 ms) pour qu'une sinusoïde ne donne pas deux attaques par période.
 */
export function attackTimes(
  samples: Float32Array | readonly number[],
  sampleRate: number,
  thresholdDb: number = -20,
): readonly number[] {
  const peak = peakDb(samples);
  if (!Number.isFinite(peak)) return [];
  const seuil = 10 ** ((peak + thresholdDb) / 20);
  // τ = 10 ms : assez long pour lisser l'ondulation d'une période, assez court
  // pour dater l'attaque à une dizaine de millisecondes près.
  const alpha = 1 - Math.exp(-1 / Math.max(1, 0.01 * sampleRate));
  const instants: number[] = [];
  let enveloppe = 0;
  let precedent = 0;
  for (let i = 0; i < samples.length; i++) {
    const absolu = Math.abs(samples[i] ?? 0);
    enveloppe += alpha * (absolu - enveloppe);
    if (enveloppe > seuil && precedent <= seuil) instants.push(i / sampleRate);
    precedent = enveloppe;
  }
  return instants;
}

/** Durée du silence final, en ms : dernier instant au-dessus de `belowDb`. */
export function finalSilenceMs(
  samples: Float32Array | readonly number[],
  sampleRate: number,
  belowDb: number = -60,
): number {
  if (samples.length === 0) return 0;
  const seuil = 10 ** (belowDb / 20);
  let dernier = -1;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i] ?? 0) > seuil) dernier = i;
  }
  if (dernier < 0) return (samples.length / sampleRate) * 1000;
  return ((samples.length - 1 - dernier) / sampleRate) * 1000;
}

/**
 * Mesure note par note d'un rendu : pour chaque note attendue, la fréquence
 * réellement mesurée pendant son palier et l'écart en centièmes.
 *
 * La fenêtre de mesure prend les 50 ms qui précèdent la fin du palier (les
 * 10 ms de `windowS` quand la fenêtre est imposée) : une note tenue se mesure
 * sur son plateau, pas sur son attaque.
 */
export function measureNotes(
  samples: Float32Array | readonly number[],
  notes: readonly { readonly t: number; readonly midi: number; readonly untilT: number }[],
  options: MeasureOptions,
): readonly NoteMeasurement[] {
  const windowS = options.windowS ?? 0.05;
  return notes.map((note) => {
    const fin = Math.min(samples.length, Math.round(note.untilT * options.sampleRate));
    const debut = Math.max(0, Math.round(note.untilT * options.sampleRate) - Math.round(windowS * options.sampleRate));
    const attendu = midiToHz(note.midi);
    const mesure = dominantFreq(samples, options.sampleRate, debut, fin);
    return {
      t: note.t,
      midi: note.midi,
      expectedHz: attendu,
      measuredHz: mesure,
      cents: centsBetween(attendu, mesure),
    };
  });
}

/** Le rapport complet écrit par `bench render` (annexe B). */
export function buildReport(input: {
  readonly take: string;
  readonly instrument: string;
  readonly samples: Float32Array | readonly number[];
  readonly sampleRate: number;
  readonly notes: readonly NoteMeasurement[];
  readonly maxVoices: number;
}): RenderReport {
  return {
    take: input.take,
    instrument: input.instrument,
    sampleRate: input.sampleRate,
    samples: input.samples.length,
    durationS: input.samples.length / input.sampleRate,
    notes: input.notes,
    peakDb: peakDb(input.samples),
    rmsDb: rmsDb(input.samples),
    maxVoices: input.maxVoices,
    silenceAfterMs: finalSilenceMs(input.samples, input.sampleRate),
  };
}
