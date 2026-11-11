/**
 * Attribution des rôles (§7.3) et propriété AIR-P-21 : deux mains qui se
 * croisent sans disparaître n'échangent pas leurs rôles.
 */
import { describe, expect, it } from "vitest";
import type { DetectedHand } from "./types.js";
import { DEFAULT_SETTINGS, withSettings } from "./defaults.js";
import { ROLE_MEMORY_S, RoleTracker, roleForSide } from "./roles.js";
import { crossingHandsTake, leftHandOnlyTake, makeHand } from "./takeGen.js";

function mains(xDroite: number, xGauche: number, y = 0.5): DetectedHand[] {
  return [
    makeHand({ x: xDroite, y, side: "right" }),
    makeHand({ x: xGauche, y, side: "left" }),
  ];
}

describe("roles — attribution par le côté (§7.3)", () => {
  it("la main droite est la hauteur, la gauche le volume", () => {
    expect(roleForSide("right", false)).toBe("pitch");
    expect(roleForSide("left", false)).toBe("volume");
  });

  it("le réglage gaucher inverse les rôles (AIR-F-11)", () => {
    expect(roleForSide("right", true)).toBe("volume");
    expect(roleForSide("left", true)).toBe("pitch");
    const tracker = new RoleTracker(withSettings({ leftHanded: true }));
    const affectes = tracker.push(0, mains(0.6, 0.4));
    const droite = affectes.find((a) => a.side === "right");
    expect(droite?.role).toBe("volume");
  });

  it("une seule main prend le rôle de hauteur", () => {
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    const affectes = tracker.push(0, [makeHand({ x: 0.5, y: 0.5, side: "left" })]);
    expect(affectes).toHaveLength(1);
    expect(affectes[0]!.role).toBe("pitch");
  });

  it("la prise left-hand-only donne le côté gauche (§7.3, recette §18)", () => {
    const prise = leftHandOnlyTake({ fps: 30, durationS: 1 });
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    const cotes = new Set<string>();
    for (const image of prise.frames) {
      for (const a of tracker.push(image.t, image.hands)) cotes.add(a.side);
    }
    expect([...cotes]).toEqual(["left"]);
  });

  it("aucune main : aucun rôle", () => {
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    expect(tracker.push(0, [])).toEqual([]);
  });
});

describe("roles — AIR-P-21 : continuité quand les mains se croisent", () => {
  it("les rôles ne s'échangent pas pendant le croisement", () => {
    const prise = crossingHandsTake({ fps: 30, durationS: 2 });
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    const idParRole = new Map<string, Set<number>>();
    const coteParRole = new Map<string, Set<string>>();
    for (const image of prise.frames) {
      for (const a of tracker.push(image.t, image.hands)) {
        if (!idParRole.has(a.role)) idParRole.set(a.role, new Set());
        idParRole.get(a.role)!.add(a.id);
        if (!coteParRole.has(a.role)) coteParRole.set(a.role, new Set());
        coteParRole.get(a.role)!.add(a.side);
      }
    }
    // Chaque rôle garde le même identifiant de continuité du début à la fin…
    for (const [role, ids] of idParRole) expect(ids.size, `rôle ${role}`).toBe(1);
    // … et reste attaché à la même main physique (son côté annoncé).
    for (const [role, cotes] of coteParRole) expect(cotes.size, `rôle ${role}`).toBe(1);
    expect(idParRole.size).toBe(2);
  });

  it("les positions des deux mains se croisent vraiment dans la prise de référence", () => {
    const prise = crossingHandsTake({ fps: 30, durationS: 2 });
    const debut = prise.frames[0]!.hands.map((h) => h.points[9]![0]);
    const fin = prise.frames[prise.frames.length - 1]!.hands.map((h) => h.points[9]![0]);
    expect(Math.sign(debut[0]! - debut[1]!)).toBe(-Math.sign(fin[0]! - fin[1]!));
  });

  it("le rôle suit la main la plus proche, pas l'ordre d'arrivée", () => {
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    const premier = tracker.push(0, mains(0.7, 0.3));
    const pitchId = premier.find((a) => a.role === "pitch")!.id;
    // Les deux mains sont données dans l'ordre inverse sur l'image suivante.
    const second = tracker.push(1 / 30, [
      makeHand({ x: 0.31, y: 0.5, side: "left" }),
      makeHand({ x: 0.69, y: 0.5, side: "right" }),
    ]);
    expect(second.find((a) => a.role === "pitch")!.id).toBe(pitchId);
  });
});

describe("roles — mémoire d'une demi-seconde (§7.3)", () => {
  it("une main qui revient avant ROLE_MEMORY_S garde son rôle et son identité", () => {
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    const avant = tracker.push(0, mains(0.7, 0.3));
    const pitch = avant.find((a) => a.role === "pitch")!;
    tracker.push(0.1, [makeHand({ x: 0.3, y: 0.5, side: "left" })]); // la droite disparaît
    const apres = tracker.push(0.1 + ROLE_MEMORY_S * 0.5, mains(0.7, 0.3));
    const pitchRetrouve = apres.find((a) => a.role === "pitch");
    expect(pitchRetrouve?.id).toBe(pitch.id);
  });

  it("au-delà de ROLE_MEMORY_S, la main est oubliée et réattribuée", () => {
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    const avant = tracker.push(0, mains(0.7, 0.3));
    const pitch = avant.find((a) => a.role === "pitch")!;
    for (let i = 1; i <= 20; i += 1) {
      tracker.push(i / 30, [makeHand({ x: 0.3, y: 0.5, side: "left" })]);
    }
    const apres = tracker.push(1, mains(0.7, 0.3));
    const pitchRetrouve = apres.find((a) => a.role === "pitch")!;
    expect(pitchRetrouve.id).not.toBe(pitch.id);
  });

  it("reset oublie les identités : la numérotation repart de 1", () => {
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    tracker.push(0, mains(0.7, 0.3));
    // La main droite disparaît plus d'une demi-seconde : son identité est perdue.
    for (let i = 1; i <= 30; i += 1) tracker.push(i / 30, [makeHand({ x: 0.3, y: 0.5, side: "left" })]);
    const avantReset = tracker.push(2, mains(0.7, 0.3));
    expect(Math.max(...avantReset.map((a) => a.id))).toBeGreaterThan(2);
    tracker.reset();
    const apresReset = tracker.push(2.03, mains(0.7, 0.3));
    expect(apresReset.map((a) => a.id).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("deux mains du même côté ne prennent pas deux fois le même rôle", () => {
    const tracker = new RoleTracker(DEFAULT_SETTINGS);
    const affectes = tracker.push(0, [
      makeHand({ x: 0.3, y: 0.5, side: "right" }),
      makeHand({ x: 0.7, y: 0.5, side: "right" }),
    ]);
    expect(affectes).toHaveLength(2);
    expect(new Set(affectes.map((a) => a.role)).size).toBe(2);
  });
});
