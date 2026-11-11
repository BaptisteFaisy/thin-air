/**
 * Le contrat commun des sources de mains : caméra, pointeur, clavier, rejeu.
 *
 * Les types `VisionFrame`, `FrameListener` et `HandSource` sont figés
 * (docs/CONTRACT.md) : le moteur en aval ne connaît qu'eux, ce qui rend le jeu
 * au pointeur et le rejeu strictement équivalents à la caméra (AIR-F-02, 48).
 * Le reste de ce fichier est interne au paquet : horloge, images vides,
 * diffusion aux abonnés.
 */
import type { DetectedHand } from "@thin-air/core";

export interface VisionFrame {
  /** Horodatage en secondes, monotone : c'est lui que lit le filtre (§7.5). */
  readonly t: number;
  readonly hands: readonly DetectedHand[];
  /** Temps d'analyse du modèle, en ms ; 0 pour une source sans modèle. */
  readonly inferenceMs: number;
}

export type FrameListener = (frame: VisionFrame) => void;

export interface HandSource {
  readonly kind: "camera" | "pointer" | "keyboard" | "replay";
  start(): Promise<void>;
  stop(): void;
  onFrame(listener: FrameListener): () => void;
}

/**
 * Horloge de la couche vision, en millisecondes. `core` n'en lit jamais
 * (AIR-N-09) : elle est ici, dans l'enveloppe, et injectable pour les tests.
 */
export function defaultNow(): number {
  const perf = globalThis.performance;
  if (perf !== undefined && typeof perf.now === "function") return perf.now();
  return Date.now();
}

/** Une image datée. */
export function frameAt(t: number, hands: readonly DetectedHand[], inferenceMs = 0): VisionFrame {
  return { t, hands, inferenceMs };
}

/**
 * L'image du silence : aucune main. Une source qui s'arrête, se met en pause
 * ou perd sa caméra l'émet une fois, pour que le moteur en aval relâche ses
 * voix au lieu de les laisser sonner (AIR-N-08, P6).
 */
export function emptyFrame(t: number): VisionFrame {
  return { t, hands: [], inferenceMs: 0 };
}

/**
 * Diffusion des images aux abonnés. Une copie de la liste est prise à chaque
 * émission : un abonné qui se retire pendant l'appel ne perturbe pas les
 * autres, et n'est jamais rappelé.
 */
export class FrameHub {
  readonly #listeners = new Set<FrameListener>();

  onFrame(listener: FrameListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  get size(): number {
    return this.#listeners.size;
  }

  /**
   * Émet une image. Un abonné qui échoue n'empêche pas les autres d'être
   * servis (l'affichage ne doit pas dépendre du moteur) : les erreurs sont
   * regroupées et relancées ensuite, donc jamais avalées.
   */
  emit(frame: VisionFrame): void {
    const erreurs: unknown[] = [];
    for (const listener of [...this.#listeners]) {
      try {
        listener(frame);
      } catch (erreur) {
        erreurs.push(erreur);
      }
    }
    if (erreurs.length === 1) throw erreurs[0];
    if (erreurs.length > 1) throw new AggregateError(erreurs, String((erreurs[0] as Error)?.message));
  }
}
