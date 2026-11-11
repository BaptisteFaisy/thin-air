/**
 * Les deux leçons sont des nombres, pas des illustrations : chaque assertion
 * cite la section du cahier dont elle vient (§5.3, §7.5).
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SCALES } from "@thin-air/core";
import { buildFilterLesson, ecartType } from "./filterLesson.js";
import { buildCentsLesson, sweepCents, tremblementEnCents } from "./centsLesson.js";

const HARMONIQUE = { root: 50, steps: SCALES.harmonicMinor };
const ETENDUE = { low: 45, high: 81 };

describe("leçon filtrage (§7.5)", () => {
  const lecon = buildFilterLesson(0.01, { seed: 7, durationS: 2 });

  it("retrouve les α du tableau du cahier", () => {
    expect(lecon.alphaArret).toBeCloseTo(0.24, 2); // immobile, 1,5 Hz à 30 im/s
    expect(lecon.alphaRapide).toBeCloseTo(0.58, 2); // une largeur par seconde, 6,5 Hz
  });

  it("le canal lissé atténue le tremblement plus que le canal vif", () => {
    expect(lecon.ecartTypeBrut).toBeGreaterThan(0);
    expect(lecon.ecartTypeVif).toBeLessThan(lecon.ecartTypeBrut);
    expect(lecon.ecartTypeLisse).toBeLessThan(lecon.ecartTypeVif);
  });

  it("le canal vif retarde moins que le canal lissé", () => {
    expect(lecon.retardVifMs).toBeLessThanOrEqual(lecon.retardLisseMs);
  });

  it("les trois séries couvrent la même durée et restent bornées", () => {
    for (const serie of [lecon.brut, lecon.lisse, lecon.vif]) {
      expect(serie.length).toBe(lecon.brut.length);
      for (const p of serie) {
        expect(Number.isFinite(p.u)).toBe(true);
        expect(p.u).toBeGreaterThanOrEqual(0);
        expect(p.u).toBeLessThanOrEqual(1);
      }
    }
  });

  it("déterministe : la même graine donne les mêmes nombres", () => {
    const autre = buildFilterLesson(0.01, { seed: 7, durationS: 2 });
    expect(autre.ecartTypeLisse).toBe(lecon.ecartTypeLisse);
    expect(JSON.stringify(autre.lisse)).toBe(JSON.stringify(lecon.lisse));
  });

  it("baisser la coupure minimale lisse davantage (le réglage exposé sert à quelque chose)", () => {
    // `fcMin` est la coupure au repos : plus elle est basse, plus le tremblement
    // est écrasé. (`beta`, à l'inverse, ouvre le filtre quand la main va vite.)
    const doux = buildFilterLesson(0.01, { reglages: { fcMin: 0.5 }, seed: 7, durationS: 2 });
    const sec = buildFilterLesson(0.01, { reglages: { fcMin: 4 }, seed: 7, durationS: 2 });
    expect(doux.ecartTypeLisse).toBeLessThan(sec.ecartTypeLisse);
  });

  it("ecartType est exact sur un cas simple", () => {
    expect(ecartType([1, 1, 1])).toBe(0);
    expect(ecartType([-1, 1])).toBeCloseTo(1, 9);
    expect(ecartType([])).toBe(0);
  });

  it("les réglages par défaut sont bien ceux du §7.13", () => {
    expect(DEFAULT_SETTINGS.fcMin).toBe(1.5);
    expect(DEFAULT_SETTINGS.beta).toBe(5);
    expect(DEFAULT_SETTINGS.fcTrigger).toBe(6);
  });
});

describe("leçon centièmes (§5.3, §7.7)", () => {
  it("à aimant 1, l'écart est nul et la note est dans la gamme", () => {
    for (const u of [0, 0.17, 0.42, 0.68, 1]) {
      const r = buildCentsLesson(u, HARMONIQUE, ETENDUE, 1);
      expect(Math.abs(r.ecartCents)).toBeLessThan(1e-9);
      expect(SCALES.harmonicMinor).toContain(((r.jouee - 50) % 12 + 12) % 12);
    }
  });

  it("à aimant 0, l'écart reste borné par le plus grand intervalle de la gamme", () => {
    const balayage = sweepCents(HARMONIQUE, ETENDUE, 0);
    const max = Math.max(...balayage.map((p) => Math.abs(p.cents)));
    expect(max).toBeGreaterThan(0);
    // Le ré mineur harmonique contient une seconde augmentée (si♭ → do♯, trois
    // demi-tons) : la note visée peut donc s'écarter de la note de la gamme de
    // 1,5 demi-ton au pire, soit 150 centièmes. C'est exactement pourquoi
    // l'aimant existe (§5.3) — et pourquoi la gamme par tons, elle, borne à 100.
    expect(max).toBeLessThanOrEqual(150.0001);
    const tons = sweepCents({ root: 50, steps: SCALES.wholeTone }, ETENDUE, 0);
    expect(Math.max(...tons.map((p) => Math.abs(p.cents)))).toBeLessThanOrEqual(100.0001);
  });

  it("l'aimant réduit l'écart de façon monotone", () => {
    const u = 0.33;
    const ecarts = [0, 0.25, 0.5, 0.75, 1].map((a) => Math.abs(buildCentsLesson(u, HARMONIQUE, ETENDUE, a).ecartCents));
    for (let i = 1; i < ecarts.length; i += 1) expect(ecarts[i]!).toBeLessThanOrEqual(ecarts[i - 1]! + 1e-9);
    expect(ecarts[ecarts.length - 1]!).toBeCloseTo(0, 9);
  });

  it("retrouve le calcul du §5.3 : 0,5 % de la largeur sur 36 demi-tons = 18 centièmes", () => {
    expect(tremblementEnCents(0.005, 36)).toBeCloseTo(18, 9);
    // Et 2,2 cm par demi-ton sur 80 cm :
    expect(80 / 36).toBeCloseTo(2.22, 1);
  });

  it("le nom de note et la fréquence affichés sont cohérents", () => {
    const r = buildCentsLesson(0.3, HARMONIQUE, ETENDUE, 1);
    expect(r.jouee).toBe(55); // sol, comme dans l'exemple du §7.14
    expect(r.nom).toBe("G3");
    expect(r.frequenceJouee).toBeCloseTo(196, 1);
  });
});
