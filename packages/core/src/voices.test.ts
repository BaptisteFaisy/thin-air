/**
 * Voix bornées (cahier §7.9, règle 3) — propriétés AIR-P-09 et AIR-P-10.
 * Générateurs fast-check sur des demandes de notes, aucune horloge réelle.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { VoicePool } from "./voices.js";
import type { MusicEvent } from "./types.js";

/** Rejoue une liste d'événements et rend le nombre de voix actives au pire. */
function peakActive(events: readonly MusicEvent[]): number {
  const actives = new Set<string>();
  let peak = 0;
  for (const event of events) {
    if (event.type === "noteOn") actives.add(event.voice);
    else if (event.type === "noteOff") actives.delete(event.voice);
    peak = Math.max(peak, actives.size);
  }
  return peak;
}

/** Vérifie l'appariement : tout `noteOn` a un `noteOff`, dans l'ordre. */
function pairs(events: readonly MusicEvent[]): { on: number; off: number; orphans: number } {
  const ouvertes = new Set<string>();
  let on = 0;
  let off = 0;
  let orphans = 0;
  for (const event of events) {
    if (event.type === "noteOn") {
      on += 1;
      ouvertes.add(event.voice);
    } else if (event.type === "noteOff") {
      off += 1;
      if (!ouvertes.delete(event.voice)) orphans += 1;
    }
  }
  return { on, off, orphans };
}

/** Une demande de note : instant, identité, hauteur. */
const demande = fc.record({
  t: fc.double({ min: 0, max: 100, noNaN: true }),
  id: fc.constantFrom("lead", "string-0", "string-3", "zone-a", "zone-b", "perc"),
  midi: fc.integer({ min: 21, max: 108 }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true }),
});

describe("voices — le réservoir (§7.9, règle 3)", () => {
  it("AIR-P-10 — jamais plus de maxVoices voix à la fois, quel que soit le flux", () => {
    fc.assert(
      fc.property(fc.array(demande, { maxLength: 60 }), fc.integer({ min: 1, max: 8 }), (demandes, max) => {
        const pool = new VoicePool(max);
        const events: MusicEvent[] = [];
        for (const d of demandes) events.push(...pool.noteOn(d.t, d.id, d.midi, d.velocity));
        expect(pool.activeCount).toBeLessThanOrEqual(max);
        expect(peakActive(events)).toBeLessThanOrEqual(max);
      }),
      { numRuns: 300 },
    );
  });

  it("AIR-P-09 — tout noteOn a son noteOff et releaseAll vide le réservoir", () => {
    fc.assert(
      fc.property(fc.array(demande, { maxLength: 40 }), (demandes) => {
        const pool = new VoicePool(8);
        const events: MusicEvent[] = [];
        for (const d of demandes) events.push(...pool.noteOn(d.t, d.id, d.midi, d.velocity));
        events.push(...pool.releaseAll(100));
        const { on, off, orphans } = pairs(events);
        expect(off).toBe(on);
        expect(orphans).toBe(0);
        expect(pool.activeCount).toBe(0);
      }),
      { numRuns: 300 },
    );
  });

  it("au-delà du plafond, la plus ancienne est reprise, et son noteOff précède le noteOn", () => {
    const pool = new VoicePool(2);
    const events: MusicEvent[] = [
      ...pool.noteOn(0.0, "a", 60, 1),
      ...pool.noteOn(0.1, "b", 62, 1),
      ...pool.noteOn(0.2, "c", 64, 1),
    ];
    expect(events.map((event) => `${event.type}:${"voice" in event ? event.voice : ""}`)).toEqual([
      "noteOn:a",
      "noteOn:b",
      "noteOff:a",
      "noteOn:c",
    ]);
    expect(pool.activeCount).toBe(2);
  });

  it("huit voix par défaut : la neuvième reprend la première, la huitième tient", () => {
    const pool = new VoicePool(8);
    const events: MusicEvent[] = [];
    for (let i = 0; i < 9; i += 1) events.push(...pool.noteOn(i * 0.1, `v${i}`, 60 + i, 1));
    const released = events.filter((event) => event.type === "noteOff");
    expect(released).toHaveLength(1);
    expect(released[0]).toMatchObject({ voice: "v0" });
    expect(pool.activeCount).toBe(8);
    expect(pool.find("v7")?.active).toBe(true);
  });

  it("redemander une voix active la relance proprement (noteOff puis noteOn)", () => {
    const pool = new VoicePool(4);
    pool.noteOn(0, "lead", 60, 1);
    const relance = pool.noteOn(1, "lead", 67, 1);
    expect(relance.map((event) => event.type)).toEqual(["noteOff", "noteOn"]);
    expect(pool.activeCount).toBe(1);
  });

  it("noteOff d'une voix inconnue ou déjà éteinte ne produit rien", () => {
    const pool = new VoicePool(2);
    expect(pool.noteOff(0, "fantome")).toEqual([]);
    pool.noteOn(0, "a", 60, 1);
    expect(pool.noteOff(1, "a")).toHaveLength(1);
    expect(pool.noteOff(2, "a")).toEqual([]);
  });

  it("releaseAll éteint les voix de la plus ancienne à la plus récente", () => {
    const pool = new VoicePool(4);
    pool.noteOn(0, "a", 60, 1);
    pool.noteOn(0.1, "b", 62, 1);
    const fin = pool.releaseAll(5);
    expect(fin.map((event) => event.type === "noteOff" && event.voice)).toEqual(["a", "b"]);
    expect(new Set(fin.map((event) => event.t))).toEqual(new Set([5]));
  });

  it("un plafond nul ou absurde reste jouable : au moins une voix", () => {
    expect(new VoicePool(0).limit()).toBe(1);
    expect(new VoicePool(Number.NaN).limit()).toBe(1);
    expect(new VoicePool(2.7).limit()).toBe(2);
  });
});
