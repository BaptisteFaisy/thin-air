/**
 * Leçon « le filtrage » (cahier §7.5, parcours P5).
 *
 * Ce que la leçon montre, en nombres : les points d'une main tremblent même
 * main immobile ; lisser fort supprime le tremblement mais fait traîner le
 * geste. Le filtre adaptatif règle ce compromis en lissant fort quand la main
 * est lente et peu quand elle est rapide — d'où DEUX canaux (§7.5) : le lissé
 * pour les réglages continus, le vif pour les déclenchements.
 *
 * Logique pure, sans React ni DOM : les séries produites sont prêtes à dessiner,
 * et les trois nombres affichés sont calculés, jamais illustrés au jugé.
 */
import { FeatureTracker, alphaFor } from "@thin-air/core";
import { DEFAULT_SETTINGS, defaultPlayRect, withSettings } from "@thin-air/core";
import { tremorTake, poseFromPlay } from "@thin-air/core";
import type { Settings } from "@thin-air/core";

export interface PointSerie {
  readonly t: number;
  readonly u: number;
}

export interface FilterLessonResult {
  readonly brut: readonly PointSerie[];
  readonly lisse: readonly PointSerie[];
  readonly vif: readonly PointSerie[];
  /** Écart-type du tremblement, en largeurs de zone. */
  readonly ecartTypeBrut: number;
  readonly ecartTypeLisse: number;
  readonly ecartTypeVif: number;
  /** Retard du pic de réponse, en ms, sur un mouvement brusque. */
  readonly retardLisseMs: number;
  readonly retardVifMs: number;
  /** α à l'arrêt et à une largeur de zone par seconde (tableau du §7.5). */
  readonly alphaArret: number;
  readonly alphaRapide: number;
}

export function ecartType(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  const variance = valeurs.reduce((a, b) => a + (b - moyenne) ** 2, 0) / valeurs.length;
  return Math.sqrt(variance);
}

/**
 * Construit la leçon pour une amplitude de tremblement donnée (fraction de la
 * largeur de l'image) et une graine fixe : deux appels donnent les mêmes
 * nombres (AIR-N-09), ce qui permet de les afficher et de les tester.
 */
export function buildFilterLesson(
  amplitude = 0.01,
  options?: { readonly reglages?: Partial<Settings>; readonly seed?: number; readonly durationS?: number },
): FilterLessonResult {
  const settings = withSettings(options?.reglages);
  const rect = defaultPlayRect();
  const prise = tremorTake(poseFromPlay(0.5, 0.5, { scale: 0.05 }), amplitude, {
    fps: 30,
    durationS: options?.durationS ?? 2,
    seed: options?.seed ?? 7,
  });
  const tracker = new FeatureTracker(rect, 4 / 3, settings, "palm");
  const brut: PointSerie[] = [];
  const lisse: PointSerie[] = [];
  const vif: PointSerie[] = [];
  for (const image of prise.frames) {
    const main = image.hands[0];
    if (!main) continue;
    const { smooth, fast } = tracker.push(image.t, main);
    const uBrut = trackerRawU(main.points[9] ?? [0.5, 0.5, 0], rect);
    brut.push({ t: image.t, u: uBrut });
    lisse.push({ t: image.t, u: smooth.u });
    vif.push({ t: image.t, u: fast.u });
  }
  const te = 1 / (prise.fps || 30);
  return {
    brut,
    lisse,
    vif,
    ecartTypeBrut: ecartType(brut.map((p) => p.u)),
    ecartTypeLisse: ecartType(lisse.map((p) => p.u)),
    ecartTypeVif: ecartType(vif.map((p) => p.u)),
    retardLisseMs: retardDePic(brut, lisse) * 1000,
    retardVifMs: retardDePic(brut, vif) * 1000,
    alphaArret: alphaFor(settings.fcMin, te),
    alphaRapide: alphaFor(settings.fcMin + settings.beta * 1, te),
  };
}

/** Position brute dans la zone de jeu, sans filtrage : la référence visuelle. */
function trackerRawU(point: readonly number[], rect: { u0: number; u1: number }): number {
  const ecranX = 1 - point[0]!;
  const span = rect.u1 - rect.u0;
  return span > 0 ? Math.min(1, Math.max(0, (ecranX - rect.u0) / span)) : 0;
}

/** Décalage, en images, entre l'extrême de la série brute et celui de la série filtrée. */
function retardDePic(brut: readonly PointSerie[], filtree: readonly PointSerie[]): number {
  if (brut.length === 0 || filtree.length === 0) return 0;
  const indiceMax = (serie: readonly PointSerie[]): number =>
    serie.reduce((meilleur, p, i) => (Math.abs(p.u - 0.5) > Math.abs((serie[meilleur]?.u ?? 0.5) - 0.5) ? i : meilleur), 0);
  const pas = brut.length > 1 ? brut[1]!.t - brut[0]!.t : 1 / 30;
  return Math.max(0, indiceMax(filtree) - indiceMax(brut)) * pas;
}
