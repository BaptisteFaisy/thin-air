/**
 * Le piège du côté (cahier §7.3, annexe D) et la traduction du résultat brut
 * du modèle en `DetectedHand`.
 *
 * La convention, écrite une fois pour toutes : MediaPipe annonce le côté du
 * SUJET, et une image retournée en miroir inverse ces sorties. Thin Air envoie
 * au modèle l'image BRUTE de la caméra (le miroir de l'affichage est un
 * `transform` CSS, il ne touche pas les pixels analysés), donc
 * `mirrored = false` et le côté annoncé est déjà le bon. La preuve est la prise
 * de référence `left-hand-only` : seule la main gauche levée DOIT donner
 * « left ».
 */
import { describe, expect, it } from "vitest";
import type { DetectedHand, HandPoint } from "@thin-air/core";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { monotonicTimestamp, normaliseSides, oppositeSide, toDetectedHands } from "./sides.js";
import { virtualHand } from "./virtual-hand.js";

/** La prise de référence `left-hand-only` : une main, la gauche, 21 points. */
const LEFT_HAND_ONLY: DetectedHand = virtualHand(0.4, 0.5, { side: "left" });

function resultatBrut(
  mains: readonly { cote: "Left" | "Right"; score: number; nb: number }[],
): HandLandmarkerResult {
  const points = (nb: number) =>
    Array.from({ length: nb }, (_, index) => ({
      x: index / 100,
      y: 0.25,
      z: index / 1000,
      visibility: 1,
    }));
  return {
    landmarks: mains.map((main) => points(main.nb)),
    worldLandmarks: [],
    handedness: mains.map((main) => [
      { score: main.score, index: main.cote === "Left" ? 0 : 1, categoryName: main.cote, displayName: main.cote },
    ]),
    handednesses: [],
  } as unknown as HandLandmarkerResult;
}

describe("normaliseSides — la règle du côté", () => {
  it("left-hand-only, image brute (mirrored = false) : « left » reste « left »", () => {
    const [main] = normaliseSides([LEFT_HAND_ONLY], false);
    expect(main?.side).toBe("left");
  });

  it("left-hand-only, image retournée (mirrored = true) : « left » devient « right »", () => {
    const [main] = normaliseSides([LEFT_HAND_ONLY], true);
    expect(main?.side).toBe("right");
  });

  it("le miroir est une involution : deux retournements ramènent le côté", () => {
    const uneFois = normaliseSides([LEFT_HAND_ONLY], true);
    const deuxFois = normaliseSides(uneFois, true);
    expect(deuxFois[0]?.side).toBe(LEFT_HAND_ONLY.side);
  });

  it("ne modifie ni les points ni le score", () => {
    const [main] = normaliseSides([LEFT_HAND_ONLY], true);
    expect(main?.points).toEqual(LEFT_HAND_ONLY.points);
    expect(main?.score).toBe(LEFT_HAND_ONLY.score);
  });

  it("rend une nouvelle liste : la prise d'origine n'est jamais touchée", () => {
    const avant = [{ ...LEFT_HAND_ONLY }] as readonly DetectedHand[];
    const apres = normaliseSides(avant, true);
    expect(apres).not.toBe(avant);
    expect(apres[0]).not.toBe(avant[0]);
    expect(avant[0]?.side).toBe("left");
  });

  it("deux mains gardent leur ordre et échangent chacune son côté", () => {
    const deux = resultatBrut([
      { cote: "Left", score: 0.9, nb: 21 },
      { cote: "Right", score: 0.8, nb: 21 },
    ]);
    const mains = toDetectedHands(deux);
    expect(mains.map((main) => main.side)).toEqual(["left", "right"]);
    expect(normaliseSides(mains, true).map((main) => main.side)).toEqual(["right", "left"]);
  });

  it("oppositeSide est l'aller-retour des deux côtés", () => {
    expect(oppositeSide("left")).toBe("right");
    expect(oppositeSide("right")).toBe("left");
    expect(oppositeSide(oppositeSide("left"))).toBe("left");
  });

  it("une liste vide reste vide", () => {
    expect(normaliseSides([], true)).toEqual([]);
  });

  it.todo(
    "AIR-F-04 — la prise de référence réelle takes/reference/left-hand-only confirme la convention sur un essai caméra — dépend du lot B3",
  );
});

describe("toDetectedHands — du résultat brut au contrat", () => {
  it("rend 21 points, le côté et son score", () => {
    const [main] = toDetectedHands(resultatBrut([{ cote: "Left", score: 0.97, nb: 21 }]));
    expect(main?.side).toBe("left");
    expect(main?.score).toBeCloseTo(0.97, 10);
    expect(main?.points).toHaveLength(21);
    expect(main?.points[0]).toEqual([0, 0.25, 0]);
  });

  it("les points sont des triplets [x, y, z] dans l'ordre du modèle", () => {
    const [main] = toDetectedHands(resultatBrut([{ cote: "Right", score: 0.6, nb: 21 }]));
    const points = main?.points ?? [];
    expect(points.every((point: HandPoint) => point.length === 3)).toBe(true);
    expect(points[8]).toEqual([0.08, 0.25, 0.008]);
  });

  it("un côté absent retombe sur « right » avec un score nul, sans planter", () => {
    const brut = {
      landmarks: [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))],
      worldLandmarks: [],
      handedness: [[]],
      handednesses: [],
    } as unknown as HandLandmarkerResult;
    const [main] = toDetectedHands(brut);
    expect(main?.side).toBe("right");
    expect(main?.score).toBe(0);
    expect(main?.points).toHaveLength(21);
  });

  it("un score non fini retombe sur 0", () => {
    const brut = {
      landmarks: [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))],
      worldLandmarks: [],
      handedness: [[{ score: Number.NaN, index: 0, categoryName: "Left", displayName: "Left" }]],
      handednesses: [],
    } as unknown as HandLandmarkerResult;
    const [main] = toDetectedHands(brut);
    expect(main?.side).toBe("left");
    expect(main?.score).toBe(0);
  });

  it("une main sans points est ignorée : elle ne dit rien", () => {
    const brut = resultatBrut([{ cote: "Left", score: 0.9, nb: 0 }]);
    expect(toDetectedHands(brut)).toEqual([]);
  });

  it("aucune main → aucune main", () => {
    expect(toDetectedHands(resultatBrut([]))).toEqual([]);
  });
});

describe("monotonicTimestamp — detectForVideo exige du croissant", () => {
  it("le premier horodatage passe tel quel, arrondi et positif", () => {
    expect(monotonicTimestamp(null, 12.4)).toBe(12);
    expect(monotonicTimestamp(null, -5)).toBe(0);
  });

  it("un horodatage répété ou en arrière avance d'au moins 1 ms", () => {
    expect(monotonicTimestamp(100, 100)).toBe(101);
    expect(monotonicTimestamp(100, 40)).toBe(101);
  });

  it("un horodatage plus tard passe tel quel", () => {
    expect(monotonicTimestamp(100, 133)).toBe(133);
  });

  it("une valeur non finie ne produit jamais NaN", () => {
    expect(Number.isFinite(monotonicTimestamp(5, Number.NaN))).toBe(true);
    expect(monotonicTimestamp(5, Number.POSITIVE_INFINITY)).toBe(6);
  });
});
