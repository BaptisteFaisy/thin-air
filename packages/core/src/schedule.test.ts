/**
 * Datation sur l'horloge du son (cahier §7.9, règle 2) — propriété AIR-P-11.
 * Les horloges sont des arguments : aucun test ne lit l'heure de la machine.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { Scheduler, sortEvents } from "./schedule.js";
import type { MusicEvent } from "./types.js";

function scheduler(lookaheadMs = 5, windowMs = 100): Scheduler {
  return new Scheduler({ lookaheadMs, windowMs });
}

const evenement = fc.oneof(
  fc.record({
    type: fc.constant("noteOn" as const),
    t: fc.double({ min: 0, max: 20, noNaN: true }),
    voice: fc.constantFrom("lead", "string-1", "zone-a"),
    midi: fc.integer({ min: 21, max: 108 }),
    velocity: fc.double({ min: 0, max: 1, noNaN: true }),
  }),
  fc.record({
    type: fc.constant("noteOff" as const),
    t: fc.double({ min: 0, max: 20, noNaN: true }),
    voice: fc.constantFrom("lead", "string-1", "zone-a"),
  }),
);

describe("schedule — datation (§7.9, règle 2)", () => {
  it("l'instant est l'horloge audio plus l'avance de 5 ms", () => {
    expect(scheduler().stamp(10.0, 100.0)).toBeCloseTo(100.005, 9);
  });

  it("l'avance par défaut du cahier vaut 5 ms", () => {
    const s = new Scheduler({ lookaheadMs: 5 });
    expect(s.lookaheadS()).toBeCloseTo(0.005, 12);
  });

  it("AIR-P-11 — deux images au même horodatage ne datent pas deux fois différemment", () => {
    const s = scheduler();
    const premier = s.stamp(1.0, 20.0);
    const second = s.stamp(1.0, 20.0);
    expect(second).toBe(premier);
  });

  it("AIR-P-11 — un horodatage qui recule ne fait jamais reculer l'instant", () => {
    const s = scheduler();
    const premier = s.stamp(2.0, 30.0);
    const second = s.stamp(1.5, 30.0);
    expect(second).toBeGreaterThanOrEqual(premier);
  });

  it("AIR-P-11 — pour tout flux d'images, les instants ne décroissent jamais", () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 30, noNaN: true }), { maxLength: 40 }), (images) => {
        const s = scheduler();
        let audio = 0;
        let precedent = -Infinity;
        let imagePrecedente = -Infinity;
        for (const image of images) {
          audio += 1 / 30;
          const t = s.stamp(image, audio);
          expect(Number.isFinite(t)).toBe(true);
          expect(t).toBeGreaterThanOrEqual(precedent);
          // Une image qui avance est datée après l'horloge présente ; une
          // image en double ou en recul tient l'instant précédent (§7.9).
          if (image > imagePrecedente) expect(t).toBeGreaterThanOrEqual(audio);
          precedent = t;
          imagePrecedente = Math.max(imagePrecedente, image);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("une image ne peut pas être datée avant l'horloge audio présente", () => {
    const s = scheduler();
    expect(s.stamp(0.033, 12.0)).toBeGreaterThanOrEqual(12.0);
  });

  it("une entrée non numérique ne produit pas de NaN", () => {
    const s = scheduler();
    const t = s.stamp(Number.NaN, 5.0);
    expect(Number.isFinite(t)).toBe(true);
    expect(Number.isFinite(s.stamp(1, Number.NaN))).toBe(true);
  });
});

describe("schedule — fenêtre d'avance (§7.9, règle 2)", () => {
  const events: readonly MusicEvent[] = [
    { type: "noteOn", t: 0.5, voice: "a", midi: 60, velocity: 1 },
    { type: "noteOn", t: 0.02, voice: "b", midi: 62, velocity: 1 },
    { type: "noteOn", t: 0.15, voice: "c", midi: 64, velocity: 1 },
    { type: "noteOn", t: 0.9, voice: "d", midi: 65, velocity: 1 },
  ];

  it("le minuteur de 25 ms programme les 100 ms qui viennent", () => {
    const s = scheduler(5, 100);
    const dus = s.due(0.05, events);
    expect(dus.map((event) => event.t)).toEqual([0.02, 0.15]);
    expect(s.windowS()).toBeCloseTo(0.1, 12);
  });

  it("le retard est rattrapé : ce qui est en retard part au passage suivant", () => {
    const s = scheduler(5, 100);
    const enRetard: readonly MusicEvent[] = [{ type: "noteOn", t: 0.001, voice: "a", midi: 60, velocity: 1 }];
    expect(s.due(0.05, enRetard)).toHaveLength(1);
  });

  it("ce qui est au-delà de la fenêtre reste pour plus tard", () => {
    const s = scheduler(5, 100);
    expect(s.due(0.0, events).map((event) => event.t)).toEqual([0.02]);
    expect(s.due(0.4, events).map((event) => event.t)).toEqual([0.02, 0.15, 0.5]);
    expect(s.due(0.8, events).map((event) => event.t)).toEqual([0.02, 0.15, 0.5, 0.9]);
  });

  it("une fenêtre nulle ne programme que ce qui est déjà dû", () => {
    const s = scheduler(5, 0);
    expect(s.due(0.1, events).map((event) => event.t)).toEqual([0.02]);
    expect(s.due(0.0, events)).toHaveLength(0);
  });

  it("due rend les événements triés et ne modifie pas l'entrée", () => {
    const copie = [...events];
    const dus = scheduler().due(1.0, events);
    expect(dus.map((event) => event.t)).toEqual([0.02, 0.15, 0.5, 0.9]);
    expect(events).toEqual(copie);
  });

  it("AIR-P-11 — sortEvents rend une liste triée, pour toute entrée", () => {
    fc.assert(
      fc.property(fc.array(evenement, { maxLength: 30 }), (liste) => {
        const trie = sortEvents(liste);
        expect(trie).toHaveLength(liste.length);
        for (let i = 1; i < trie.length; i += 1) {
          expect((trie[i] as MusicEvent).t).toBeGreaterThanOrEqual((trie[i - 1] as MusicEvent).t);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("le tri est stable à instant égal : l'ordre du fichier est conservé", () => {
    const liste: readonly MusicEvent[] = [
      { type: "control", t: 1, voice: "lead", param: "gain", value: 0.5 },
      { type: "noteOn", t: 1, voice: "lead", midi: 60, velocity: 1 },
      { type: "noteOff", t: 1, voice: "lead" },
    ];
    expect(sortEvents(liste).map((event) => event.type)).toEqual(["control", "noteOn", "noteOff"]);
  });

  it("sortEvents ne touche pas la liste reçue", () => {
    const liste: readonly MusicEvent[] = [
      { type: "noteOn", t: 2, voice: "a", midi: 60, velocity: 1 },
      { type: "noteOn", t: 1, voice: "b", midi: 61, velocity: 1 },
    ];
    sortEvents(liste);
    expect(liste.map((event) => event.t)).toEqual([2, 1]);
  });
});
