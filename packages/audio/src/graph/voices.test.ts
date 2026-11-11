/**
 * Règle 3 de §7.9 : les voix sont bornées et toujours relâchées.
 * AIR-F-27, AIR-P-10 (voix bornées), AIR-P-09 (aucune note coincée),
 * AIR-F-24 (extinction en fondu, jamais une coupure).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { LiveVoicePool } from "./voices.js";

function makePool(maxVoices = 8, stallReleaseMs = 300, releaseS = 0.12) {
  const stolen: string[] = [];
  const released: { id: string; releaseS: number }[] = [];
  const pool = new LiveVoicePool({
    maxVoices,
    stallReleaseMs,
    releaseS,
    hooks: {
      onSteal: (id) => stolen.push(id),
      onRelease: (id, seconds) => released.push({ id, releaseS: seconds }),
    },
  });
  return { pool, stolen, released };
}

describe("bornage des voix — AIR-P-10, AIR-F-27", () => {
  it("huit voix au plus : la neuvième reprend la plus ancienne", () => {
    const { pool, stolen } = makePool();
    for (let i = 0; i < 9; i += 1) pool.start(`v${i}`, i / 10);
    expect(pool.size).toBe(8);
    expect(stolen).toEqual(["v0"]);
    expect(pool.ids).toEqual(["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"]);
  });

  it("une voix déjà sonnante redémarrée ne compte pas deux fois", () => {
    const { pool } = makePool();
    pool.start("a", 0);
    pool.start("a", 0.1);
    expect(pool.size).toBe(1);
    expect(pool.ids).toEqual(["a"]);
  });

  it("pour toute suite de départs, la taille reste sous la borne", () => {
    const ids = fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 40 });
    fc.assert(
      fc.property(ids, (sequence) => {
        const { pool } = makePool(3);
        sequence.forEach((id, index) => pool.start(`v${id}`, index / 10));
        expect(pool.size).toBeLessThanOrEqual(3);
        expect(pool.size).toBeLessThanOrEqual(new Set(pool.ids).size + 3);
      }),
      { seed: 20260901, numRuns: 50 },
    );
  });

  it("changer la borne relâche la plus ancienne tout de suite", () => {
    const { pool, stolen } = makePool(8);
    for (let i = 0; i < 5; i += 1) pool.start(`v${i}`, i);
    pool.setLimits(3, 300);
    expect(pool.size).toBe(3);
    expect(stolen).toEqual(["v0", "v1"]);
  });
});

describe("gel de l'analyse — règle 3 de §7.9", () => {
  it("300 ms sans image : toutes les voix sont relâchées", () => {
    const { pool, released } = makePool();
    pool.noteFrame(1);
    pool.start("a", 1);
    pool.start("b", 1.1);
    expect(pool.checkStall(1.2)).toBe(false);
    expect(pool.size).toBe(2);
    expect(pool.checkStall(1.31)).toBe(true);
    expect(pool.size).toBe(0);
    expect(released.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("une image récente repousse le gel", () => {
    const { pool } = makePool();
    pool.noteFrame(0);
    pool.start("a", 0);
    pool.noteFrame(0.25);
    expect(pool.checkStall(0.4)).toBe(false);
    expect(pool.size).toBe(1);
  });

  it("sans image analysée, rien n'est relâché d'office", () => {
    const { pool } = makePool();
    pool.start("a", 0);
    expect(pool.checkStall(10)).toBe(false);
  });
});

describe("relâchement — AIR-F-24, AIR-P-09", () => {
  it("un relâchement passe par un fondu, avec la durée de l'instrument", () => {
    const { pool, released } = makePool(8, 300, 0.2);
    pool.start("a", 0);
    pool.release("a");
    expect(released).toEqual([{ id: "a", releaseS: 0.2 }]);
    expect(pool.size).toBe(0);
  });

  it("relâcher une voix inconnue ne prévient personne", () => {
    const { pool, released } = makePool();
    pool.release("fantôme");
    expect(released).toHaveLength(0);
  });

  it("releaseAll vide le pool en fondu, voix par voix", () => {
    const { pool, released } = makePool(8, 300, 0.15);
    pool.start("a", 0);
    pool.start("b", 0.1);
    pool.start("c", 0.2);
    pool.releaseAll();
    expect(pool.size).toBe(0);
    expect(released.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(released.every((entry) => entry.releaseS > 0)).toBe(true);
  });

  it("après un relâchement général, aucune voix ne reste active (AIR-P-09)", () => {
    const { pool } = makePool();
    for (let i = 0; i < 8; i += 1) pool.start(`v${i}`, i / 10);
    pool.releaseAll();
    expect(pool.size).toBe(0);
    pool.releaseAll();
    expect(pool.size).toBe(0);
  });
});
