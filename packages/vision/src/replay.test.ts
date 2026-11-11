/**
 * Le rejeu d'une prise (AIR-F-48, §13.1 niveau 3) : les mêmes images, à la
 * même cadence, rendues comme si les mains étaient devant la caméra.
 * Horloge et minuteur injectés : tout est déterministe, aucun DOM.
 */
import { describe, expect, it } from "vitest";
import type { DetectedHand, Take } from "@thin-air/core";
import { createReplaySource, replayDurationMs, replayTimeline } from "./replay.js";
import { manualClock } from "./testing.js";
import type { VisionFrame } from "./source.js";

const MAIN_A: DetectedHand = { side: "left", score: 0.9, points: [[0.1, 0.2, 0]] };
const MAIN_B: DetectedHand = { side: "right", score: 0.8, points: [[0.4, 0.5, 0]] };

function prise(frames: readonly { t: number; hands: readonly DetectedHand[] }[]): Take {
  return { format: "thin-air-take/1", fps: 30, frames };
}

const TROIS_IMAGES = prise([
  { t: 0, hands: [MAIN_A] },
  { t: 0.1, hands: [MAIN_A, MAIN_B] },
  { t: 0.2, hands: [] },
]);

describe("replayTimeline — le plan de rejeu", () => {
  it("place chaque image à son instant, converti en millisecondes", () => {
    expect(replayTimeline(TROIS_IMAGES).map((etape) => etape.atMs)).toEqual([0, 100, 200]);
  });

  it("à vitesse 0,5, la scène prend deux fois plus de temps", () => {
    expect(replayTimeline(TROIS_IMAGES, { speed: 0.5 }).map((etape) => etape.atMs)).toEqual([0, 200, 400]);
  });

  it("à vitesse 2, deux fois moins", () => {
    expect(replayTimeline(TROIS_IMAGES, { speed: 2 }).map((etape) => etape.atMs)).toEqual([0, 50, 100]);
  });

  it("une vitesse absurde retombe sur 1 : pas de division par zéro", () => {
    for (const speed of [0, -1, Number.NaN]) {
      expect(replayTimeline(TROIS_IMAGES, { speed }).map((etape) => etape.atMs)).toEqual([0, 100, 200]);
    }
  });

  it("déterministe : deux plans de la même prise sont identiques", () => {
    expect(replayTimeline(TROIS_IMAGES)).toEqual(replayTimeline(TROIS_IMAGES));
  });

  it("la durée est celle de la dernière image", () => {
    expect(replayDurationMs(replayTimeline(TROIS_IMAGES))).toBe(200);
    expect(replayDurationMs([])).toBe(0);
  });

  it("une prise vide donne un plan vide", () => {
    expect(replayTimeline(prise([]))).toEqual([]);
  });
});

describe("createReplaySource — AIR-F-48", () => {
  it("est une source de mains, comme la caméra", () => {
    const source = createReplaySource(TROIS_IMAGES, { now: () => 0 });
    expect(source.kind).toBe("replay");
    expect(typeof source.start).toBe("function");
    expect(typeof source.stop).toBe("function");
    expect(typeof source.onFrame).toBe("function");
  });

  it("rejoue les images dans l'ordre, à la cadence de la prise", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, { now: horloge.now, schedule: horloge.schedule });
    const vus: VisionFrame[] = [];
    source.onFrame((image) => vus.push(image));

    await source.start();
    horloge.advance(0);
    expect(vus).toHaveLength(1);
    expect(vus[0]?.hands).toEqual([MAIN_A]);

    horloge.advance(50);
    expect(vus).toHaveLength(1);

    horloge.advance(50);
    expect(vus).toHaveLength(2);
    expect(vus[1]?.hands).toEqual([MAIN_A, MAIN_B]);

    horloge.advance(100);
    // La troisième image, puis l'image du silence : aucune main, aucune note tenue.
    expect(vus).toHaveLength(4);
    expect(vus[2]?.hands).toEqual([]);
    expect(vus[3]?.hands).toEqual([]);
  });

  it("aucun temps d'analyse : le rejeu n'appelle pas de modèle", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, { now: horloge.now, schedule: horloge.schedule });
    const vus: VisionFrame[] = [];
    source.onFrame((image) => vus.push(image));
    await source.start();
    horloge.advance(1000);
    expect(vus.every((image) => image.inferenceMs === 0)).toBe(true);
  });

  it("t est croissant, y compris en boucle", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, {
      now: horloge.now,
      schedule: horloge.schedule,
      loop: true,
    });
    const instants: number[] = [];
    source.onFrame((image) => instants.push(image.t));
    await source.start();
    horloge.advance(1000);
    expect(instants.length).toBeGreaterThan(5);
    for (let i = 1; i < instants.length; i += 1) {
      expect(instants[i]!).toBeGreaterThan(instants[i - 1]!);
    }
  });

  it("en boucle, la prise est rejouée encore, avec les mêmes mains", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, {
      now: horloge.now,
      schedule: horloge.schedule,
      loop: true,
    });
    const mainsVues: unknown[] = [];
    source.onFrame((image) => mainsVues.push(image.hands));
    await source.start();
    horloge.advance(200);
    const premierPassage = [...mainsVues];
    horloge.advance(200);
    expect(mainsVues.slice(0, premierPassage.length)).toEqual(premierPassage);
    expect(mainsVues.length).toBeGreaterThan(premierPassage.length);
  });

  it("sans boucle, la source s'arrête après la dernière image", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, { now: horloge.now, schedule: horloge.schedule });
    const vus: VisionFrame[] = [];
    source.onFrame((image) => vus.push(image));
    await source.start();
    horloge.advance(10_000);
    const compte = vus.length;
    horloge.advance(10_000);
    expect(vus).toHaveLength(compte);
    expect(horloge.pending).toBe(0);
  });

  it("stop arrête tout et rend une image sans main", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, { now: horloge.now, schedule: horloge.schedule });
    const vus: VisionFrame[] = [];
    source.onFrame((image) => vus.push(image));
    await source.start();
    horloge.advance(0);
    source.stop();
    const derniere = vus[vus.length - 1];
    expect(derniere?.hands).toEqual([]);
    const compte = vus.length;
    horloge.advance(1000);
    expect(vus).toHaveLength(compte);
  });

  it("deux start de suite ne rejouent pas deux fois", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, { now: horloge.now, schedule: horloge.schedule });
    const vus: VisionFrame[] = [];
    source.onFrame((image) => vus.push(image));
    await source.start();
    await source.start();
    horloge.advance(0);
    expect(vus).toHaveLength(1);
  });

  it("une prise vide rend une seule image de silence", async () => {
    const horloge = manualClock();
    const source = createReplaySource(prise([]), { now: horloge.now, schedule: horloge.schedule });
    const vus: VisionFrame[] = [];
    source.onFrame((image) => vus.push(image));
    await source.start();
    horloge.advance(1000);
    expect(vus).toHaveLength(1);
    expect(vus[0]?.hands).toEqual([]);
  });

  it.todo(
    "§13.1 niveau 3 — la prise rejouée traverse le moteur et redonne exactement la même liste d'événements — dépend du lot B2 (core.pipeline)",
  );

  it("un désabonnement cesse la réception", async () => {
    const horloge = manualClock();
    const source = createReplaySource(TROIS_IMAGES, { now: horloge.now, schedule: horloge.schedule });
    const vus: VisionFrame[] = [];
    const retirer = source.onFrame((image) => vus.push(image));
    await source.start();
    retirer();
    horloge.advance(1000);
    expect(vus).toHaveLength(0);
  });
});
