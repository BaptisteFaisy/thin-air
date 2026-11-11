/**
 * Les générateurs de prises de synthèse (cahier §7.11, §13.3).
 *
 * La propriété centrale est l'**inversabilité** : une pose doit se retrouver
 * dans les 21 points qu'elle produit. Sans elle, aucune prise de synthèse ne
 * prouve quoi que ce soit — un test qui rejoue une prise mesurerait du bruit.
 * Les mesures sont recalculées ici (et non importées de `features.ts`, lot B1b
 * encore en cours) d'après les définitions du §7.6.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { DetectedHand, HandPoint, Take } from "./types.js";
import {
  alea,
  crossingHandsTake,
  fastJabTake,
  handLeavesTake,
  leftHandOnlyTake,
  linearTake,
  makeHand,
  poseFromPlay,
  sweepTake,
  tremorTake,
  uToImageX,
  vToImageY,
  withDroppedFrames,
  withHand,
} from "./takeGen.js";
import { toPlayPosition } from "./space.js";

const distance = (a: HandPoint, b: HandPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Un point de la main ; le zéro de repli n'est jamais atteint (21 points garantis). */
const pt = (main: DetectedHand, i: number): HandPoint => main.points[i] ?? [0, 0, 0];

/** Échelle de la paume (§7.6) : distance du poignet à la base du majeur. */
const palmScale = (main: DetectedHand): number => distance(pt(main, 0), pt(main, 9));
/** Centre de la paume (§7.4) : moyenne des points 0, 5, 9, 13, 17. */
function palmCenter(main: DetectedHand): [number, number] {
  const index = [0, 5, 9, 13, 17];
  const somme = index.reduce(
    (acc: [number, number], i): [number, number] => [acc[0] + pt(main, i)[0], acc[1] + pt(main, i)[1]],
    [0, 0] as [number, number],
  );
  return [somme[0] / index.length, somme[1] / index.length];
}
/** Pince (§7.6) : écart pouce-index divisé par l'échelle. */
const pinchValue = (main: DetectedHand): number => distance(pt(main, 4), pt(main, 8)) / palmScale(main);
/** Ouverture (§7.6) : moyenne des distances des quatre bouts au poignet, / échelle. */
function ouverture(main: DetectedHand): number {
  const bouts = [8, 12, 16, 20].map((i) => distance(pt(main, i), pt(main, 0)));
  return bouts.reduce((a, b) => a + b, 0) / 4 / palmScale(main);
}

const poseInterieure = fc.record({
  x: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
  y: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
  scale: fc.double({ min: 0.05, max: 0.15, noNaN: true }),
  open: fc.double({ min: 0, max: 1, noNaN: true }),
  pinch: fc.double({ min: 0, max: 1, noNaN: true }),
  side: fc.constantFrom("left" as const, "right" as const),
});

