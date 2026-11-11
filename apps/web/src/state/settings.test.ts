import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, withSettings } from "@thin-air/core";
import { HARP, PHANTOM } from "./presets.js";
import {
  controlFor,
  decodeSettings,
  effectiveMagnet,
  encodeSettings,
  FILTER_MAX_HZ,
  FILTER_MIN_HZ,
  filterStrength,
  masterGainDb,
  patchSettings,
  withFilterStrength,
} from "./settings.js";

describe("mapping des réglages (cahier §7.13, §12.1)", () => {
  it("AIR-N-03 — le volume et le plafond viennent des défauts, jamais recopiés", () => {
    expect(DEFAULT_SETTINGS.masterGainDb).toBe(-12);
    expect(DEFAULT_SETTINGS.ceilingDb).toBe(-1);
    expect(masterGainDb(withSettings(undefined))).toBe(DEFAULT_SETTINGS.masterGainDb);
  });

  it("les curseurs bornent leurs valeurs, y compris face à du non fini", () => {
    expect(patchSettings(DEFAULT_SETTINGS, { tempo: 900 }).tempo).toBe(140);
    expect(patchSettings(DEFAULT_SETTINGS, { tempo: 1 }).tempo).toBe(60);
    expect(patchSettings(DEFAULT_SETTINGS, { cameraLatencyMs: Number.NaN }).cameraLatencyMs).toBe(0);
    expect(patchSettings(DEFAULT_SETTINGS, { reverb: 2 }).reverb).toBe(1);
  });

  it("un patch ne touche que ce qu'il demande", () => {
    const suivants = patchSettings(DEFAULT_SETTINGS, { hold: true });
    expect(suivants.hold).toBe(true);
    expect(suivants.oneHand).toBe(DEFAULT_SETTINGS.oneHand);
    expect(DEFAULT_SETTINGS.hold).toBe(false);
  });

  it("AIR-F-19 — l'aimant de l'instrument sert tant que le réglage est vide", () => {
    expect(effectiveMagnet(DEFAULT_SETTINGS, PHANTOM)).toBe(PHANTOM.snap);
    expect(effectiveMagnet(patchSettings(DEFAULT_SETTINGS, { magnet: 0 }), HARP)).toBe(0);
    expect(effectiveMagnet(patchSettings(DEFAULT_SETTINGS, { magnet: 4 }), HARP)).toBe(1);
  });

  it("AIR-N-06 — la force du filtrage va dans les deux sens, entre ses bornes", () => {
    expect(filterStrength(withFilterStrength(DEFAULT_SETTINGS, 0))).toBe(0);
    expect(filterStrength(withFilterStrength(DEFAULT_SETTINGS, 1))).toBe(1);
    expect(withFilterStrength(DEFAULT_SETTINGS, 1).fcMin).toBe(FILTER_MIN_HZ);
    expect(withFilterStrength(DEFAULT_SETTINGS, 0).fcMin).toBe(FILTER_MAX_HZ);
    expect(filterStrength(withFilterStrength(DEFAULT_SETTINGS, 5))).toBe(1);
  });

  it("AIR-F-54 — des réglages illisibles rendent les défauts, pas une moitié", () => {
    expect(decodeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(decodeSettings("{ cassé")).toEqual(DEFAULT_SETTINGS);
    expect(decodeSettings('"texte"')).toEqual(DEFAULT_SETTINGS);
    expect(decodeSettings(encodeSettings(patchSettings(DEFAULT_SETTINGS, { tempo: 120 })))).toEqual(
      patchSettings(DEFAULT_SETTINGS, { tempo: 120 }),
    );
  });

  it("chaque curseur annoncé a ses bornes", () => {
    expect(controlFor("tempo")?.max).toBe(140);
    expect(controlFor("cameraLatencyMs")?.min).toBe(0);
    expect(controlFor("magnet")).toBeNull();
  });
});
