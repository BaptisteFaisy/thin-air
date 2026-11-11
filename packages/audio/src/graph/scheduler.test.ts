/**
 * Règle 2 de §7.9 : tout événement est daté sur l'horloge du son, et la boucle
 * programme par avance — un minuteur passe toutes les 25 ms et programme les
 * 100 ms qui viennent. AIR-P-11 (ordre et causalité).
 *
 * Le minuteur et l'horloge sont injectés : aucun `AudioContext`, aucun vrai
 * `setTimeout` de 25 ms dans ces tests.
 */
import { describe, expect, it } from "vitest";
import type { MusicEvent } from "@thin-air/core";
import {
  LiveScheduler,
  programmingTime,
  type SchedulerClock,
  type SchedulerTimer,
} from "./scheduler.js";

const TICK_MS = 25;
const WINDOW_MS = 100;
const LOOKAHEAD_MS = 5;

class FakeClock implements SchedulerClock {
  constructor(public time = 0) {}

  now(): number {
    return this.time;
  }
}

/** Un minuteur qui ne s'exécute que sur commande : rien d'asynchrone. */
class FakeTimer implements SchedulerTimer {
  private handles = 0;

  readonly delays: number[] = [];

  private readonly queue = new Map<number, () => void>();

  schedule(fn: () => void, delayMs: number): number {
    this.handles += 1;
    this.delays.push(delayMs);
    this.queue.set(this.handles, fn);
    return this.handles;
  }

  cancel(handle: number): void {
    this.queue.delete(handle);
  }

  /** Déclenche le plus ancien minuteur armé, s'il en reste un. */
  fire(): boolean {
    const next = [...this.queue.entries()][0];
    if (next === undefined) return false;
    this.queue.delete(next[0]);
    next[1]();
    return true;
  }

  get armed(): number {
    return this.queue.size;
  }
}

function note(t: number, voice: string): MusicEvent {
  return { type: "noteOn", t, voice, midi: 60, velocity: 0.5 };
}

function makeScheduler(clock: FakeClock, timer: FakeTimer) {
  const scheduled: { event: MusicEvent; at: number }[] = [];
  const ticks: number[] = [];
  const scheduler = new LiveScheduler({
    tickMs: TICK_MS,
    windowMs: WINDOW_MS,
    lookaheadMs: LOOKAHEAD_MS,
    clock,
    timer,
    onSchedule: (event, at) => scheduled.push({ event, at }),
    onTick: (now) => ticks.push(now),
  });
  return { scheduler, scheduled, ticks };
}

describe("programmingTime — l'avance de 5 ms (AIR-P-11)", () => {
  it("un événement déjà estampé garde son instant", () => {
    expect(programmingTime(1.2, 1.0, LOOKAHEAD_MS)).toBe(1.2);
  });

  it("un événement trop proche est repoussé à maintenant + lookahead", () => {
    expect(programmingTime(1.0, 1.0, LOOKAHEAD_MS)).toBeCloseTo(1.005, 9);
  });

  it("l'avance ne s'ajoute jamais deux fois", () => {
    const once = programmingTime(1.0, 1.0, LOOKAHEAD_MS);
    const twice = programmingTime(once, 1.0, LOOKAHEAD_MS);
    expect(twice).toBeCloseTo(once, 9);
  });

  it("un instant non numérique tombe sur le plancher", () => {
    expect(programmingTime(Number.NaN, 2, LOOKAHEAD_MS)).toBeCloseTo(2.005, 9);
  });
});

describe("LiveScheduler — la fenêtre de 100 ms", () => {
  it("ne programme que ce qui tombe dans la fenêtre qui vient", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler, scheduled } = makeScheduler(clock, timer);
    scheduler.push([note(0.05, "a"), note(0.09, "b"), note(0.15, "c")]);
    scheduler.tick();
    expect(scheduled.map((item) => item.event.voice)).toEqual(["a", "b"]);
    expect(scheduler.pendingCount).toBe(1);
  });

  it("le passage suivant programme le reste, une seule fois", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler, scheduled } = makeScheduler(clock, timer);
    scheduler.push([note(0.15, "c")]);
    scheduler.tick();
    expect(scheduled).toHaveLength(0);
    clock.time = 0.1;
    scheduler.tick();
    scheduler.tick();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.at).toBeCloseTo(0.15, 9);
  });

  it("les instants programmés ne décroissent jamais (AIR-P-11)", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler, scheduled } = makeScheduler(clock, timer);
    scheduler.push([note(0.08, "b"), note(0.02, "a"), note(0.05, "m")]);
    scheduler.tick();
    const times = scheduled.map((item) => item.at);
    expect(times).toEqual([...times].sort((left, right) => left - right));
    expect(scheduled.map((item) => item.event.voice)).toEqual(["a", "m", "b"]);
  });

  it("pousse et programme par vagues, comme la boucle de §7.10", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler, scheduled } = makeScheduler(clock, timer);
    for (let step = 0; step < 8; step += 1) {
      clock.time = step * 0.025;
      scheduler.push([note(clock.time + 0.11, `v${step}`)]);
      scheduler.tick();
    }
    // Chaque poussée attend le passage suivant : la dernière reste en file.
    expect(scheduled).toHaveLength(7);
    expect(scheduler.pendingCount).toBe(1);
  });
});

describe("LiveScheduler — le minuteur", () => {
  it("arme un seul minuteur borné à 25 ms, pas un setInterval", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler } = makeScheduler(clock, timer);
    scheduler.start();
    expect(timer.armed).toBe(1);
    expect(timer.delays).toEqual([TICK_MS]);
  });

  it("se réarme après chaque passage, sans jamais en empiler deux", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler, ticks } = makeScheduler(clock, timer);
    scheduler.start();
    for (let i = 0; i < 3; i += 1) {
      clock.time += 0.025;
      expect(timer.fire()).toBe(true);
    }
    expect(ticks).toHaveLength(3);
    expect(timer.armed).toBe(1);
    expect(timer.delays).toEqual([TICK_MS, TICK_MS, TICK_MS, TICK_MS]);
  });

  it("stop() désarme le minuteur et garde la file", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler } = makeScheduler(clock, timer);
    scheduler.push([note(5, "a")]);
    scheduler.start();
    scheduler.stop();
    expect(timer.armed).toBe(0);
    expect(scheduler.running).toBe(false);
    expect(scheduler.pendingCount).toBe(1);
  });

  it("clear() vide la file (changement d'instrument)", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler } = makeScheduler(clock, timer);
    scheduler.push([note(5, "a"), note(6, "b")]);
    scheduler.clear();
    expect(scheduler.pendingCount).toBe(0);
  });

  it("l'avance suit le réglage lookaheadMs en cours de jeu", () => {
    const clock = new FakeClock(0);
    const timer = new FakeTimer();
    const { scheduler, scheduled } = makeScheduler(clock, timer);
    scheduler.setLookaheadMs(50);
    scheduler.push([note(-1, "a")]);
    scheduler.tick();
    expect(scheduled[0]?.at).toBeCloseTo(0.05, 9);
  });
});