describe("makeHand — 21 points plausibles", () => {
  it("produit 21 points finis, dans l'image", () => {
    fc.assert(
      fc.property(poseInterieure, (pose) => {
        const main = makeHand(pose);
        expect(main.points).toHaveLength(21);
        for (const p of main.points) {
          expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true);
          expect(p[0]).toBeGreaterThanOrEqual(0);
          expect(p[0]).toBeLessThanOrEqual(1);
          expect(p[1]).toBeGreaterThanOrEqual(0);
          expect(p[1]).toBeLessThanOrEqual(1);
          expect(Math.abs(p[2])).toBeLessThanOrEqual(1);
        }
        expect(["left", "right"]).toContain(main.side);
        expect(main.score).toBeGreaterThan(0);
        expect(main.score).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it("déterministe : mêmes arguments, exactement mêmes nombres", () => {
    const pose = { x: 0.42, y: 0.55, scale: 0.11, open: 0.7, pinch: 0.35, side: "right" as const };
    expect(JSON.stringify(makeHand(pose))).toBe(JSON.stringify(makeHand(pose)));
    expect(JSON.stringify(makeHand({ ...pose, side: "left" }))).not.toBe(JSON.stringify(makeHand(pose)));
  });
});

describe("makeHand — inversabilité (la propriété qui rend les prises crédibles)", () => {
  it("le centre de la paume retrouve la pose", () => {
    fc.assert(
      fc.property(poseInterieure, (pose) => {
        const [cx, cy] = palmCenter(makeHand(pose));
        expect(cx).toBeCloseTo(pose.x, 9);
        expect(cy).toBeCloseTo(pose.y, 9);
      }),
      { numRuns: 200 },
    );
  });

  it("l'échelle de la paume retrouve `scale`", () => {
    fc.assert(
      fc.property(poseInterieure, (pose) => {
        expect(palmScale(makeHand(pose))).toBeCloseTo(pose.scale, 9);
      }),
      { numRuns: 200 },
    );
  });

  it("la pince retrouve `pinch` exactement", () => {
    fc.assert(
      fc.property(poseInterieure, (pose) => {
        expect(pinchValue(makeHand(pose))).toBeCloseTo(pose.pinch, 9);
      }),
      { numRuns: 200 },
    );
  });

  it("l'ouverture croît strictement avec `open`", () => {
    const poses = [0, 0.25, 0.5, 0.75, 1];
    const mesures = poses.map((open) => ouverture(makeHand({ x: 0.5, y: 0.5, open })));
    for (let i = 1; i < mesures.length; i += 1) {
      expect(mesures[i]!).toBeGreaterThan(mesures[i - 1]!);
    }
  });

  it("la même pose à deux distances de la caméra donne la même pince et la même ouverture (§7.4)", () => {
    const proche = makeHand({ x: 0.5, y: 0.5, scale: 0.16, open: 0.8, pinch: 0.3 });
    const loin = makeHand({ x: 0.5, y: 0.5, scale: 0.06, open: 0.8, pinch: 0.3 });
    expect(pinchValue(proche)).toBeCloseTo(pinchValue(loin), 9);
    expect(ouverture(proche)).toBeCloseTo(ouverture(loin), 9);
    expect(palmScale(proche)).not.toBeCloseTo(palmScale(loin), 3);
  });

  it("les bouts des doigts sont plus loin du poignet que leurs bases", () => {
    const main = makeHand({ x: 0.5, y: 0.5, open: 1 });
    for (const [base, bout] of [[5, 8], [9, 12], [13, 16], [17, 20]] as const) {
      expect(distance(pt(main, bout), pt(main, 0))).toBeGreaterThan(distance(pt(main, base), pt(main, 0)));
    }
  });
});

describe("conversions zone de jeu ↔ image (§7.4)", () => {
  it("u et v reviennent à leur valeur après le miroir", () => {
    for (const u of [0, 0.2, 0.45, 0.8, 1]) {
      const pose = poseFromPlay(u, 0.5, { scale: 0.02 });
      const place = toPlayPosition(pose.x, pose.y, { u0: 0.1, u1: 0.9, v0: 0.1, v1: 0.9, calibratedAt: null }, 1);
      expect(place.u).toBeCloseTo(u, 9);
    }
    for (const v of [0, 0.35, 1]) {
      const pose = poseFromPlay(0.5, v, { scale: 0.02 });
      const place = toPlayPosition(pose.x, pose.y, { u0: 0.1, u1: 0.9, v0: 0.1, v1: 0.9, calibratedAt: null }, 1);
      expect(place.v).toBeCloseTo(v, 9);
    }
  });

  it("aller à droite de l'écran fait croître u malgré le miroir", () => {
    expect(uToImageX(0.8)).toBeLessThan(uToImageX(0.2));
    expect(vToImageY(0.8)).toBeLessThan(vToImageY(0.2));
  });
});

function verifCadence(prise: Take, fps: number, images: number): void {
  expect(prise.format).toBe("thin-air-take/1");
  expect(prise.fps).toBe(fps);
  expect(prise.frames).toHaveLength(images);
  prise.frames.forEach((image, i) => {
    expect(image.t).toBeCloseTo(i / fps, 9);
  });
}

describe("les générateurs de prises", () => {
  it("linearTake : cadence exacte et trajectoire monotone", () => {
    const prise = linearTake({ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }, { fps: 30, durationS: 3 });
    verifCadence(prise, 30, 91);
    const xs = prise.frames.map((f) => palmCenter(f.hands[0]!)[0]);
    expect(xs[0]).toBeCloseTo(0.3, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(0.7, 6);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]! - 1e-12);
  });

  it("tremorTake : déterministe pour une graine, et l'amplitude est respectée", () => {
    const centre = { x: 0.5, y: 0.5 };
    const a = tremorTake(centre, 0.02, { fps: 30, durationS: 1, seed: 7 });
    const b = tremorTake(centre, 0.02, { fps: 30, durationS: 1, seed: 7 });
    const c = tremorTake(centre, 0.02, { fps: 30, durationS: 1, seed: 8 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    const ecart = Math.max(...a.frames.map((f) => Math.abs(palmCenter(f.hands[0]!)[0] - 0.5)));
    expect(ecart).toBeGreaterThan(0);
    expect(ecart).toBeLessThan(0.05); // amplitude 0,02 + marge du modèle de tremblement
  });

  it("sweepTake : l'index balaie bien de fromU à toU dans la zone de jeu", () => {
    const prise = sweepTake(0.2, 0.45, { fps: 30 });
    const rect = { u0: 0.1, u1: 0.9, v0: 0.1, v1: 0.9, calibratedAt: null };
    // On suit le CENTRE DE LA PAUME : le bout de l'index est décalé de la
    // longueur du doigt, ce n'est pas lui que `sweepTake(fromU, toU)` place.
    const us = prise.frames.map((f) => {
      const [cx, cy] = palmCenter(f.hands[0]!);
      return toPlayPosition(cx, cy, rect, 1).u;
    });
    expect(us[0]!).toBeCloseTo(0.2, 6);
    expect(us[us.length - 1]!).toBeCloseTo(0.45, 6);
    // §7.14 : une demi-seconde par défaut.
    expect(prise.frames).toHaveLength(16);
  });

  it("handLeavesTake : des mains avant la sortie, aucune après", () => {
    const prise = handLeavesTake({ x: 0.5, y: 0.5 }, 1, { fps: 30, durationS: 2 });
    verifCadence(prise, 30, 61);
    const avant = prise.frames.filter((f) => f.t < 1);
    const apres = prise.frames.filter((f) => f.t >= 1);
    expect(avant.length).toBeGreaterThan(0);
    expect(avant.every((f) => f.hands.length === 1)).toBe(true);
    expect(apres.length).toBeGreaterThan(0);
    expect(apres.every((f) => f.hands.length === 0)).toBe(true);
  });

  it("crossingHandsTake : deux mains toujours présentes, et elles se croisent", () => {
    const prise = crossingHandsTake({ fps: 30, durationS: 2 });
    expect(prise.frames.every((f) => f.hands.length === 2)).toBe(true);
    const cotes = new Set(prise.frames[0]!.hands.map((h) => h.side));
    expect(cotes.size).toBe(2);
    const debut = prise.frames[0]!.hands.map((h) => palmCenter(h)[0]);
    const fin = prise.frames[prise.frames.length - 1]!.hands.map((h) => palmCenter(h)[0]);
    // L'ordre des deux mains en x s'inverse entre le début et la fin.
    expect(Math.sign(debut[0]! - debut[1]!)).toBe(-Math.sign(fin[0]! - fin[1]!));
  });

  it("leftHandOnlyTake : une seule main, côté gauche (prise de référence §7.3)", () => {
    const prise = leftHandOnlyTake({ fps: 30, durationS: 1 });
    expect(prise.frames.every((f) => f.hands.length === 1)).toBe(true);
    expect(prise.frames.every((f) => f.hands[0]!.side === "left")).toBe(true);
  });

  it("withDroppedFrames : moins d'images, horodatages conservés, cadence irrégulière", () => {
    const prise = linearTake({ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }, { fps: 30, durationS: 1 });
    const trouee = withDroppedFrames(prise, 3);
    expect(trouee.frames.length).toBeLessThan(prise.frames.length);
    const attends = prise.frames.filter((_, i) => i % 3 !== 2).map((f) => f.t);
    expect(trouee.frames.map((f) => f.t)).toEqual(attends);
    const ecarts = new Set(trouee.frames.slice(1).map((f, i) => Number((f.t - trouee.frames[i]!.t).toFixed(6))));
    expect(ecarts.size).toBeGreaterThan(1); // cadence irrégulière
  });

  it("withHand ajoute une main sans toucher aux autres", () => {
    const prise = leftHandOnlyTake({ fps: 30, durationS: 0.5 });
    const deux = withHand(prise, () => makeHand({ x: 0.7, y: 0.5, side: "right" }));
    expect(deux.frames.every((f) => f.hands.length === 2)).toBe(true);
    expect(deux.frames[0]!.hands[0]!.side).toBe("left");
    expect(deux.frames[0]!.hands[1]!.side).toBe("right");
    const sansMain = withHand(prise, () => null);
    expect(sansMain.frames.every((f) => f.hands.length === 1)).toBe(true);
  });

  it("fastJabTake : un coup bref, avec des images sans main avant et après", () => {
    const prise = fastJabTake({ fps: 30, durationS: 1 });
    const avecMain = prise.frames.filter((f) => f.hands.length === 1);
    const sansMain = prise.frames.filter((f) => f.hands.length === 0);
    expect(avecMain.length).toBeGreaterThan(0);
    expect(sansMain.length).toBeGreaterThan(0);
    expect(avecMain.length).toBeLessThan(prise.frames.length / 2);
  });

  it("alea : une graine donne toujours la même suite, deux graines diffèrent", () => {
    const a = Array.from({ length: 5 }, () => 0).map(() => alea(42)());
    const b = Array.from({ length: 5 }, () => 0).map(() => alea(42)());
    expect(a).toEqual(b);
    const tirage = alea(42);
    const suite = Array.from({ length: 5 }, () => tirage());
    const autre = alea(43);
    expect(suite).not.toEqual(Array.from({ length: 5 }, () => autre()));
    for (const v of suite) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("aucune prise ne contient autre chose que des instants, des côtés, des scores et des points", () => {
    const prises = [
      linearTake({ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }),
      tremorTake({ x: 0.5, y: 0.5 }, 0.01),
      sweepTake(0.2, 0.4),
      handLeavesTake({ x: 0.5, y: 0.5 }, 1),
      crossingHandsTake(),
      leftHandOnlyTake(),
      fastJabTake(),
    ];
    for (const prise of prises) {
      expect(Object.keys(prise).sort()).toEqual(["format", "fps", "frames"]);
      for (const image of prise.frames) {
        expect(Object.keys(image).sort()).toEqual(["hands", "t"]);
        for (const main of image.hands) {
          expect(Object.keys(main).sort()).toEqual(["points", "score", "side"]);
        }
      }
    }
  });
});
