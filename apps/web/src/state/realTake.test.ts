/**
 * La logique pure du mode « prise réelle » (lot N7) : scénarios, décompte,
 * noms de fichiers. Aucun DOM, aucun son, aucune horloge réelle : les ticks
 * sont des événements (déterminisme, AIR-N-09).
 */
import { describe, expect, it } from "vitest";
import {
  REAL_TAKE_SCENARIOS,
  reduceRealTake,
  realTakeFilename,
  scenarioFromFilename,
  stepAt,
  REAL_TAKE_INITIAL,
  type RealTakeState,
} from "./realTake.js";

function ticks(depuis: RealTakeState, n: number): RealTakeState {
  let etat = depuis;
  for (let i = 0; i < n; i += 1) etat = reduceRealTake(etat, { type: "tick" });
  return etat;
}

describe("mode prise réelle (lot N7, annexe D)", () => {
  it("les trois scénarios du brief sont là, avec leurs durées", () => {
    expect(REAL_TAKE_SCENARIOS.map((s) => s.id)).toEqual(["left-hand-only", "reach", "tremor"]);
    const parId = Object.fromEntries(REAL_TAKE_SCENARIOS.map((s) => [s.id, s.durationS]));
    expect(parId["left-hand-only"]).toBe(3); // une main gauche levée, 3 s
    expect(parId["reach"]).toBe(8); // §7.4 : « pendant huit secondes »
    expect(parId["tremor"]).toBe(10); // §7.5 : immobile puis mouvement lent
  });

  it("pick → décompte de 3 s, puis enregistrement, puis fichier nommé", () => {
    const pris = reduceRealTake(REAL_TAKE_INITIAL, { type: "pick", id: "left-hand-only" });
    expect(pris.phase).toBe("countdown");
    expect(pris.countdownS).toBe(3);
    const apresCompte = ticks(pris, 3);
    expect(apresCompte.phase).toBe("recording");
    const fini = ticks(apresCompte, 3);
    expect(fini.phase).toBe("done");
    expect(fini.filename).toBe("left-hand-only-take.json");
  });

  it("un tick après la fin ne change plus rien", () => {
    const fini = ticks(reduceRealTake(REAL_TAKE_INITIAL, { type: "pick", id: "left-hand-only" }), 6);
    expect(reduceRealTake(fini, { type: "tick" })).toEqual(fini);
  });

  it("reset revient au choix", () => {
    const fini = ticks(reduceRealTake(REAL_TAKE_INITIAL, { type: "pick", id: "tremor" }), 13);
    expect(reduceRealTake(fini, { type: "reset" })).toEqual(REAL_TAKE_INITIAL);
  });

  it("reach : quatre consignes, une toutes les 2 s (haut, bas, gauche, droite)", () => {
    const reach = REAL_TAKE_SCENARIOS.find((s) => s.id === "reach");
    expect(reach).toBeDefined();
    if (reach === undefined) return;
    expect(stepAt(reach, 0).key).toBe("up");
    expect(stepAt(reach, 2).key).toBe("down");
    expect(stepAt(reach, 4).key).toBe("left");
    expect(stepAt(reach, 7).key).toBe("right");
  });

  it("tremor : immobile d'abord, lent ensuite (§7.5)", () => {
    const tremor = REAL_TAKE_SCENARIOS.find((s) => s.id === "tremor");
    expect(tremor).toBeDefined();
    if (tremor === undefined) return;
    expect(stepAt(tremor, 0).key).toBe("still");
    expect(stepAt(tremor, 5).key).toBe("slow");
    expect(stepAt(tremor, 9).key).toBe("slow");
  });

  it("le nom du fichier porte le scénario, et l'ingestion le relit", () => {
    expect(realTakeFilename("left-hand-only")).toBe("left-hand-only-take.json");
    expect(scenarioFromFilename("left-hand-only-take.json")).toBe("left-hand-only");
    expect(scenarioFromFilename("tremor-pc-2026-11-12.json")).toBe("tremor");
    expect(scenarioFromFilename("reach-take (1).json")).toBe("reach");
    expect(scenarioFromFilename("n-importe-quoi.json")).toBeNull();
  });
});
