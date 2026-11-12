/**
 * Verrous du réglage du filtre (lot W7) : reproductibilité au bit près
 * (AIR-N-09), sensibilité de chaque paramètre, canal vif sous une image, et
 * commande `bench tune` vue de l'extérieur. Aucun son, aucune horloge : tout
 * se lit dans des prises figées et des nombres (AIR-N-02).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Take } from "@thin-air/core";
import { parseTake } from "@thin-air/schema";

import type { Writers } from "./commands.js";
import {
  CAHIER_COMBO,
  CHEMINS_TAKES,
  COMBO_RECOMMANDEE,
  balayer,
  ecartType,
  gigueResiduelle,
  indicesMesure,
  retardMs,
  rowPour,
  runTune,
  signalU,
  type TuningSources,
} from "./tuning-mesure.js";

function charger(chemin: string): Take {
  const json = JSON.parse(readFileSync(chemin, "utf8")) as unknown;
  const resultat = parseTake(json);
  if (!resultat.ok) throw new Error(`${chemin} refusé : ${(resultat.reasons ?? []).join(" ; ")}`);
  return resultat.value;
}

const sources: TuningSources = {
  gigue: charger(CHEMINS_TAKES.gigue),
  traine: charger(CHEMINS_TAKES.traine),
  vif: charger(CHEMINS_TAKES.vif),
};

const lignes = balayer(sources);

interface Captured {
  readonly code: number;
  readonly out: string;
  readonly err: string;
}

function lancer(...argv: string[]): Promise<Captured> {
  const sortie: string[] = [];
  const erreur: string[] = [];
  const writers: Writers = {
    out: (text) => sortie.push(text),
    err: (text) => erreur.push(text),
  };
  return runTune(argv, writers).then((code) => ({ code, out: sortie.join("\n"), err: erreur.join("\n") }));
}

describe("tuning — gigue, traîne, canal vif (lot W7)", () => {
  it("est reproductible : mêmes entrées, mêmes nombres (AIR-N-09)", () => {
    expect(balayer(sources)).toEqual(lignes);
  });

  it("la combinaison recommandée n'est pas pire que les défauts, à 5 % près", () => {
    const recommandee = rowPour(lignes, COMBO_RECOMMANDEE);
    const defauts = rowPour(lignes, CAHIER_COMBO);
    expect(recommandee.gigue).toBeLessThanOrEqual(defauts.gigue * 1.05);
    expect(recommandee.traine).toBeLessThanOrEqual(defauts.traine * 1.05);
    expect(recommandee.vif).toBeLessThanOrEqual(defauts.vif * 1.05);
  });

  it("baisse fcMin : moins de gigue, plus de traîne (sans toucher au canal vif)", () => {
    const bas = rowPour(lignes, { fcMin: 0.8, beta: 5, fcTrigger: 6 });
    const milieu = rowPour(lignes, { fcMin: 1.5, beta: 5, fcTrigger: 6 });
    const haut = rowPour(lignes, { fcMin: 2.5, beta: 5, fcTrigger: 6 });
    expect(bas.gigue).toBeLessThan(milieu.gigue);
    expect(milieu.gigue).toBeLessThan(haut.gigue);
    expect(bas.traine).toBeGreaterThan(milieu.traine);
    expect(milieu.traine).toBeGreaterThan(haut.traine);
  });

  it("beta réduit la traîne au prix d'un peu de gigue (à fcMin fixé)", () => {
    const b2 = rowPour(lignes, { fcMin: 1.5, beta: 2, fcTrigger: 6 });
    const b5 = rowPour(lignes, { fcMin: 1.5, beta: 5, fcTrigger: 6 });
    const b10 = rowPour(lignes, { fcMin: 1.5, beta: 10, fcTrigger: 6 });
    expect(b2.traine).toBeGreaterThan(b5.traine);
    expect(b5.traine).toBeGreaterThan(b10.traine);
    expect(b2.gigue).toBeLessThan(b10.gigue);
  });

  it("le canal vif reste sous une image à 30 images/s : une attaque n'attend pas le lissage", () => {
    const cahier = rowPour(lignes, CAHIER_COMBO);
    expect(cahier.vif).toBeLessThan(1000 / 30);
    const v4 = rowPour(lignes, { fcMin: 1.5, beta: 5, fcTrigger: 4 });
    const v6 = rowPour(lignes, { fcMin: 1.5, beta: 5, fcTrigger: 6 });
    const v10 = rowPour(lignes, { fcMin: 1.5, beta: 5, fcTrigger: 10 });
    expect(v4.vif).toBeGreaterThan(v6.vif);
    expect(v6.vif).toBeGreaterThan(v10.vif);
  });

  it("le filtre atténue le tremblement : la gigue lissée est sous la gigue brute", () => {
    const signal = signalU(sources.gigue, CAHIER_COMBO);
    const indices = indicesMesure(signal);
    const brute = ecartType(indices.map((i) => signal.brut[i] ?? 0));
    expect(gigueResiduelle(signal)).toBeLessThan(brute);
  });

  it("retardMs retrouve un décalage pur de 50 ms", () => {
    const t = Array.from({ length: 31 }, (_, i) => i / 30);
    const decale = t.map((x) => Math.max(0, x - 0.05));
    const mesure = retardMs(t, t, decale, { maxMs: 100 });
    expect(mesure).toBeGreaterThanOrEqual(49.5);
    expect(mesure).toBeLessThanOrEqual(50.5);
  });
});

describe("bench tune — la commande", () => {
  it("imprime le tableau, le bilan et rend 0 sans --take", async () => {
    const { code, out } = await lancer();
    expect(code).toBe(0);
    expect(out).toContain("fcMin");
    expect(out).toContain("vif (ms)");
    expect(out).toContain("meilleure gigue");
    expect(out).toContain("cahier §7.5");
  });

  it("mesure une prise unique avec --take", async () => {
    const { code, out } = await lancer("--take", CHEMINS_TAKES.gigue);
    expect(code).toBe(0);
    expect(out).toContain("tremor-at-boundary");
  });

  it("sort les 27 combinaisons en JSON", async () => {
    const { code, out } = await lancer("--json", "--take", CHEMINS_TAKES.vif);
    expect(code).toBe(0);
    const donnees = JSON.parse(out) as { lignes: unknown[] };
    expect(donnees.lignes).toHaveLength(27);
  });

  it("affiche l'aide et rend 0", async () => {
    const { code, out } = await lancer("--help");
    expect(code).toBe(0);
    expect(out).toContain("bench tune");
  });
});