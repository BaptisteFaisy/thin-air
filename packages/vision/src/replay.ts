/**
 * Rejouer une prise comme si les mains étaient devant la caméra (AIR-F-48).
 * C'est le fantôme de la page (P11) et la preuve de bout en bout (§13.1,
 * niveau 3) : la source rend des `VisionFrame` au même format que la caméra,
 * donc le moteur en aval est exactement le même, sans modèle et sans image.
 *
 * Déterminisme : l'horloge et le minuteur sont injectables (`now`,
 * `schedule`), la planification est calculée par `replayTimeline`. Une même
 * prise rejouée avec la même horloge redonne les mêmes images, dans le même
 * ordre, à la même cadence.
 */
import type { Take, TakeFrame } from "@thin-air/core";
import {
  emptyFrame,
  FrameHub,
  defaultNow,
  frameAt,
  type FrameListener,
  type HandSource,
} from "./source.js";

export interface ReplayOptions {
  /** Vitesse de rejeu ; 0,5 pour montrer la scène au ralenti. */
  readonly speed?: number;
  readonly loop?: boolean;
  /** Horloge injectable, pour les tests déterministes. */
  readonly now?: () => number;
  /** Minuteur injectable : programme un rappel, rend la fonction qui l'annule. */
  readonly schedule?: (fn: () => void, delayMs: number) => () => void;
}

export interface ReplayStep {
  /** Instant du rappel, en ms sur l'horloge de rejeu (vitesse comprise). */
  readonly atMs: number;
  readonly frame: TakeFrame;
}

/** Une vitesse absurde ne doit pas diviser par zéro ni inverser le temps. */
function vitesseUtile(speed: number | undefined): number {
  if (speed === undefined || !Number.isFinite(speed) || speed <= 0) return 1;
  return speed;
}

/**
 * Le plan de rejeu : une entrée par image de la prise, à l'instant où elle
 * doit être émise. Pur — c'est lui que les tests comparent.
 */
export function replayTimeline(take: Take, options: ReplayOptions = {}): readonly ReplayStep[] {
  const vitesse = vitesseUtile(options.speed);
  return take.frames.map((frame) => ({ atMs: (frame.t * 1000) / vitesse, frame }));
}

/** Minuteur par défaut. */
export const scheduleDefault: (fn: () => void, delayMs: number) => () => void = (fn, delayMs) => {
  const id = setTimeout(fn, delayMs);
  return () => clearTimeout(id);
};

/** L'instant de fin d'un passage, en ms sur l'horloge de rejeu. */
export function replayDurationMs(timeline: readonly ReplayStep[]): number {
  const dernier = timeline[timeline.length - 1];
  return dernier === undefined ? 0 : dernier.atMs;
}

/** Le rejeu est une source de mains, avec son plan en clair. */
export interface ReplaySource extends HandSource {
  readonly kind: "replay";
  readonly timeline: readonly ReplayStep[];
}

/** Pas minimal entre deux images : `t` ne redescend jamais, même en boucle. */
const PAS_MIN_S = 1e-4;

/**
 * La source de rejeu. `t` porte le temps réel écoulé depuis le départ, jamais
 * l'instant de la prise : il reste donc croissant, y compris en boucle, et le
 * filtre en aval lit une horloge cohérente (§7.5).
 */
class ReplayRunner implements ReplaySource {
  readonly kind = "replay";
  readonly timeline: readonly ReplayStep[];
  readonly #hub = new FrameHub();
  readonly #now: () => number;
  readonly #schedule: (fn: () => void, delayMs: number) => () => void;
  readonly #boucle: boolean;
  #enMarche = false;
  #annuler: (() => void) | null = null;
  #departMs = 0;
  #horlogeMs = 0;
  #index = 0;
  #dernierT = 0;

  constructor(take: Take, options: ReplayOptions) {
    this.#now = options.now ?? defaultNow;
    this.#schedule = options.schedule ?? scheduleDefault;
    this.#boucle = options.loop ?? false;
    this.timeline = replayTimeline(take, options);
  }

  #instant(): number {
    const brut = (this.#now() - this.#horlogeMs) / 1000;
    this.#dernierT = brut > this.#dernierT ? brut : this.#dernierT + PAS_MIN_S;
    return this.#dernierT;
  }

  #emettreImage(step: ReplayStep): void {
    this.#hub.emit(frameAt(this.#instant(), step.frame.hands, 0));
  }

  /** Fin de partie : une image sans main, pour qu'aucune note ne reste tenue. */
  #terminer(): void {
    this.#enMarche = false;
    this.#annuler = null;
    this.#hub.emit(emptyFrame(this.#instant()));
  }

  #pompe(): void {
    if (!this.#enMarche) return;
    this.#annuler = null;
    this.#emettreImagesDues();
    if (this.#index < this.timeline.length) {
      this.#programmerSuivante();
      return;
    }
    if (this.#boucle && this.timeline.length > 0) {
      this.#index = 0;
      this.#departMs = this.#now();
      this.#annuler = this.#schedule(() => this.#pompe(), 0);
      return;
    }
    this.#terminer();
  }

  #emettreImagesDues(): void {
    const ecoule = this.#now() - this.#departMs;
    while (this.#index < this.timeline.length) {
      const step = this.timeline[this.#index];
      if (step === undefined || step.atMs > ecoule) break;
      this.#index += 1;
      this.#emettreImage(step);
    }
  }

  #programmerSuivante(): void {
    const suivant = this.timeline[this.#index];
    const delai = Math.max(0, (suivant?.atMs ?? 0) - (this.#now() - this.#departMs));
    this.#annuler = this.#schedule(() => this.#pompe(), delai);
  }

  async start(): Promise<void> {
    if (this.#enMarche) return;
    if (this.#horlogeMs === 0) this.#horlogeMs = this.#now();
    this.#enMarche = true;
    this.#index = 0;
    this.#departMs = this.#now();
    if (this.timeline.length === 0) {
      this.#terminer();
      return;
    }
    this.#annuler = this.#schedule(() => this.#pompe(), 0);
  }

  stop(): void {
    this.#annuler?.();
    this.#annuler = null;
    if (!this.#enMarche) return;
    this.#enMarche = false;
    this.#index = 0;
    this.#hub.emit(emptyFrame(this.#instant()));
  }

  onFrame(listener: FrameListener): () => void {
    return this.#hub.onFrame(listener);
  }
}

/** Construit la source de rejeu d'une prise. */
export function createReplaySource(take: Take, options: ReplayOptions = {}): ReplaySource {
  return new ReplayRunner(take, options);
}
