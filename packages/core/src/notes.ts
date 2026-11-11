/**
 * Primitives musicales de l'instrument, en attendant `music` (lot A3).
 *
 * Le lot A3 écrit `music.ts` (fréquences, gammes, aimant, échelle de volume)
 * et ses tests sur une branche sœur : ces fonctions ne sont pas encore dans
 * cet arbre. Les formules du cahier §7.7 sont donc recalculées **ici, et
 * seulement ici**, pour que la chaîne instrument → événements soit testable
 * dès maintenant.
 *
 * À la fusion de `music.ts`, chaque fonction ci-dessous se remplace par son
 * équivalent (`pitchFromU`, `gainFromV`, `degreeToMidi`, `ScaleSnapper`) et
 * ce fichier disparaît : une seule implémentation par logique (contrat,
 * règle 4). Les autres modules n'importent que par ce fichier, donc le
 * remplacement tient en un point.
 */
import type { FeatureMap, FeatureName, InstrumentRange, TrackedHand } from "./types.js";
import { clamp01 } from "./space.js";

/**
 * Notes de rechange quand `music` (lot A3) n'est pas encore dans l'arbre : les
 * formules du cahier §7.7 sont recalculées ici, et seulement ici. À la fusion
 * du lot A3, ces cinq fonctions se remplacent par `music.pitchFromU`,
 * `music.gainFromV`, `music.degreeToMidi`, `music.ScaleSnapper` et
 * `music.clampToRange` — une seule implémentation par logique, à terme.
 */

/** §7.7 : m(u) = m_bas + (m_haut − m_bas) × u. */
export function pitchFromPosition(u: number, range: InstrumentRange): number {
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  return low + (high - low) * clamp01(u);
}

/** §7.7 : dB = −48 × (1 − v), et silence sous 5 % de hauteur. */
export function gainFromPosition(v: number): number {
  const borne = clamp01(v);
  if (borne < 0.05) return 0;
  return 10 ** ((-48 * (1 - borne)) / 20);
}

/** §7.7 : le degré k donne root + 12 × ⌊k / n⌋ + steps[k mod n]. */
export function noteFromDegree(root: number, steps: readonly number[], degree: number): number {
  const n = steps.length;
  if (n === 0) return root;
  const octave = Math.floor(degree / n);
  return root + 12 * octave + (steps[degree - octave * n] ?? 0);
}

/**
 * Aimant avec mémoire et hystérésis (§7.6, §7.7) : la note ne change que
 * lorsque la hauteur a franchi le milieu entre deux notes voisines, décalé de
 * `hysteresis` fois leur écart. C'est ce qui empêche une main qui hésite de
 * faire basculer la note dix fois par seconde (AIR-P-06).
 */
export class NoteMagnet {
  private note: number | null = null;

  constructor(
    readonly root: number,
    readonly steps: readonly number[],
    readonly hysteresis: number,
    readonly amount: number,
    readonly range?: InstrumentRange,
  ) {}

  get snapped(): number | null {
    return this.note;
  }

  reset(): void {
    this.note = null;
  }

  /** Hauteur aimantée : `m + a × (q(m) − m)`, donc entière à 1 et pure à 0. */
  next(midi: number): number {
    const cible = this.nearest(midi);
    if (this.note === null) this.note = cible;
    else if (cible !== this.note) this.climb(midi, cible);

    const note = this.bounded(this.note);
    const a = clamp01(this.amount);
    if (a >= 1) return note;
    if (a <= 0) return midi;
    return midi + a * (note - midi);
  }

  /** Change de note seulement si le seuil du §7.6 est franchi. */
  private climb(midi: number, cible: number): void {
    const note = this.note as number;
    const dir = cible > note ? 1 : -1;
    const voisin = this.stepNote(note, dir);
    const milieu = (note + voisin) / 2;
    const seuil = milieu + (dir * Math.abs(voisin - note) * this.hysteresis);
    const passe = dir > 0 ? midi >= seuil : midi <= seuil;
    if (passe) this.note = cible;
  }

  /** Numéro MIDI de la note franche la plus proche. */
  private nearest(midi: number): number {
    return noteFromDegree(this.root, this.steps, this.nearestDegree(midi));
  }

  /** Degré de la note de la gamme la plus proche. */
  private nearestDegree(midi: number): number {
    const n = this.steps.length;
    if (n === 0) return 0;
    const approx = Math.round(((midi - this.root) / 12) * n);
    let meilleur = approx;
    let ecart = Math.abs(noteFromDegree(this.root, this.steps, approx) - midi);
    for (const delta of [-2, -1, 1, 2]) {
      const candidat = approx + delta;
      const distance = Math.abs(noteFromDegree(this.root, this.steps, candidat) - midi);
      if (distance < ecart - 1e-9) {
        ecart = distance;
        meilleur = candidat;
      }
    }
    return meilleur;
  }

  /** Note de la gamme immédiatement au-dessus (1) ou en dessous (−1). */
  private stepNote(note: number, dir: number): number {
    const depart = this.nearestDegree(note);
    for (let k = 1; k <= 24; k += 1) {
      const candidat = noteFromDegree(this.root, this.steps, depart + dir * k);
      if (dir > 0 ? candidat > note + 1e-9 : candidat < note - 1e-9) return candidat;
    }
    return note;
  }

  /** À l'aimant 1, aucune note ne sort de l'étendue (§13.2, AIR-P-05). */
  private bounded(note: number | null): number {
    const valeur = note ?? this.root;
    const range = this.range;
    if (!range) return valeur;
    const low = Math.min(range.low, range.high);
    const high = Math.max(range.low, range.high);
    if (valeur >= low && valeur <= high) return valeur;
    let degre = this.nearestDegree(valeur);
    for (let k = 0; k <= 32; k += 1) {
      const candidat = noteFromDegree(this.root, this.steps, degre);
      if (candidat >= low && candidat <= high) return candidat;
      degre += valeur < low ? 1 : -1;
    }
    return Math.min(high, Math.max(low, valeur));
  }
}

/** Valeur d'une mesure d'une main suivie (§7.6). */
export function featureValue(hand: TrackedHand, feature: FeatureName): number {
  switch (feature) {
    case "u":
      return hand.smooth.u;
    case "v":
      return hand.smooth.v;
    case "pinch":
      return hand.smooth.pinch;
    case "open":
      return hand.smooth.open;
    case "speedU":
      return hand.fast.speedU;
    case "speedV":
      return hand.fast.speedV;
    default:
      return 0;
  }
}

/**
 * Met la mesure à l'échelle de l'intervalle déclaré (`from` → `into`).
 * Les deux intervalles peuvent être décroissants : `from` [0,4 ; 0,1] vers
 * [0 ; 40] veut dire « plus on pince, plus il y a de vibrato ».
 */
export function scaleInto(x: number, map: FeatureMap): number {
  const from = map.from;
  const into = map.into;
  if (!from || !into) return x;
  const base = from[0] ?? 0;
  const span = (from[1] ?? 0) - base;
  const t = span === 0 ? 0 : clamp01((x - base) / span);
  const a = into[0] ?? 0;
  return a + ((into[1] ?? 0) - a) * t;
}

/** Valeur d'une cible continue lue sur une main, dans l'unité de la cible. */
export function controlValue(map: FeatureMap, hand: TrackedHand): number {
  const x = scaleInto(featureValue(hand, map.feature), map);
  if (map.to === "gain") return map.curve === "db48" ? gainFromPosition(x) : clamp01(x);
  return x;
}
