/**
 * Leçon « viser juste » (cahier §5.3, §7.7, parcours P5).
 *
 * Jouer juste dans le vide est très difficile : sur 80 cm de portée, un
 * demi-ton tient dans 2,2 cm, et un tremblement de 0,5 % de la largeur déplace
 * la note de 18 centièmes — ça s'entend. D'où l'aimant par défaut. Cette leçon
 * montre l'écart entre la note visée (continue) et la note jouée (aimantée),
 * en centièmes de demi-ton, pour une position de la main et une force d'aimant.
 */
import { applyMagnet, centsBetween, midiToFreq, noteName, pitchFromU, quantizeToScale } from "@thin-air/core";
import type { InstrumentRange, InstrumentScale } from "@thin-air/core";

export interface CentsLessonResult {
  /** Hauteur continue visée, en numéro de note (peut être fractionnaire). */
  readonly visee: number;
  /** Note de la gamme la plus proche. */
  readonly aimantee: number;
  /** Hauteur réellement émise, entre les deux selon la force de l'aimant. */
  readonly jouee: number;
  readonly ecartCents: number;
  readonly frequenceJouee: number;
  readonly nom: string;
}

export function buildCentsLesson(
  u: number,
  scale: InstrumentScale,
  range: InstrumentRange,
  magnet: number,
  hysteresis = 0,
): CentsLessonResult {
  const visee = pitchFromU(u, range);
  const aimantee = quantizeToScale(visee, scale.root, scale.steps, hysteresis);
  const jouee = applyMagnet(visee, aimantee, magnet);
  return {
    visee,
    aimantee,
    jouee,
    ecartCents: centsBetween(midiToFreq(aimantee), midiToFreq(jouee)),
    frequenceJouee: midiToFreq(jouee),
    nom: noteName(Math.round(jouee)),
  };
}

/**
 * Balayage de la leçon : l'écart en centièmes pour chaque position de 0 à 1, à
 * plusieurs forces d'aimant. C'est ce que le tracé dessine — et ce qui montre
 * qu'à aimant 1 l'écart est nul partout, alors qu'à aimant 0 il atteint un
 * demi-ton (50 centièmes) entre deux notes.
 */
export function sweepCents(
  scale: InstrumentScale,
  range: InstrumentRange,
  magnet: number,
  pas = 0.02,
): readonly { readonly u: number; readonly cents: number }[] {
  const points: { u: number; cents: number }[] = [];
  for (let u = 0; u <= 1 + pas / 2; u += pas) {
    points.push({ u: Math.min(1, u), cents: buildCentsLesson(Math.min(1, u), scale, range, magnet).ecartCents });
  }
  return points;
}

/** Ce que le §5.3 annonce : 0,5 % de la largeur déplace la note de 18 centièmes. */
export function tremblementEnCents(fractionLargeur: number, demiTonsSurLargeur: number): number {
  return fractionLargeur * demiTonsSurLargeur * 100;
}
