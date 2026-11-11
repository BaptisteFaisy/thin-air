/**
 * Doubles minimaux pour les tests du paquet : horloge et minuteur manuels,
 * faux flux, fausses pistes. Aucune dépendance, aucun DOM.
 *
 * Ce fichier n'est PAS exporté par `index.ts` : il ne sert qu'aux `*.test.ts`.
 */
import { vi } from "vitest";

export interface Tache {
  readonly fn: () => void;
  at: number;
  annulee: boolean;
  readonly periodMs?: number;
}

export interface ManualClock {
  readonly now: () => number;
  readonly schedule: (fn: () => void, delayMs: number) => () => void;
  readonly tick: (fn: () => void, periodMs: number) => () => void;
  /** Avance l'horloge en exécutant les rappels dus, dans l'ordre. */
  advance(ms: number): void;
  readonly pending: number;
  readonly time: number;
}

/**
 * Horloge déterministe : le temps n'avance que quand le test le décide, et les
 * minuteurs (ponctuels ou périodiques) partent au bon moment. C'est ce qui
 * permet de prouver la cadence d'un rejeu ou d'une source virtuelle.
 */
class ManualClockRunner implements ManualClock {
  #temps = 0;
  #compteur = 0;
  readonly #taches = new Map<number, Tache>();

  #executer(): void {
    for (;;) {
      const dues = [...this.#taches.entries()]
        .filter(([, tache]) => !tache.annulee && tache.at <= this.#temps)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      const suivante = dues[0];
      if (suivante === undefined) return;
      const [id, tache] = suivante;
      if (tache.periodMs === undefined) this.#taches.delete(id);
      else tache.at = this.#temps + tache.periodMs;
      tache.fn();
    }
  }

  #programmer(fn: () => void, delayMs: number, periodMs?: number): () => void {
    this.#compteur += 1;
    const id = this.#compteur;
    this.#taches.set(id, { fn, at: this.#temps + Math.max(0, delayMs), annulee: false, periodMs });
    return () => {
      this.#taches.delete(id);
    };
  }

  readonly now = (): number => this.#temps;

  readonly schedule = (fn: () => void, delayMs: number): (() => void) =>
    this.#programmer(fn, delayMs);

  readonly tick = (fn: () => void, periodMs: number): (() => void) =>
    this.#programmer(fn, periodMs, periodMs);

  advance(ms: number): void {
    const cible = this.#temps + Math.max(0, ms);
    while (this.#temps < cible) {
      this.#temps = Math.min(cible, this.#temps + 1);
      this.#executer();
    }
    this.#temps = cible;
    this.#executer();
  }

  get pending(): number {
    return [...this.#taches.values()].filter((tache) => !tache.annulee).length;
  }

  get time(): number {
    return this.#temps;
  }
}

export function manualClock(): ManualClock {
  return new ManualClockRunner();
}

export interface FakeTrack {
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

export interface FakeStream {
  readonly flux: MediaStream;
  readonly pistes: FakeTrack[];
}

/** Un flux et ses pistes, pour vérifier que la caméra s'éteint vraiment. */
export function fakeStream(nbPistes = 1): FakeStream {
  const pistes: FakeTrack[] = Array.from({ length: nbPistes }, () => ({
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const flux = {
    getTracks: () => pistes,
    getVideoTracks: () => pistes,
  } as unknown as MediaStream;
  return { flux, pistes };
}

export interface FakeVideo {
  readonly video: HTMLVideoElement;
  readonly play: ReturnType<typeof vi.fn>;
}

export function fakeVideo(): FakeVideo {
  const play = vi.fn(async () => undefined);
  const video = { srcObject: null, currentTime: 0, play } as unknown as HTMLVideoElement;
  return { video, play };
}

/** Installe un `navigator.mediaDevices` qui rend le flux donné. */
export function stubCameraDevice(flux: MediaStream): ReturnType<typeof vi.fn> {
  const getUserMedia = vi.fn(async () => flux);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  return getUserMedia;
}
