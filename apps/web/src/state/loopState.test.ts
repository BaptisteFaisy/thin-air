import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, MAX_LAYERS, type MusicEvent } from "@thin-air/core";
import {
  audibleLayers,
  BARS_CHOICES,
  cancelRecording,
  clearLayers,
  currentBeat,
  emptyLoop,
  isFull,
  loopLengthS,
  removeLastLayer,
  remainingLayers,
  startRecording,
  stopRecording,
  toggleMute,
  withBars,
  withPosition,
  withTempo,
} from "./loopState.js";

const note: MusicEvent = { type: "noteOn", t: 0.5, voice: "v1", midi: 60, velocity: 0.7 };

describe("la boucle à l'écran (cahier §7.10, AIR-F-34, 36)", () => {
  it("les défauts viennent des réglages : quatre mesures à 90", () => {
    const boucle = emptyLoop(DEFAULT_SETTINGS);
    expect(boucle.bars).toBe(DEFAULT_SETTINGS.loopBars);
    expect(boucle.tempo).toBe(DEFAULT_SETTINGS.tempo);
    expect(boucle.layers).toEqual([]);
    expect(BARS_CHOICES).toEqual([1, 2, 4]);
  });

  it("P4 — quatre mesures à 90 durent 10,67 s", () => {
    expect(loopLengthS(emptyLoop(DEFAULT_SETTINGS))).toBeCloseTo(10.67, 1);
  });

  it("le tempo est borné entre 60 et 140", () => {
    expect(withTempo(emptyLoop(DEFAULT_SETTINGS), 900).tempo).toBe(140);
    expect(withTempo(emptyLoop(DEFAULT_SETTINGS), 0).tempo).toBe(60);
  });

  it("une mesure non proposée laisse la précédente", () => {
    expect(withBars(emptyLoop(DEFAULT_SETTINGS), 3).bars).toBe(4);
    expect(withBars(emptyLoop(DEFAULT_SETTINGS), 2).bars).toBe(2);
  });

  it("AIR-F-34 — six couches au plus, la septième est refusée", () => {
    let boucle = startRecording(emptyLoop(DEFAULT_SETTINGS));
    for (let index = 0; index < MAX_LAYERS; index += 1) {
      boucle = stopRecording(boucle, `Harp ${index}`, [note]);
      boucle = startRecording(boucle);
    }
    expect(boucle.layers.length).toBe(MAX_LAYERS);
    expect(isFull(boucle)).toBe(true);
    expect(remainingLayers(boucle)).toBe(0);
    expect(stopRecording(boucle, "Trop", [note]).layers.length).toBe(MAX_LAYERS);
  });

  it("rien n'est enregistré hors enregistrement, et l'annulation ne crée rien", () => {
    const boucle = emptyLoop(DEFAULT_SETTINGS);
    expect(stopRecording(boucle, "Harp", [note]).layers).toEqual([]);
    expect(cancelRecording(startRecording(boucle)).layers).toEqual([]);
  });

  it("AIR-F-36 — retirer la dernière, couper une couche, tout effacer", () => {
    let boucle = stopRecording(startRecording(emptyLoop(DEFAULT_SETTINGS)), "Harp", [note]);
    boucle = stopRecording(startRecording(boucle), "Phantom", [note]);
    expect(boucle.layers.length).toBe(2);
    expect(removeLastLayer(boucle).layers.map((c) => c.instrument)).toEqual(["Harp"]);
    const coupee = toggleMute(boucle, boucle.layers[0]!.id);
    expect(audibleLayers(coupee).length).toBe(1);
    expect(toggleMute(coupee, boucle.layers[0]!.id).layers.every((c) => !c.muted)).toBe(true);
    expect(clearLayers(boucle).layers).toEqual([]);
    expect(clearLayers(boucle).nextLayerId).toBe(1);
  });

  it("la position reste dans la boucle, le temps en cours suit le tempo", () => {
    const boucle = emptyLoop(DEFAULT_SETTINGS);
    expect(withPosition(boucle, loopLengthS(boucle) + 1).positionS).toBeCloseTo(1, 5);
    expect(withPosition(boucle, -1).positionS).toBeGreaterThan(0);
    expect(currentBeat(boucle)).toBe(1);
    expect(currentBeat(withPosition(boucle, 60 / boucle.tempo))).toBe(2);
  });
});
