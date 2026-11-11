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

  it("la chaîne de suivi rend une liste vide tant que les corps manquent", () => {
    const suivi = createTracking(PHANTOM, DEFAULT_SETTINGS, defaultPlayRect());
    expect(suivi.ready).toBe(false);
    expect(suivi.push(0, [])).toEqual([]);
    expect(suivi.stall(0)).toEqual([]);
    expect(suivi.end(0)).toEqual([]);
    expect(suivi.currentMidi()).toBeNull();
  });

  it.todo("AIR-P-13 — la sortie reste sous le plafond de −1 dB — dépend du lot A5 (audio)");
  it.todo("AIR-P-14 — le volume général suit −12 dB par défaut — dépend du lot A5 (audio)");
  it.todo("AIR-F-03 — une image n'est analysée qu'une fois — dépend du lot B5 (vision)");
  it.todo("AIR-F-50 — le fantôme rejoue une prise enregistrée — dépend du lot B5 (takes)");
  it.todo("AIR-P-17 — la boucle rejoue ses couches sur le temps — dépend du lot A3 (loop)");
});
