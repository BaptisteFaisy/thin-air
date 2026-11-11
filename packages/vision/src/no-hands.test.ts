/**
 * Le conseil « plus de lumière ou plus de recul » (cahier §7.2, AIR-F-06) :
 * trois secondes sans main ALORS que l'image change, une seule alerte par
 * série, réarmée dès qu'une main revient.
 */
import { describe, expect, it } from "vitest";
import { createNoHandsWatcher } from "./no-hands.js";

function pousser(
  watcher: ReturnType<typeof createNoHandsWatcher>,
  t: number,
  hasHands: boolean,
  newFrame = true,
): number | null {
  return watcher.push({ t, hasHands, newFrame });
}

describe("no-hands — AIR-F-06", () => {
  it("ne conseille rien avant trois secondes", () => {
    const w = createNoHandsWatcher();
    expect(pousser(w, 0, false)).toBeNull();
    expect(pousser(w, 1, false)).toBeNull();
    expect(pousser(w, 2.9, false)).toBeNull();
  });

  it("conseille à trois secondes, avec le seuil comme argument", () => {
    const w = createNoHandsWatcher();
    pousser(w, 0, false);
    expect(pousser(w, 3, false)).toBe(3);
  });

  it("jouer dans le noir dès le départ conseille aussi (P6)", () => {
    const w = createNoHandsWatcher();
    for (let t = 0; t <= 2.9; t += 0.1) expect(pousser(w, t, false)).toBeNull();
    expect(pousser(w, 3.1, false)).toBe(3);
  });

  it("une seule alerte par série, pas une par image", () => {
    const w = createNoHandsWatcher();
    pousser(w, 0, false);
    expect(pousser(w, 3, false)).toBe(3);
    expect(pousser(w, 4, false)).toBeNull();
    expect(pousser(w, 30, false)).toBeNull();
  });

  it("une main vue remet le compteur à zéro et réarme le conseil", () => {
    const w = createNoHandsWatcher();
    pousser(w, 0, false);
    pousser(w, 3, false);
    expect(pousser(w, 3.5, true)).toBeNull();
    expect(w.silentForS).toBe(0);
    expect(pousser(w, 6, false)).toBeNull();
    expect(pousser(w, 6.5, false)).toBe(3);
  });

  it("sans image nouvelle, aucune mesure et aucun conseil (AIR-F-03)", () => {
    const w = createNoHandsWatcher();
    pousser(w, 0, false);
    for (let i = 0; i < 10; i += 1) expect(pousser(w, 100, false, false)).toBeNull();
    expect(w.silentForS).toBe(0);
  });

  it("une image figée ne déclenche rien : il faut que l'image change", () => {
    const w = createNoHandsWatcher();
    pousser(w, 0, false);
    // Le même horodatage d'image n'est pas une image nouvelle.
    expect(pousser(w, 0, false, false)).toBeNull();
    expect(pousser(w, 5, false, false)).toBeNull();
  });

  it("le seuil est réglable", () => {
    const w = createNoHandsWatcher({ thresholdS: 1 });
    pousser(w, 0, false);
    expect(pousser(w, 0.9, false)).toBeNull();
    expect(pousser(w, 1, false)).toBe(1);
  });

  it("silentForS mesure le silence en cours", () => {
    const w = createNoHandsWatcher();
    pousser(w, 0, true);
    pousser(w, 1.5, false);
    expect(w.silentForS).toBeCloseTo(1.5, 5);
    pousser(w, 2, true);
    expect(w.silentForS).toBe(0);
  });

  it("reset remet tout à zéro, y compris l'alerte déjà donnée", () => {
    const w = createNoHandsWatcher();
    pousser(w, 0, false);
    pousser(w, 3, false);
    w.reset();
    expect(w.silentForS).toBe(0);
    pousser(w, 10, false);
    expect(pousser(w, 13, false)).toBe(3);
  });
});
