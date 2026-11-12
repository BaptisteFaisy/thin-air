/**
 * La leçon « la couture des deux horloges » est des nombres, pas une
 * illustration : chaque assertion cite la section du cahier dont elle vient
 * (§5.1, §7.9, §7.13) ou la propriété qu'elle vérifie (AIR-P-11).
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  SAMPLE_RATE,
  linearTake,
  poseFromPlay,
  withDroppedFrames,
} from "@thin-air/core";
import type { MusicEvent } from "@thin-air/core";
import { latencyInitiale } from "../state/latency.js";
import { buildHorlogesLesson, enEchantillons, retardsAnnonces } from "./horlogesLesson.js";

const PRISE = linearTake(poseFromPlay(0.2, 0.5), poseFromPlay(0.8, 0.5), { fps: 30, durationS: 1 });

// Les composantes de l'exemple affiché du §5.2 : analyse 12 ms, traitement
// 2 ms, sortie audio 21 ms ; la caméra garde l'estimation des réglages (§7.13).
const PARTIES = {
  ...latencyInitiale(DEFAULT_SETTINGS),
  inferenceMs: 12,
  processingMs: 2,
  audioBaseMs: 21,
  audioOutputMs: 0,
};

const EVENEMENTS: readonly MusicEvent[] = [
  { type: "noteOff", t: 0.3, voice: "v1" },
  { type: "noteOn", t: 0.1, voice: "v1", midi: 69, velocity: 0.8 },
  { type: "control", t: 0.2, voice: "v1", param: "pitch", value: 71 },
];

describe("leçon les deux horloges (§7.9)", () => {
  const lecon = buildHorlogesLesson(PRISE, EVENEMENTS, PARTIES);

  it("les deux horloges sont cohérentes : 48 000 échantillons/s contre 30 images/s", () => {
    expect(lecon.echantillonsParSeconde).toBe(SAMPLE_RATE);
    expect(lecon.echantillonsParSeconde).toBe(48_000);
    expect(lecon.imagesParSeconde).toBe(30);
    expect(lecon.echantillonsParImage).toBe(1_600);
    expect(lecon.pasImageMs).toBeCloseTo(33.333, 2);
    expect(lecon.images).toHaveLength(31); // 1 s à 30 im/s, première image à zéro
  });

  it("la programmation avance de 5 ms sur le présent audio (§7.9 règle 2, §7.13)", () => {
    expect(lecon.avanceMs).toBe(DEFAULT_SETTINGS.lookaheadMs);
    expect(lecon.avanceMs).toBe(5);
    for (const image of lecon.images) {
      expect(image.programmeS - image.tS).toBeCloseTo(0.005, 9);
      expect(image.programmeSample).toBe(enEchantillons(image.programmeS));
    }
  });

  it("les moments en échantillons sont ceux que voient les voix (§7.9)", () => {
    expect(enEchantillons(1)).toBe(48_000);
    expect(enEchantillons(0.005)).toBe(240); // l'avance, en échantillons
    for (const e of lecon.evenements) expect(e.tSample).toBe(Math.round(e.tS * SAMPLE_RATE));
  });

  it("les événements reviennent datés sur l'horloge du son, triés (§7.9 règle 2)", () => {
    expect(lecon.evenements.map((e) => e.tS)).toEqual([0.1, 0.2, 0.3]);
    expect(lecon.evenements.map((e) => e.type)).toEqual(["noteOn", "control", "noteOff"]);
  });

  it("le retard affiché est la somme annoncée (§5.1, §5.2)", () => {
    const r = lecon.retards;
    expect(r.mesureMs).toBe(35); // analyse 12 + traitement 2 + sortie 21
    expect(r.estimeCameraMs).toBe(DEFAULT_SETTINGS.cameraLatencyMs); // 50, estimé
    expect(r.totalMs).toBe(r.mesureMs + r.estimeCameraMs);
  });

  it("avant toute mesure, seule la caméra compte — et elle est estimée (§5.1)", () => {
    const r = retardsAnnonces(latencyInitiale(DEFAULT_SETTINGS));
    expect(r.mesureMs).toBe(0);
    expect(r.estimeCameraMs).toBe(50);
    expect(r.totalMs).toBe(50);
  });

  it("l'horloge des images hoquette, la programmation ne recule jamais (AIR-P-11)", () => {
    const hoquet = buildHorlogesLesson(withDroppedFrames(PRISE, 3), EVENEMENTS, PARTIES);
    expect(hoquet.images.length).toBeLessThan(lecon.images.length);
    for (let i = 1; i < hoquet.images.length; i += 1) {
      expect(hoquet.images[i]!.programmeS).toBeGreaterThanOrEqual(hoquet.images[i - 1]!.programmeS);
    }
  });

  it("déterministe : les mêmes entrées donnent la même frise (AIR-N-09)", () => {
    const autre = buildHorlogesLesson(PRISE, EVENEMENTS, PARTIES);
    expect(JSON.stringify(autre)).toBe(JSON.stringify(lecon));
  });
});
