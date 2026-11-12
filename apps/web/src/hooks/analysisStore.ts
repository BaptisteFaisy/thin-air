/**
 * Le pont entre la mesure (côté vision, `useSession`) et l'affichage du retard
 * (`LatencyReadout`). Un petit magasin au niveau du module : la séance y pousse
 * une mesure par image (sans React), la sonde de retard le publie environ une
 * fois par seconde, et le compteur s'y abonne. Aucune horloge, aucun DOM : la
 * fenêtre glissante (moyenne, maximum, histogramme) vit dans `@thin-air/vision`
 * (`analysis-history`) et y est testée. Le vocabulaire affiché reste celui du
 * cahier §5.4 : ce qui est mesuré est dit mesuré.
 */
import {
  createAnalysisHistory,
  type AnalysisMode,
  type AnalysisSample,
  type AnalysisSnapshot,
} from "@thin-air/vision";

/** Ce que lit le compteur de retard : où tourne l'analyse, et ses mesures. */
export interface AnalysisView {
  /** `worker`, `main` (repli sur le fil principal), ou `null` (caméra inactive). */
  readonly thread: AnalysisMode | null;
  /** Moyenne, maximum et histogramme sur les 60 dernières images (§5.4). */
  readonly snapshot: AnalysisSnapshot;
}

const historique = createAnalysisHistory();
let thread: AnalysisMode | null = null;
let courant: AnalysisView = { thread: null, snapshot: historique.snapshot() };
const abonnes = new Set<() => void>();

/**
 * Une image analysée : `useSession` appelle ceci à chaque image. Léger (pas de
 * React, pas de rendu) : la publication, elle, est espacée par la sonde.
 */
export function pousserAnalyse(mesure: AnalysisSample, mode: AnalysisMode | null): void {
  historique.push(mesure);
  thread = mode;
}

/** Recompose l'état courant et réveille le compteur (appelé ~1×/s). */
export function publierAnalyse(): void {
  courant = { thread, snapshot: historique.snapshot() };
  for (const abonne of abonnes) abonne();
}

/** L'état courant, stable entre deux publications (pour `useSyncExternalStore`). */
export function lireAnalyse(): AnalysisView {
  return courant;
}

export function suivreAnalyse(abonne: () => void): () => void {
  abonnes.add(abonne);
  return () => {
    abonnes.delete(abonne);
  };
}

/** Remet à zéro : nouvelle séance, ou caméra arrêtée. */
export function reinitialiserAnalyse(): void {
  historique.reset();
  thread = null;
  publierAnalyse();
}
