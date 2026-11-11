/**
 * Le total du retard, tel que le calcule `packages/audio/src/graph/latency.ts`
 * (cahier §5.1, §5.2 ; AIR-F-31, AIR-F-32, AIR-N-05, AIR-N-12).
 *
 * Ce test ne réécrit aucune logique : il appelle les fonctions réelles du
 * paquet `audio`. Le contrat public de ce paquet n'exporte pas encore
 * `graph/latency` (lot A5), d'où le chemin relatif vers le fichier source —
 * signalé dans le compte rendu du lot W9, pas corrigé ici.
 */
import { describe, expect, it } from "vitest";
import {
  computeLatencyReport,
  declaredOutputMs,
  measuredTotalMs,
  wirelessWarning,
  type LatencyParts,
} from "../../../../packages/audio/src/graph/latency.js";

/** Un cas courant en sortie filaire : les nombres du cahier §5.1. */
const filaire: LatencyParts = {
  frameIntervalMs: 33.3,
  inferenceMs: 12,
  processingMs: 2,
  audioBaseMs: 10.7,
  audioOutputMs: 0,
};

const CAMERA_MS = 50;

describe("AIR-F-31 — le total distingue le mesuré de l'estimé", () => {
  it("le total mesuré est la somme des composantes mesurées", () => {
    const rapport = computeLatencyReport(filaire, CAMERA_MS);
    expect(rapport.measuredTotalMs).toBeCloseTo(33.3 + 12 + 2 + 10.7 + 0, 9);
    expect(rapport.measuredTotalMs).toBeCloseTo(measuredTotalMs(filaire), 9);
  });

  it("le total estimé ajoute la caméra estimée au total mesuré", () => {
    const rapport = computeLatencyReport(filaire, CAMERA_MS);
    expect(rapport.cameraAssumedMs).toBe(CAMERA_MS);
    expect(rapport.estimatedTotalMs).toBeCloseTo(rapport.measuredTotalMs + CAMERA_MS, 9);
  });

  it("`partial` est vrai quand `outputLatency` manque", () => {
    const sansSortie: LatencyParts = { ...filaire, audioOutputMs: null };
    expect(computeLatencyReport(sansSortie, CAMERA_MS).partial).toBe(true);
  });

  it("`partial` est faux quand le navigateur déclare toute la sortie", () => {
    expect(computeLatencyReport(filaire, CAMERA_MS).partial).toBe(false);
  });

  it("`partial` est vrai quand le côté vision ne donne pas son temps d'analyse", () => {
    const sansAnalyse: LatencyParts = { ...filaire, inferenceMs: 8, inferenceUnknown: true };
    const rapport = computeLatencyReport(sansAnalyse, CAMERA_MS);
    expect(rapport.partial).toBe(true);
    expect(rapport.inferenceMs).toBe(0);
  });

  it("une sortie non déclarée compte pour zéro dans le total mesuré", () => {
    const sansSortie: LatencyParts = { ...filaire, audioOutputMs: null };
    const attendu = filaire.frameIntervalMs + filaire.inferenceMs + filaire.processingMs + filaire.audioBaseMs;
    expect(computeLatencyReport(sansSortie, CAMERA_MS).measuredTotalMs).toBeCloseTo(attendu, 9);
  });
});

describe("AIR-F-32 — la sortie sans fil est signalée", () => {
  it("rien à dire tant que la sortie déclarée reste sous le seuil", () => {
    expect(wirelessWarning(computeLatencyReport(filaire, CAMERA_MS), 100)).toBe(null);
  });

  it("une sortie filaire est conseillée au-delà du seuil", () => {
    const sansFil: LatencyParts = { ...filaire, audioBaseMs: 20, audioOutputMs: 180 };
    expect(wirelessWarning(computeLatencyReport(sansFil, CAMERA_MS), 100)).not.toBe(null);
  });

  it("sans `outputLatency`, rien n'est affirmé sur la sortie (mesure partielle)", () => {
    const sansSortie: LatencyParts = { ...filaire, audioOutputMs: null };
    const rapport = computeLatencyReport(sansSortie, CAMERA_MS);
    expect(declaredOutputMs(rapport)).toBe(null);
    expect(wirelessWarning(rapport, 100)).toBe(null);
  });
});

describe("AIR-N-05 — la part mesurable face à la cible des 60 ms", () => {
  it("les relevés du lot W9 sur `pc` restent sous la cible en sortie filaire", () => {
    // Relevé du 11 novembre 2026 (scripts/preuves/latence.mjs, Chromium headless) :
    // image suivante 50 ms (caméra simulée à 20 im/s), traitement 0 ms,
    // baseLatency 10,7 ms, outputLatency 0 ms, analyse non mesurée (modèle absent).
    const releve: LatencyParts = {
      frameIntervalMs: 50,
      inferenceMs: 0,
      inferenceUnknown: true,
      processingMs: 0,
      audioBaseMs: 10.666666666666666,
      audioOutputMs: 0,
    };
    const rapport = computeLatencyReport(releve, 50);
    expect(rapport.measuredTotalMs).toBeCloseTo(60.666666666666664, 9);
    expect(rapport.estimatedTotalMs).toBeCloseTo(110.66666666666666, 9);
    expect(rapport.partial).toBe(true);
  });

  it("à 30 im/s, la même chaîne passerait sous la cible des 60 ms", () => {
    const trente: LatencyParts = {
      frameIntervalMs: 1000 / 30,
      inferenceMs: 0,
      inferenceUnknown: true,
      processingMs: 0,
      audioBaseMs: 10.666666666666666,
      audioOutputMs: 0,
    };
    expect(computeLatencyReport(trente, 50).measuredTotalMs).toBeLessThan(60);
  });
});
