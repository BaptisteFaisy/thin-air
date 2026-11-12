/**
 * La boucle compense-t-elle vraiment le retard ? (cahier §5.2, §7.10, AIR-F-35)
 *
 * Ce que `packages/core/src/loop.test.ts` prouve déjà : l'arithmétique de
 * `compensate` — chaque événement avancé du retard, replié dans la boucle.
 * Ce que ce test prouve de plus : le SON RENDU. Une prise jouée avec 105 ms de
 * retard est enregistrée dans une couche, rendue hors ligne telle quelle, puis
 * rendue une seconde fois après `compensate` ; les attaques sont mesurées sur
 * les échantillons par `attackTimes`. Sans compensation, elles tombent en
 * retard du retard injecté ; avec compensation, elles retombent sur la grille.
 *
 * Aucun son n'est émis (AIR-N-02) : le rendu est un calcul dans des
 * `Float32Array`, fait par le même moteur que les autres tests (§11.6).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { SAMPLE_RATE } from "@thin-air/core";
import {
  BOUCLE_S,
  ECHANTILLONS_BOUCLE,
  MESURES,
  NB_NOTES,
  PAS_S,
  RETARD_S,
  TEMPO,
  TEMPS_PAR_MESURE,
  instrumentDeLaSimulation,
  simuler,
  type Simulation,
} from "./compensation-sim.js";

/** Tolérance sur la position d'une attaque : ±10 ms (recette §18). */
const TOLERANCE_S = 0.01;
/** Le chiffre du cahier §7.10 : 105 ms valent 63 % d'une double croche à 90. */
const PART_DOUBLE_CROCHE = 0.63;
/** Tolérance sur ce pourcentage : le cahier l'écrit à deux chiffres. */
const TOLERANCE_PART = 0.01;

let sim: Simulation;

beforeAll(async () => {
  sim = simuler(await instrumentDeLaSimulation());
}, 60_000);

describe("le cadre de la boucle (§7.10, recette §18)", () => {
  it("quatre mesures à 90 font 10,667 s, soit exactement 512 000 échantillons", () => {
    expect(BOUCLE_S).toBeCloseTo(10.6667, 4);
    expect(ECHANTILLONS_BOUCLE).toBe(512_000);
    expect(PAS_S).toBeCloseTo(0.1667, 4);
    expect(RETARD_S / PAS_S).toBeCloseTo(PART_DOUBLE_CROCHE, 2);
  });

  it("les trois rendus font exactement 512 000 échantillons", () => {
    for (const prise of [sim.reference, sim.sansCompensation, sim.avecCompensation]) {
      expect(prise.echantillons).toBe(512_000);
      expect(prise.echantillons).toBe(Math.round(BOUCLE_S * SAMPLE_RATE));
    }
    expect(BOUCLE_S).toBeCloseTo(loopRef(), 9);
  });

  it("chaque note des trois prises a une attaque datée", () => {
    for (const prise of [sim.reference, sim.sansCompensation, sim.avecCompensation]) {
      expect(prise.parNote).toHaveLength(NB_NOTES);
      expect(prise.parNote.every((t) => Number.isFinite(t))).toBe(true);
      // Le détecteur voit aussi les ré-envolées de l'enveloppe du pincé : il y
      // a plus d'attaques brutes que de notes. L'association à la fenêtre de
      // 50 ms ne garde que celle de la note.
      expect(prise.attaques.length).toBeGreaterThanOrEqual(NB_NOTES);
    }
    expect(sim.visees).toHaveLength(NB_NOTES);
    expect(TEMPO).toBe(90);
    expect(MESURES).toBe(4);
    expect(TEMPS_PAR_MESURE).toBe(4);
  });
});

describe("SANS compensation, chaque attaque tombe en retard du retard injecté (§7.10)", () => {
  it("note par note : ~105 ms de retard, à ±10 ms", () => {
    sim.sansCompensation.parNote.forEach((attaque, i) => {
      const visee = sim.visees[i] ?? Number.NaN;
      expect(attaque - visee).toBeCloseTo(RETARD_S, 2);
      expect(Math.abs(attaque - visee - RETARD_S)).toBeLessThanOrEqual(TOLERANCE_S);
    });
  });

  it("contre la prise de référence : +105 ms en moyenne, 63 % d'une double croche", () => {
    expect(sim.ecartSansS).toBeCloseTo(RETARD_S, 3);
    expect(sim.ecartSansS / PAS_S).toBeCloseTo(PART_DOUBLE_CROCHE, 2);
    expect(Math.abs(sim.ecartSansS / PAS_S - PART_DOUBLE_CROCHE)).toBeLessThanOrEqual(
      TOLERANCE_PART,
    );
  });

  it("la boucle boite : les attaques ne sont PAS sur la grille", () => {
    sim.sansCompensation.parNote.forEach((attaque, i) => {
      expect(Math.abs(attaque - (sim.visees[i] ?? 0))).toBeGreaterThan(TOLERANCE_S);
    });
  });
});

describe("AVEC compensation, les attaques retombent sur la grille (§5.2, §7.10)", () => {
  it("contre la prise de référence : aucun écart (au pire 1 ms)", () => {
    expect(sim.ecartAvecS).toBeCloseTo(0, 3);
    expect(sim.ecartAvecMaxS).toBeLessThanOrEqual(0.001);
  });

  it("contre la grille visée : à ±10 ms près, note par note", () => {
    sim.avecCompensation.parNote.forEach((attaque, i) => {
      expect(Math.abs(attaque - (sim.visees[i] ?? Number.NaN))).toBeLessThanOrEqual(TOLERANCE_S);
    });
    expect(sim.ecartAvecGrilleMaxS).toBeLessThanOrEqual(TOLERANCE_S);
  });

  it("ce qui reste est le décalage du détecteur, pas celui de la boucle", () => {
    // `attackTimes` lisse l'enveloppe (τ = 10 ms) : l'attaque qu'il date est
    // un peu après l'attaque jouée. La prise de référence le mesure : même
    // instrument, mêmes notes, aucun retard. Il vaut ici moins de 10 ms, et il
    // est le même dans les trois prises — d'où l'écart nul contre la référence.
    expect(sim.biaisMesureS).toBeGreaterThan(0);
    expect(sim.biaisMaxS).toBeLessThanOrEqual(TOLERANCE_S);
    expect(sim.ecartAvecGrilleMaxS - sim.biaisMaxS).toBeLessThanOrEqual(TOLERANCE_S);
  });
});

describe("la compensation retire exactement le retard injecté", () => {
  it("attaque par attaque : sans − avec = 105 ms", () => {
    sim.avecCompensation.parNote.forEach((avec, i) => {
      const sans = sim.sansCompensation.parNote[i] ?? Number.NaN;
      expect(sans - avec).toBeCloseTo(RETARD_S, 3);
    });
  });

  it("le rendu est reproductible au bit près (AIR-N-09)", () => {
    expect(sim.reproductible).toBe(true);
  });
});

/** Longueur de la boucle recalculée depuis le tempo, sans passer par le module. */
function loopRef(): number {
  return (MESURES * TEMPS_PAR_MESURE * 60) / TEMPO;
}
