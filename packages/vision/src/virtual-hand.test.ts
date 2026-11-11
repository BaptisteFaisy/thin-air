/**
 * La géométrie de la main virtuelle (AIR-F-02) : 21 points dans l'ordre du
 * modèle, ancrés sur le curseur, bornés dans l'image, déterministes.
 * Aucune logique musicale ici — seulement des points.
 */
import { describe, expect, it } from "vitest";
import {
  INDEX_INDEX,
  NOTE_KEYS,
  OFFSETS_INDEX,
  OFFSETS_PALM,
  PAUME_INDEX,
  POSITION_DEPART,
  applyKey,
  isWellFormed,
  keyToU,
  normalisePointer,
  screenToImage,
  virtualHand,
} from "./virtual-hand.js";

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot((b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0));
}

describe("virtualHand — une main conforme au contrat du modèle", () => {
  it("rend 21 points bornés, un côté et un score", () => {
    const main = virtualHand(0.5, 0.5);
    expect(isWellFormed(main)).toBe(true);
    expect(main.points).toHaveLength(21);
    expect(main.side).toBe("right");
    expect(main.score).toBe(1);
  });

  it("déterministe : mêmes entrées, exactement mêmes points", () => {
    expect(virtualHand(0.3, 0.7, { side: "left" }).points).toEqual(
      virtualHand(0.3, 0.7, { side: "left" }).points,
    );
  });

  it("ancrage « index » : le bout de l'index est exactement sur le curseur", () => {
    const main = virtualHand(0.4, 0.6, { anchor: "index" });
    expect(main.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.4, 10);
    expect(main.points[INDEX_INDEX]?.[1]).toBeCloseTo(0.6, 10);
  });

  it("ancrage « paume » : le centre de la paume est exactement sur le curseur", () => {
    const main = virtualHand(0.4, 0.6, { anchor: "palm" });
    const centre = PAUME_INDEX.map((index) => main.points[index] ?? [0, 0, 0]);
    const x = centre.reduce((somme, point) => somme + (point[0] ?? 0), 0) / centre.length;
    const y = centre.reduce((somme, point) => somme + (point[1] ?? 0), 0) / centre.length;
    expect(x).toBeCloseTo(0.4, 10);
    expect(y).toBeCloseTo(0.6, 10);
  });

  it("les décalages publiés sont ancrés à l'origine", () => {
    expect(OFFSETS_INDEX[INDEX_INDEX] ?? []).toEqual([0, 0]);
    let sommeX = 0;
    let sommeY = 0;
    for (const index of PAUME_INDEX) {
      sommeX += OFFSETS_PALM[index]?.[0] ?? 0;
      sommeY += OFFSETS_PALM[index]?.[1] ?? 0;
    }
    expect(sommeX).toBeCloseTo(0, 10);
    expect(sommeY).toBeCloseTo(0, 10);
  });

  it("main ouverte : la pince, rapportée à l'échelle de la paume, dépasse le seuil haut (§7.13)", () => {
    const main = virtualHand(0.5, 0.5, { pose: "open", scale: 0.18 });
    const paume = distance(main.points[0] ?? [], main.points[9] ?? []);
    const pince = distance(main.points[4] ?? [], main.points[8] ?? []) / paume;
    expect(pince).toBeGreaterThan(0.4);
  });

  it("main pincée : le pouce rejoint le bout de l'index, sous le seuil bas", () => {
    const main = virtualHand(0.5, 0.5, { pose: "pinch", scale: 0.18 });
    expect(main.points[4]).toEqual(main.points[8]);
    const paume = distance(main.points[0] ?? [], main.points[9] ?? []);
    expect(distance(main.points[4] ?? [], main.points[8] ?? []) / paume).toBeLessThan(0.25);
  });

  it("la pince est indépendante de la taille de la main (échelle de paume, §7.4)", () => {
    const pinceDe = (scale: number) => {
      const main = virtualHand(0.5, 0.5, { pose: "open", scale });
      const paume = distance(main.points[0] ?? [], main.points[9] ?? []);
      return distance(main.points[4] ?? [], main.points[8] ?? []) / paume;
    };
    expect(pinceDe(0.05)).toBeCloseTo(pinceDe(0.4), 6);
  });

  it("près des bords, les points restent dans l'image (bornés)", () => {
    const bords: readonly (readonly [number, number])[] = [
      [0, 0],
      [1, 1],
      [-0.2, 1.3],
    ];
    for (const [x, y] of bords) {
      const main = virtualHand(x, y);
      expect(main.points.every((point) => point[0]! >= 0 && point[0]! <= 1)).toBe(true);
      expect(main.points.every((point) => point[1]! >= 0 && point[1]! <= 1)).toBe(true);
      expect(isWellFormed(main)).toBe(true);
    }
  });

  it("l'échelle change la taille de la main, pas son ancrage", () => {
    const petite = virtualHand(0.5, 0.5, { scale: 0.05 });
    const grande = virtualHand(0.5, 0.5, { scale: 0.4 });
    const ecartPetite = distance(petite.points[0] ?? [], petite.points[9] ?? []);
    const ecartGrande = distance(grande.points[0] ?? [], grande.points[9] ?? []);
    expect(ecartGrande).toBeGreaterThan(ecartPetite * 2);
    expect(grande.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.5, 10);
  });

  it("le côté demandé est respecté (main de volume à gauche)", () => {
    expect(virtualHand(0.5, 0.5, { side: "left" }).side).toBe("left");
  });
});

