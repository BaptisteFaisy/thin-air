/**
 * Moteur du jeu direct, dans Node : aucun `AudioContext` n'est instancié
 * (AIR-N-02). Ce qui se prouve ici, c'est la façade du moteur quand le
 * navigateur n'est pas là : le rapport de retard reste honnête (partiel), les
 * appels sont sûrs, et rien n'ouvre de périphérique audio.
 *
 * Ce qui exige Web Audio (le graphe, le limiteur, les rampes réelles, le
 * niveau de crête) est marqué `it.todo` : c'est la preuve hors ligne du lot A5
 * et la recette navigateur qui le couvrent, pas un test Node.
 */
import { describe, expect, it } from "vitest";
import type { Instrument, MusicEvent, Settings } from "@thin-air/core";
import { DEFAULT_SETTINGS } from "@thin-air/core";
import { createLiveEngine, IMPULSE_SECONDS, TICK_MS, WINDOW_MS } from "./live.js";

const INSTRUMENT: Instrument = {
  format: "thin-air-instrument/1",
  name: "harpe",
  pointer: "index",
  scale: { root: 57, steps: [0, 2, 4, 7, 9] },
  strings: { count: 16, axis: "u" },
  snap: 1,
  voices: 8,
  sound: { engine: "pluck", decay: 0.996, releaseMs: 120 },
};

const SETTINGS: Settings = { ...DEFAULT_SETTINGS };

function makeEngine(settings: Settings = SETTINGS) {
  return createLiveEngine({ instrument: INSTRUMENT, settings });
}

describe("le moteur ne touche jamais au matériel dans Node — AIR-N-02", () => {
  it("aucun AudioContext n'existe dans cet environnement", () => {
    expect((globalThis as { AudioContext?: unknown }).AudioContext).toBeUndefined();
  });

  it("créer, jouer, relâcher et arrêter n'ouvre aucun contexte audio", () => {
    const engine = makeEngine();
    const events: MusicEvent[] = [{ type: "noteOn", t: 1, voice: "h3", midi: 69, velocity: 0.5 }];
    expect(() => {
      engine.play(events);
      engine.play([{ type: "noteOff", t: 1.2, voice: "h3" }]);
      engine.releaseAll();
      engine.setSettings({ ...SETTINGS, masterGainDb: -6 });
      engine.setInstrument(INSTRUMENT);
      engine.stop();
    }).not.toThrow();
    expect(engine.context).toBeNull();
    expect((globalThis as { AudioContext?: unknown }).AudioContext).toBeUndefined();
  });

  it("arrêter deux fois reste sans effet", () => {
    const engine = makeEngine();
    engine.stop();
    expect(() => engine.stop()).not.toThrow();
  });
});

describe("retard affiché sans navigateur — AIR-F-31", () => {
  it("les valeurs que le navigateur déclare manquent : la mesure est partielle", () => {
    const report = makeEngine().latency();
    expect(report.audioBaseMs).toBe(0);
    expect(report.audioOutputMs).toBeNull();
    expect(report.partial).toBe(true);
  });

  it("la caméra reste estimée, jamais mesurée (§5.1)", () => {
    const report = makeEngine().latency();
    expect(report.cameraAssumedMs).toBe(SETTINGS.cameraLatencyMs);
    expect(report.estimatedTotalMs).toBeCloseTo(report.measuredTotalMs + SETTINGS.cameraLatencyMs, 6);
  });

  it("sans sortie déclarée, aucune alerte sans fil n'est inventée (AIR-F-32)", () => {
    expect(makeEngine().warnings).toEqual([]);
  });

  it("un réglage de caméra plus grand se voit dans le total estimé", () => {
    const report = makeEngine({ ...SETTINGS, cameraLatencyMs: 120 }).latency();
    expect(report.cameraAssumedMs).toBe(120);
    expect(report.estimatedTotalMs - report.measuredTotalMs).toBeCloseTo(120, 6);
  });

  it("le temps de traitement du moteur est mesuré, pas inventé", () => {
    const engine = makeEngine();
    engine.play([{ type: "noteOn", t: 0, voice: "a", midi: 60, velocity: 1 }]);
    expect(engine.latency().processingMs).toBeGreaterThanOrEqual(0);
    expect(engine.latency().processingMs).toBeLessThan(50);
  });
});

describe("les réglages de la couture sont ceux du cahier §7.9", () => {
  it("minuteur de 25 ms, fenêtre de 100 ms, avance de 5 ms", () => {
    expect(TICK_MS).toBe(25);
    expect(WINDOW_MS).toBe(100);
    expect(SETTINGS.lookaheadMs).toBe(5);
  });

  it("huit voix, gel à 300 ms, τ de 20 ms, plafond de −1 dB", () => {
    expect(SETTINGS.maxVoices).toBe(8);
    expect(SETTINGS.stallReleaseMs).toBe(300);
    expect(SETTINGS.paramTauMs).toBe(20);
    expect(SETTINGS.ceilingDb).toBe(-1);
    expect(SETTINGS.masterGainDb).toBe(-12);
  });

  it("la réponse de réverbération est calculée, pas enregistrée", () => {
    expect(IMPULSE_SECONDS).toBeGreaterThan(0);
    expect(IMPULSE_SECONDS).toBeLessThanOrEqual(2);
  });
});

describe("ce que Node ne peut pas prouver", () => {
  it.todo("AIR-P-16 — pas de marches pendant un glissé lent — dépend du graphe Web Audio (navigateur)");
  it.todo("le graphe voix → réverbération → gain → limiteur → plafond — dépend d'un AudioContext");
  it.todo("l'ordre interactif est demandé à l'ouverture du contexte — dépend d'un AudioContext");
  it.todo("les notes sonnent à l'instant programmé — dépend d'un AudioContext et d'une horloge");
  it.todo("la sortie sans fil est signalée au-delà de 100 ms — dépend d'un outputLatency réel");
});
