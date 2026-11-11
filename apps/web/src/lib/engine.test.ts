import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@thin-air/core";
import { PHANTOM } from "../state/presets.js";
import { createEngine } from "./engine.js";
import { createTracking } from "./tracking.js";
import { defaultPlayRect } from "@thin-air/core";

/**
 * Aucun son dans les tests (AIR-N-02) : `createEngine` n'ouvre aucun
 * `AudioContext` ici, parce que le moteur audio du lot A5 n'est pas livré — le
 * pont le constate et rend un moteur muet, sans lever.
 */
describe("ponts vers les moteurs des autres lots", () => {
  it("le pont audio ne lève jamais, même sans moteur livré", async () => {
    const engine = await createEngine(PHANTOM, DEFAULT_SETTINGS);
    expect(engine.audioBaseMs()).toBe(0);
    expect(engine.audioOutputMs()).toBeNull();
    expect(engine.latency()).toBeNull();
    engine.play([]);
    engine.releaseAll();
    engine.close();
  });

  it("la chaîne de suivi est en place et ne produit rien sans main", () => {
    // Le lot B2 est livré : la chaîne répond. Sans main, aucun événement — et
    // surtout aucune voix laissée en cours (AIR-P-09).
    const suivi = createTracking(PHANTOM, DEFAULT_SETTINGS, defaultPlayRect());
    expect(suivi.ready).toBe(true);
    expect(suivi.push(0, [])).toEqual([]);
    expect(suivi.stall(0)).toEqual([]);
    expect(suivi.end(0)).toEqual([]);
    expect(suivi.currentMidi()).toBeNull();
  });

  // Les propriétés ci-dessous sont prouvées là où vit leur logique, et non ici :
  //   AIR-P-13 (plafond −1 dB) et AIR-P-14 (−12 dB) → packages/audio/src/offline
  //   AIR-P-17 (boucle et compensation)              → packages/core/src/loop.test.ts
  //   AIR-F-03 (une image, une analyse) et AIR-F-50  → packages/vision/src
  it.todo("AIR-F-03 — une image analysée une seule fois : demande un navigateur (E2E)");
  it.todo("AIR-F-50 — le fantôme rejoue une prise : demande un navigateur (E2E)");
});
