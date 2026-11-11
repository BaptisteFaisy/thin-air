/**
 * Règle 2 de §7.9 : tout événement est daté sur l'horloge du son.
 *
 * Un minuteur passe toutes les 25 ms et programme les 100 ms qui viennent,
 * parce que les minuteurs du navigateur ne sont pas assez précis pour le
 * rythme : c'est l'horloge du son qui date, le minuteur ne fait que regarder
 * devant lui. `setTimeout` borné et réarmé après chaque passage — jamais un
 * `setInterval` naïf pour la datation.
 *
 * Le minuteur et l'horloge sont injectables : la logique d'ordonnancement se
 * teste dans Node, sans `AudioContext` ni navigateur (AIR-P-11).
 */
import type { MusicEvent } from "@thin-air/core";

/** L'horloge du son : `AudioContext.currentTime` en jeu direct. */
export interface SchedulerClock {
  now(): number;
}

/** Un minuteur borné : `setTimeout`/`clearTimeout` du navigateur en jeu direct. */
export interface SchedulerTimer {
  schedule(fn: () => void, delayMs: number): number;
  cancel(handle: number): void;
}

export interface LiveSchedulerOptions {
  /** Période du minuteur, ms (25). */
  readonly tickMs: number;
  /** Fenêtre programmée à chaque passage, ms (100). */
  readonly windowMs: number;
  /** Avance minimale sur l'horloge du son, ms (`settings.lookaheadMs`, 5). */
  readonly lookaheadMs: number;
  readonly clock: SchedulerClock;
  readonly timer: SchedulerTimer;
  /** Un événement devient programmable, avec son moment sur l'horloge du son. */
  readonly onSchedule: (event: MusicEvent, at: number) => void;
  /** À chaque passage du minuteur, avant la programmation. */
  readonly onTick?: (now: number) => void;
}

/**
 * Moment de programmation d'un événement : jamais dans le passé, toujours avec
 * au moins `lookaheadMs` d'avance sur l'horloge du son. Si le producteur a déjà
 * estampé l'avance (§7.9 règle 2, `core/schedule.ts`), elle ne s'ajoute pas une
 * seconde fois : la règle est un plancher, pas une somme.
 */
export function programmingTime(eventT: number, audioNow: number, lookaheadMs: number): number {
  const floor = audioNow + Math.max(lookaheadMs, 0) / 1000;
  if (!Number.isFinite(eventT)) return floor;
  return Math.max(eventT, floor);
}

export class LiveScheduler {
  private readonly options: LiveSchedulerOptions;

  private lookaheadMs: number;

  /** En attente, triés par moment croissant (stables à moment égal). */
  private pending: MusicEvent[] = [];

  private handle: number | null = null;

  constructor(options: LiveSchedulerOptions) {
    this.options = options;
    this.lookaheadMs = options.lookaheadMs;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get running(): boolean {
    return this.handle !== null;
  }

  /** Événements reçus d'une image analysée : ils rejoignent la file d'attente. */
  push(events: readonly MusicEvent[]): void {
    if (events.length === 0) return;
    this.pending = this.pending.concat(events.slice());
    this.pending.sort((a, b) => (a.t === b.t ? 0 : a.t < b.t ? -1 : 1));
  }

  /** Démarre le minuteur. Sans effet s'il tourne déjà. */
  start(): void {
    if (this.handle !== null) return;
    this.arm();
  }

  /** Arrête le minuteur. La file d'attente est conservée. */
  stop(): void {
    if (this.handle !== null) this.options.timer.cancel(this.handle);
    this.handle = null;
  }

  /** Vide la file d'attente (arrêt, changement d'instrument). */
  clear(): void {
    this.pending = [];
  }

  /** L'avance suit `settings.lookaheadMs` : elle se règle en cours de jeu. */
  setLookaheadMs(lookaheadMs: number): void {
    this.lookaheadMs = Math.max(lookaheadMs, 0);
  }

  /**
   * Un passage du minuteur : programme tout ce qui tombe dans la fenêtre qui
   * vient, dans l'ordre des moments. Public pour les tests et pour un
   * déclenchement manuel (première image après un gel).
   */
  tick(): void {
    const now = this.options.clock.now();
    this.options.onTick?.(now);
    const horizon = now + this.options.windowMs / 1000;
    const rest: MusicEvent[] = [];
    for (const event of this.pending) {
      if (event.t <= horizon) {
        this.options.onSchedule(event, programmingTime(event.t, now, this.lookaheadMs));
      } else {
        rest.push(event);
      }
    }
    this.pending = rest;
  }

  private arm(): void {
    const delay = Math.max(1, Math.min(this.options.tickMs, 1000));
    this.handle = this.options.timer.schedule(() => {
      this.handle = null;
      this.tick();
      if (this.handle === null) this.arm();
    }, delay);
  }
}

/** Le minuteur du navigateur, borné à 1 s par passage. */
export function browserTimer(): SchedulerTimer {
  return {
    schedule(fn, delayMs) {
      return globalThis.setTimeout(fn, Math.max(1, Math.min(delayMs, 1000))) as unknown as number;
    },
    cancel(handle) {
      globalThis.clearTimeout(handle);
    },
  };
}

/** L'horloge du son d'un contexte Web Audio. */
export function audioClock(context: { currentTime: number }): SchedulerClock {
  return { now: () => context.currentTime };
}