describe("screenToImage et normalisePointer — un seul retournement (§7.4)", () => {
  it("le coin haut-gauche de l'écran est le coin haut-droit de l'image", () => {
    expect(screenToImage(0, 1)).toEqual([1, 0]);
    expect(screenToImage(1, 0)).toEqual([0, 1]);
    expect(screenToImage(0.5, 0.5)).toEqual([0.5, 0.5]);
  });

  it("screenToImage borne toute valeur extravagante", () => {
    const [x, y] = screenToImage(3, -2);
    expect(x).toBe(0);
    expect(y).toBe(1);
  });

  it("le curseur au centre du cadre donne le centre du jeu", () => {
    const cadre = { left: 100, top: 50, width: 800, height: 600 };
    expect(normalisePointer(500, 350, cadre)).toEqual({ u: 0.5, v: 0.5 });
  });

  it("vers la droite de l'écran, u augmente ; vers le haut, v augmente", () => {
    const cadre = { left: 0, top: 0, width: 100, height: 100 };
    expect(normalisePointer(80, 20, cadre).u).toBeCloseTo(0.8, 10);
    expect(normalisePointer(80, 20, cadre).v).toBeCloseTo(0.8, 10);
  });

  it("hors du cadre, la position est bornée", () => {
    const cadre = { left: 0, top: 0, width: 100, height: 100 };
    expect(normalisePointer(-50, 400, cadre)).toEqual({ u: 0, v: 0 });
    expect(normalisePointer(900, -400, cadre)).toEqual({ u: 1, v: 1 });
  });

  it("un cadre dégénéré ne divise pas par zéro", () => {
    const cadre = { left: 10, top: 10, width: 0, height: 0 };
    const { u, v } = normalisePointer(10, 10, cadre);
    expect(Number.isFinite(u)).toBe(true);
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe("applyKey et keyToU — le clavier pose la main", () => {
  it("les flèches déplacent la main d'un pas", () => {
    expect(applyKey(POSITION_DEPART, "ArrowRight", 0.1)).toEqual({ u: 0.6, v: 0.5 });
    expect(applyKey(POSITION_DEPART, "ArrowLeft", 0.1)).toEqual({ u: 0.4, v: 0.5 });
    expect(applyKey(POSITION_DEPART, "ArrowUp", 0.1)).toEqual({ u: 0.5, v: 0.6 });
    expect(applyKey(POSITION_DEPART, "ArrowDown", 0.1)).toEqual({ u: 0.5, v: 0.4 });
  });

  it("une touche inconnue ne bouge rien", () => {
    expect(applyKey(POSITION_DEPART, "Escape")).toEqual(POSITION_DEPART);
  });

  it("le déplacement reste borné, même en insistant", () => {
    let position = POSITION_DEPART;
    for (let i = 0; i < 100; i += 1) position = applyKey(position, "ArrowRight", 0.2);
    expect(position.u).toBe(1);
    for (let i = 0; i < 100; i += 1) position = applyKey(position, "ArrowUp", 0.2);
    expect(position.v).toBe(1);
  });

  it("un pas absurde retombe sur le pas par défaut", () => {
    expect(applyKey(POSITION_DEPART, "ArrowRight", 0)).toEqual({ u: 0.55, v: 0.5 });
    expect(applyKey(POSITION_DEPART, "ArrowRight", Number.NaN)).toEqual({ u: 0.55, v: 0.5 });
  });

  it("la rangée de notes va de la colonne 0 à la colonne 1", () => {
    expect(keyToU("KeyA")).toBe(0);
    expect(keyToU("KeyK")).toBe(1);
    expect(keyToU("KeyG")).toBeCloseTo(0.5833333, 5);
    expect(keyToU("Space")).toBeNull();
  });

  it("une touche de la rangée pose la main sur sa colonne", () => {
    expect(applyKey(POSITION_DEPART, "KeyA")).toEqual({ u: 0, v: 0.5 });
    expect(applyKey(POSITION_DEPART, "KeyK")).toEqual({ u: 1, v: 0.5 });
  });

  it("la rangée est stable et sans doublon", () => {
    expect(NOTE_KEYS.length).toBe(13);
    expect(new Set(NOTE_KEYS).size).toBe(NOTE_KEYS.length);
  });
});
