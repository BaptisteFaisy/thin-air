import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, defaultPlayRect } from "@thin-air/core";
import { CHOIR, HARP, PHANTOM } from "../state/presets.js";
import { emptyDisplay, reduceDisplay, type MusicTools } from "../state/display.js";
import {
  buildScene,
  decayEnergy,
  hoveredIndex,
  LEVEL_SPEED,
  moveLevel,
  pushTrail,
  stringPositions,
  TRAIL_MAX,
  type HandInput,
  type SceneInput,
} from "./geometry.js";

const outils: MusicTools = {
  noteName: (midi) => `note-${midi}`,
  midiToFreq: (midi) => midi * 2,
  gainToDb: () => 0,
};

const rect = defaultPlayRect();
const main: HandInput = { role: "pitch", side: "right", u: 0.4, v: 0.6 };

function entree(partiel: Partial<SceneInput> = {}): SceneInput {
  return {
    width: 800,
    height: 450,
    hands: [main],
    previous: null,
    display: emptyDisplay(),
    instrument: HARP,
    rect,
    reducedMotion: false,
    settings: DEFAULT_SETTINGS,
    hovered: null,
    dtS: 1 / 60,
    ...partiel,
  };
}

describe("géométrie de la scène (cahier §11.8, §12.3)", () => {
  it("les cordes sont au centre de leur part, comme le dit le cahier §7.6", () => {
    expect(stringPositions(4)).toEqual([0.125, 0.375, 0.625, 0.875]);
    expect(stringPositions(0)).toEqual([]);
    expect(stringPositions(HARP.strings!.count).length).toBe(16);
  });

  it("la harpe dessine ses cordes, le chœur ses zones, le thérémine sa courbe", () => {
    expect(buildScene(entree()).strings.length).toBe(16);
    expect(buildScene(entree({ instrument: CHOIR })).zones.length).toBe(8);
    expect(buildScene(entree({ instrument: PHANTOM })).strings).toEqual([]);
  });

  it("une main est placée dans la zone de jeu, en pixels", () => {
    const modele = buildScene(entree());
    const dessin = modele.hands[0]!;
    expect(dessin.x).toBeCloseTo((0.1 + 0.4 * 0.8) * 800, 5);
    expect(dessin.y).toBeCloseTo((1 - (0.1 + 0.6 * 0.8)) * 450, 5);
  });

  it("§12.3 — la traîne est légère et bornée", () => {
    let trail = pushTrail([], { x: 0, y: 0 }, false);
    for (let index = 1; index < TRAIL_MAX + 8; index += 1) trail = pushTrail(trail, { x: index, y: index }, false);
    expect(trail.length).toBe(TRAIL_MAX);
    expect(trail[TRAIL_MAX - 1]).toEqual({ x: TRAIL_MAX + 7, y: TRAIL_MAX + 7 });
  });

  it("AIR-N-06 — moins de mouvement : aucune traîne, aucune vibration", () => {
    expect(pushTrail([{ x: 1, y: 1 }], { x: 2, y: 2 }, true)).toEqual([]);
    const modele = buildScene(entree({ reducedMotion: true }));
    expect(modele.hands[0]!.trail).toEqual([]);
    const corde = buildScene(
      entree({
        reducedMotion: true,
        hovered: 3,
        previous: buildScene(entree({ hovered: 3, dtS: 5 })),
      }),
    ).strings[3]!;
    expect(corde.energy).toBe(1);
  });

  it("AIR-N-06 — un niveau ne change jamais plus vite que trois fois par seconde", () => {
    expect(moveLevel(0, 1, 1 / 60)).toBeCloseTo(LEVEL_SPEED / 60, 5);
    expect(moveLevel(0, 1, 1)).toBe(1);
    expect(moveLevel(1, 0, 1 / 60)).toBeCloseTo(1 - LEVEL_SPEED / 60, 5);
    expect(moveLevel(0.5, 0.5, 1)).toBe(0.5);
    expect(moveLevel(2, -3, 1)).toBe(0);
  });

  it("l'énergie d'une corde décroît, et remonte dès qu'elle est rejouée", () => {
    const modele = buildScene(entree({ hovered: 2 }));
    expect(modele.strings[2]!.energy).toBe(1);
    const suivant = buildScene(entree({ previous: modele, dtS: 0.35 }));
    expect(suivant.strings[2]!.energy).toBeCloseTo(0.5, 1);
    const rejoue = buildScene(entree({ previous: suivant, hovered: 2, dtS: 0.35 }));
    expect(rejoue.strings[2]!.energy).toBe(1);
    expect(decayEnergy(1, 0)).toBe(1);
  });

  it("§12.3 — la bougie du chœur s'allume dans la zone tenue", () => {
    const display = reduceDisplay(emptyDisplay(), [{ type: "noteOn", t: 0, voice: "z2", midi: 55, velocity: 1 }], CHOIR, outils);
    const modele = buildScene(entree({ instrument: CHOIR, display, dtS: 1 }));
    expect(modele.zones[2]!.candle).toBe(1);
    expect(modele.zones[3]!.candle).toBe(0);
  });

  it("§12.3 — la courbe de hauteur suit les dernières notes du thérémine", () => {
    const notes = [50, 57, 62].map(
      (midi, index) => ({ type: "noteOn", t: index, voice: `v${index}`, midi, velocity: 1 }) as const,
    );
    const display = reduceDisplay(emptyDisplay(), notes, PHANTOM, outils);
    const modele = buildScene(entree({ instrument: PHANTOM, display }));
    expect(modele.curve.length).toBe(3);
    expect(modele.curve[2]!.y).toBeLessThan(modele.curve[0]!.y);
  });

  it("moins de mouvement : pas de courbe, seulement des états", () => {
    const notes = [50, 57].map((midi, index) => ({ type: "noteOn", t: index, voice: `v${index}`, midi, velocity: 1 }) as const);
    const display = reduceDisplay(emptyDisplay(), notes, PHANTOM, outils);
    expect(buildScene(entree({ instrument: PHANTOM, display, reducedMotion: true })).curve).toEqual([]);
  });

  it("une main seulement en mode « une main » (AIR-F-10)", () => {
    const deuxMains: HandInput[] = [main, { role: "volume", side: "left", u: 0.2, v: 0.3 }];
    expect(buildScene(entree({ hands: deuxMains })).hands.length).toBe(2);
    const uneMain = buildScene(entree({ hands: deuxMains, settings: { ...DEFAULT_SETTINGS, oneHand: true } }));
    expect(uneMain.hands.length).toBe(1);
  });

  it("P2 — la corde visée par le pointeur est la plus proche", () => {
    const modele = buildScene(entree());
    // 0,5 tombe exactement entre les cordes 7 et 8 : le plus petit indice gagne.
    expect(hoveredIndex(modele, 0.5, 0.5)).toBe(7);
    expect(hoveredIndex(modele, 0.55, 0.5)).toBe(8);
    expect(hoveredIndex(modele, 0.01, 0.5)).toBe(0);
    expect(hoveredIndex(buildScene(entree({ instrument: CHOIR })), 0.9, 0.9)).toBe(7);
    expect(hoveredIndex(buildScene(entree({ instrument: PHANTOM })), 0.5, 0.5)).toBeNull();
  });

  it("§12.3 — l'image de caméra n'est demandée que par le réglage (AIR-F-52)", () => {
    expect(buildScene(entree()).showCamera).toBe(false);
    expect(buildScene(entree({ settings: { ...DEFAULT_SETTINGS, showCamera: true } })).showCamera).toBe(true);
  });
});
