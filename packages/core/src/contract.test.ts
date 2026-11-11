import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SAMPLE_RATE, defaultPlayRect, withSettings } from "./defaults.js";
import type { Instrument, MusicEvent, Settings, Take } from "./types.js";

/**
 * Le contrat lui-même est testé : si une valeur par défaut du cahier §7.13
 * bouge, ce test tombe. C'est la référence contre laquelle tous les lots
 * travaillent en parallèle (docs/CONTRACT.md).
 */
describe("contrat — réglages par défaut (cahier §7.13)", () => {
  const attendus: Partial<Settings> = {
    frameRateIdeal: 60,
    numHands: 2,
    graceMs: 150,
    fcMin: 1.5,
    beta: 5,
    fcD: 1,
    fcTrigger: 6,
    pinchOn: 0.25,
    pinchOff: 0.4,
    fistOn: 0.2,
    fistOff: 0.35,
    zoneMargin: 0.1,
    noteHysteresis: 0.15,
    stringRearmMs: 80,
    minPluckSpeed: 0.15,
    paramTauMs: 20,
    lookaheadMs: 5,
    maxVoices: 8,
    masterGainDb: -12,
    ceilingDb: -1,
    cameraLatencyMs: 50,
    tempo: 90,
    loopBars: 4,
    dwellMs: 400,
    wirelessWarnMs: 100,
    stallReleaseMs: 300,
  };

  it.each(Object.entries(attendus))("%s vaut %s", (cle, valeur) => {
    expect(DEFAULT_SETTINGS[cle as keyof Settings]).toBe(valeur);
  });

  it("withSettings ne remplace que ce qui est donné", () => {
    const reglages = withSettings({ tempo: 120 });
    expect(reglages.tempo).toBe(120);
    expect(reglages.maxVoices).toBe(8);
  });

  it("la zone par défaut est les 80 % centraux (AIR-F-08)", () => {
    expect(defaultPlayRect()).toEqual({ u0: 0.1, u1: 0.9, v0: 0.1, v1: 0.9, calibratedAt: null });
  });
});

describe("contrat — la couture est un type (cahier §11.3)", () => {
  it("un événement musical porte un instant sur l'horloge du son", () => {
    const evenements: readonly MusicEvent[] = [
      { type: "noteOn", t: 0.5, voice: "string-3", midi: 69, velocity: 0.17 },
      { type: "control", t: 0.53, voice: "string-3", param: "gain", value: 0.4 },
      { type: "noteOff", t: 1.5, voice: "string-3" },
    ];
    expect(evenements.map((e) => e.t)).toEqual([0.5, 0.53, 1.5]);
  });

  it("l'échantillonnage de référence est 48 kHz", () => {
    expect(SAMPLE_RATE).toBe(48_000);
  });

  it("une prise ne porte que des points, un côté et un score (AIR-F-47)", () => {
    const prise: Take = {
      format: "thin-air-take/1",
      fps: 30,
      frames: [
        { t: 0, hands: [{ side: "right", score: 0.97, points: [[0.41, 0.72, 0]] }] },
      ],
    };
    expect(Object.keys(prise.frames[0]?.hands[0] ?? {}).sort()).toEqual(["points", "score", "side"]);
  });

  it("un instrument est un fichier au format thin-air-instrument/1", () => {
    const instrument: Instrument = {
      format: "thin-air-instrument/1",
      name: "Probe",
      pointer: "palm",
      scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 11] },
      range: { low: 45, high: 81 },
      snap: 0.6,
      voices: 1,
      sound: { engine: "osc", wave: "sine" },
    };
    expect(instrument.format).toBe("thin-air-instrument/1");
  });
});
