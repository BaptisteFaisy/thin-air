import { describe, expect, it } from "vitest";
import { defaultPlayRect, toPlayPosition } from "@thin-air/core";
import { HAND_SCALE, imagePoint, keyboardHand, pointerHand } from "./virtualHand.js";

const rect = defaultPlayRect();

describe("la main virtuelle du jeu sans caméra (AIR-F-02, P2)", () => {
  it("une main de 21 points, dans l'ordre du modèle de vision", () => {
    const main = pointerHand(0.5, 0.5, rect);
    expect(main.points.length).toBe(21);
    expect(main.side).toBe("right");
    expect(main.score).toBe(1);
    for (const point of main.points) expect(point.length).toBe(3);
  });

  it("la même position redonne exactement la même main (AIR-N-09)", () => {
    expect(pointerHand(0.3, 0.7, rect)).toEqual(pointerHand(0.3, 0.7, rect));
  });

  it("P2 — la main virtuelle retombe sur la position du pointeur", () => {
    const position = toPlayPosition(imagePoint(0.4, 0.6, rect)[0], imagePoint(0.4, 0.6, rect)[1], rect, 4 / 3);
    expect(position.u).toBeCloseTo(0.4, 5);
    expect(position.v).toBeCloseTo(0.6, 5);
  });

  it("la main garde une échelle non nulle, pour que les mesures existent", () => {
    const main = pointerHand(0.5, 0.5, rect);
    const poignet = main.points[0]!;
    const majeur = main.points[9]!;
    expect(Math.hypot(majeur[0] - poignet[0], majeur[1] - poignet[1])).toBeGreaterThan(0);
    expect(HAND_SCALE).toBeGreaterThan(0);
  });

  it("le clavier pose la main sur la corde jouée", () => {
    const main = keyboardHand(3, 16, 0.5, rect);
    const [x, y] = imagePoint(3.5 / 16, 0.5, rect);
    const poignet = main.points[0]!;
    expect(poignet[0]).toBeCloseTo(x, 5);
    expect(poignet[1]).toBeCloseTo(y + 0.55 * HAND_SCALE, 5);
  });

  it("hors de la zone, la main reste bornée", () => {
    const main = pointerHand(5, -2, rect);
    for (const point of main.points) {
      expect(point[0]).toBeGreaterThanOrEqual(-1);
      expect(point[0]).toBeLessThanOrEqual(2);
    }
    expect(keyboardHand(0, 0, 0.5, rect).points.length).toBe(21);
  });
});
