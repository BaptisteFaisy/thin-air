/**
 * Le socle commun des sources : horloge, image vide, diffusion.
 */
import { describe, expect, it, vi } from "vitest";
import type { DetectedHand } from "@thin-air/core";
import { FrameHub, defaultNow, emptyFrame, frameAt } from "./source.js";

const MAIN: DetectedHand = { side: "left", score: 0.9, points: [[0.1, 0.2, 0]] };

describe("source — le contrat commun", () => {
  it("frameAt porte l'instant, les mains et le temps d'analyse", () => {
    const image = frameAt(1.5, [MAIN], 12);
    expect(image).toEqual({ t: 1.5, hands: [MAIN], inferenceMs: 12 });
  });

  it("le temps d'analyse vaut 0 par défaut : une source sans modèle", () => {
    expect(frameAt(0, []).inferenceMs).toBe(0);
  });

  it("emptyFrame est l'image du silence : aucune main (AIR-N-08)", () => {
    const image = emptyFrame(2);
    expect(image.t).toBe(2);
    expect(image.hands).toHaveLength(0);
    expect(image.inferenceMs).toBe(0);
  });

  it("defaultNow rend des millisecondes finies et croissantes", () => {
    const a = defaultNow();
    const b = defaultNow();
    expect(Number.isFinite(a)).toBe(true);
    expect(b).toBeGreaterThanOrEqual(a);
  });
});

describe("FrameHub — la diffusion", () => {
  it("un abonné reçoit chaque image, une fois", () => {
    const hub = new FrameHub();
    const vu: number[] = [];
    hub.onFrame((image) => vu.push(image.t));
    hub.emit(frameAt(1, []));
    hub.emit(frameAt(2, []));
    expect(vu).toEqual([1, 2]);
  });

  it("le désabonnement arrête la réception", () => {
    const hub = new FrameHub();
    const vu: number[] = [];
    const retirer = hub.onFrame((image) => vu.push(image.t));
    hub.emit(frameAt(1, []));
    retirer();
    hub.emit(frameAt(2, []));
    expect(vu).toEqual([1]);
    expect(hub.size).toBe(0);
  });

  it("deux désabonnements du même écouteur ne comptent qu'une fois", () => {
    const hub = new FrameHub();
    const ecoute = vi.fn();
    const retirer = hub.onFrame(ecoute);
    retirer();
    retirer();
    hub.emit(frameAt(1, []));
    expect(ecoute).not.toHaveBeenCalled();
  });

  it("un abonné qui se retire pendant l'émission ne perturbe pas les autres", () => {
    const hub = new FrameHub();
    const vus: string[] = [];
    const premier = hub.onFrame(() => {
      vus.push("premier");
      premier();
    });
    hub.onFrame(() => vus.push("second"));
    hub.emit(frameAt(1, []));
    expect(vus).toEqual(["premier", "second"]);
  });

  it("un écouteur qui échoue n'empêche pas les suivants", () => {
    const hub = new FrameHub();
    const vus: string[] = [];
    hub.onFrame(() => {
      throw new Error("boom");
    });
    hub.onFrame(() => vus.push("apres"));
    expect(() => hub.emit(frameAt(1, []))).toThrow("boom");
    expect(vus).toEqual(["apres"]);
  });
});
