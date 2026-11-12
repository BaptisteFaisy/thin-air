/**
 * L'histogramme du temps d'analyse (cahier §5.4, AIR-F-31) : logique pure,
 * testée dans Node sans DOM ni modèle. On y prouve la fenêtre glissante, la
 * moyenne, le maximum, les classes à bornes fixes, la remise à zéro et le
 * déterminisme (une fenêtre vide rend des zéros, jamais `NaN`).
 */
import { describe, expect, it } from "vitest";
import {
  binIndexFor,
  binLabels,
  createAnalysisHistory,
  HISTOGRAM_BINS_MS,
  HISTORY_WINDOW,
  type AnalysisSample,
} from "./analysis-history.js";

function echantillon(inferenceMs: number, frameIntervalMs = 16): AnalysisSample {
  return { inferenceMs, frameIntervalMs };
}

describe("analysis-history — classes à bornes fixes", () => {
  it("binIndexFor range un temps dans la bonne classe", () => {
    expect(binIndexFor(1)).toBe(0); // <2
    expect(binIndexFor(2)).toBe(1); // 2–5
    expect(binIndexFor(4.9)).toBe(1);
    expect(binIndexFor(5)).toBe(2); // 5–10
    expect(binIndexFor(80)).toBe(HISTOGRAM_BINS_MS.length); // ≥80
    expect(binIndexFor(1000)).toBe(HISTOGRAM_BINS_MS.length);
  });

  it("binIndexFor écarte les valeurs invalides dans la dernière classe", () => {
    expect(binIndexFor(Number.NaN)).toBe(HISTOGRAM_BINS_MS.length);
    expect(binIndexFor(-3)).toBe(HISTOGRAM_BINS_MS.length);
  });

  it("binLabels produit des libellés déterministes, bornes incluses", () => {
    expect(binLabels()).toEqual(["<2", "2–5", "5–10", "10–20", "20–40", "40–80", "≥80"]);
  });
});

describe("analysis-history — fenêtre glissante (les 60 dernières images)", () => {
  it("une fenêtre vide rend des zéros, jamais NaN", () => {
    const historique = createAnalysisHistory();
    const vide = historique.snapshot();
    expect(vide.count).toBe(0);
    expect(vide.meanInferenceMs).toBe(0);
    expect(vide.maxInferenceMs).toBe(0);
    expect(vide.meanFrameIntervalMs).toBe(0);
    expect(Number.isNaN(vide.meanInferenceMs)).toBe(false);
    expect(vide.bins.reduce((somme, n) => somme + n, 0)).toBe(0);
  });

  it("moyenne et maximum portent sur les images poussées", () => {
    const historique = createAnalysisHistory();
    historique.push(echantillon(10));
    historique.push(echantillon(20));
    historique.push(echantillon(30));
    const etat = historique.snapshot();
    expect(etat.count).toBe(3);
    expect(etat.meanInferenceMs).toBe(20);
    expect(etat.maxInferenceMs).toBe(30);
  });

  it("au-delà de la fenêtre, la plus ancienne image sort (AIR-F-31 : 60 dernières)", () => {
    const historique = createAnalysisHistory();
    for (let i = 0; i < HISTORY_WINDOW + 5; i += 1) historique.push(echantillon(i));
    const etat = historique.snapshot();
    expect(etat.count).toBe(HISTORY_WINDOW);
    expect(historique.size).toBe(HISTORY_WINDOW);
    // Les 5 premières (0..4) sont sorties ; le maximum restant est HISTORY_WINDOW+4.
    expect(etat.maxInferenceMs).toBe(HISTORY_WINDOW + 4);
  });

  it("les effectifs par classe somment au nombre d'images", () => {
    const historique = createAnalysisHistory();
    historique.push(echantillon(1)); // <2
    historique.push(echantillon(3)); // 2–5
    historique.push(echantillon(7)); // 5–10
    historique.push(echantillon(90)); // ≥80
    const etat = historique.snapshot();
    expect(etat.bins.reduce((somme, n) => somme + n, 0)).toBe(4);
    expect(etat.bins[0]).toBe(1);
    expect(etat.bins[1]).toBe(1);
    expect(etat.bins[2]).toBe(1);
    expect(etat.bins[HISTOGRAM_BINS_MS.length]).toBe(1);
  });

  it("l'intervalle d'images est moyenné séparément du temps d'analyse", () => {
    const historique = createAnalysisHistory();
    historique.push({ inferenceMs: 8, frameIntervalMs: 16 });
    historique.push({ inferenceMs: 12, frameIntervalMs: 32 });
    const etat = historique.snapshot();
    expect(etat.meanInferenceMs).toBe(10);
    expect(etat.meanFrameIntervalMs).toBe(24);
  });

  it("reset remet la fenêtre à zéro (nouvelle session)", () => {
    const historique = createAnalysisHistory();
    historique.push(echantillon(50));
    historique.reset();
    expect(historique.size).toBe(0);
    expect(historique.snapshot().maxInferenceMs).toBe(0);
  });

  it("une valeur non finie ou négative est bornée à zéro, sans corrompre la moyenne", () => {
    const historique = createAnalysisHistory();
    historique.push(echantillon(Number.NaN));
    historique.push(echantillon(-5));
    historique.push(echantillon(10));
    const etat = historique.snapshot();
    expect(etat.count).toBe(3);
    expect(etat.maxInferenceMs).toBe(10);
    expect(Number.isFinite(etat.meanInferenceMs)).toBe(true);
  });
});
