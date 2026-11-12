/**
 * L'histogramme du temps d'analyse (cahier §5.4, AIR-F-31).
 *
 * Fenêtre glissante des N dernières images : moyenne, maximum et répartition
 * en classes. C'est ce qui rend le gain MESURABLE — le même module sert en mode
 * « worker » et en mode « fil principal », donc la comparaison porte sur les
 * mêmes grandeurs (temps d'analyse et intervalle d'images), pas sur deux
 * mesures définies différemment.
 *
 * Pur : aucune horloge, aucun DOM. Les tests l'alimentent image par image.
 * Déterministe : l'ordre d'insertion est conservé, les classes ont des bornes
 * fixes, et une fenêtre vide rend des zéros plutôt que `NaN`.
 */

/** Nombre d'images conservées par défaut (§5.4 : les 60 dernières). */
export const HISTORY_WINDOW = 60;

/** Bornes fixes des classes de l'histogramme, en ms (la dernière est ouverte). */
export const HISTOGRAM_BINS_MS: readonly number[] = [2, 5, 10, 20, 40, 80];

/** Une mesure par image : le temps d'analyse et l'intervalle de présentation. */
export interface AnalysisSample {
  /** Temps d'analyse du modèle, mesuré là où il tourne (worker ou page), ms. */
  readonly inferenceMs: number;
  /** Intervalle entre deux images présentées, mesuré sur le fil principal, ms. */
  readonly frameIntervalMs: number;
}

/** L'instantané lisible : ce qu'affiche le compteur de retard. */
export interface AnalysisSnapshot {
  /** Nombre d'images dans la fenêtre (0 à `window`). */
  readonly count: number;
  /** Taille de la fenêtre. */
  readonly window: number;
  /** Moyenne du temps d'analyse sur la fenêtre, ms. */
  readonly meanInferenceMs: number;
  /** Maximum du temps d'analyse sur la fenêtre, ms. */
  readonly maxInferenceMs: number;
  /** Moyenne de l'intervalle d'images sur la fenêtre, ms. */
  readonly meanFrameIntervalMs: number;
  /** Effectif par classe : `bins[i]` = images dont le temps tombe dans la i-ème. */
  readonly bins: readonly number[];
  /** Libellé des classes, pour l'affichage et les tests : « <2 », « 2–5 », …, « ≥80 ». */
  readonly binLabels: readonly string[];
}

/** Libellé d'une classe : bornes fixes, aucune surprise d'une exécution à l'autre. */
export function binLabels(bins: readonly number[] = HISTOGRAM_BINS_MS): readonly string[] {
  const labels: string[] = [];
  bins.forEach((borne, index) => {
    labels.push(index === 0 ? `<${borne}` : `${bins[index - 1]}–${borne}`);
  });
  labels.push(`≥${bins[bins.length - 1] ?? 0}`);
  return labels;
}

/** Dans quelle classe tombe ce temps d'analyse ? Indice de `bins`, ou `bins.length`. */
export function binIndexFor(inferenceMs: number, bins: readonly number[] = HISTOGRAM_BINS_MS): number {
  if (!Number.isFinite(inferenceMs) || inferenceMs < 0) return bins.length;
  for (let i = 0; i < bins.length; i += 1) {
    const borne = bins[i] as number;
    if (inferenceMs < borne) return i;
  }
  return bins.length;
}

function moyenne(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  let somme = 0;
  for (const valeur of valeurs) somme += valeur;
  return somme / valeurs.length;
}

function borne(valeur: number): number {
  return Number.isFinite(valeur) && valeur > 0 ? valeur : 0;
}

/**
 * La fenêtre glissante. `push` ajoute une image et fait sortir la plus ancienne
 * au-delà de `window` ; `snapshot` rend l'état courant, sans le muter.
 */
export interface AnalysisHistory {
  push(sample: AnalysisSample): void;
  /** Remet à zéro : nouvelle session, ou source qui redémarre. */
  reset(): void;
  snapshot(): AnalysisSnapshot;
  readonly size: number;
}

export function createAnalysisHistory(
  window: number = HISTORY_WINDOW,
  bins: readonly number[] = HISTOGRAM_BINS_MS,
): AnalysisHistory {
  const taille = Number.isFinite(window) && window > 0 ? Math.floor(window) : HISTORY_WINDOW;
  const analyses: number[] = [];
  const intervalles: number[] = [];

  function pousser(valeur: number, dans: number[]): void {
    dans.push(borne(valeur));
    if (dans.length > taille) dans.splice(0, dans.length - taille);
  }

  function instantane(): AnalysisSnapshot {
    const compteurs = new Array<number>(bins.length + 1).fill(0);
    for (const temps of analyses) {
      const classe = binIndexFor(temps, bins);
      compteurs[classe] = (compteurs[classe] ?? 0) + 1;
    }
    let max = 0;
    for (const temps of analyses) if (temps > max) max = temps;
    return {
      count: analyses.length,
      window: taille,
      meanInferenceMs: moyenne(analyses),
      maxInferenceMs: max,
      meanFrameIntervalMs: moyenne(intervalles),
      bins: compteurs,
      binLabels: binLabels(bins),
    };
  }

  return {
    push(sample) {
      pousser(sample.inferenceMs, analyses);
      pousser(sample.frameIntervalMs, intervalles);
    },
    reset() {
      analyses.length = 0;
      intervalles.length = 0;
    },
    snapshot: instantane,
    get size() {
      return analyses.length;
    },
  };
}
