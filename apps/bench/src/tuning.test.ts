/**
 * Le réglage du filtre (lot N7, cahier §7.5) : les fonctions pures de
 * `tuning.ts`, exercées sur une prise synthétique `tremor` — la forme que la
 * prise réelle devra avoir. Sur prise synthétique, ces tests prouvent que
 * l'outil mesure et recommande de façon déterministe ; le RÉGLAGE lui-même
 * ne se lit que sur une prise réelle (`takes/real/tremor-…`), voir
 * `docs/prises-reelles.md`.
 */
import { describe, expect, it } from "vitest";
import type { Take } from "@thin-air/core";
import {
  CIBLE_TREMBLEMENT,
  evaluerReglage,
  explorerGrille,
  recommander,
  segmenter,
  trajectoirePaume,
  type Echantillon,
} from "./tuning.js";

const FPS = 30;

function paume(x: number, y: number): [number, number, number][] {
  // Les cinq points du centre de la paume (§7.4) plus le reste des 21 points.
  const points: [number, number, number][] = [];
  for (let i = 0; i < 21; i += 1) points.push([x, y, 0]);
  return points;
}

/** Une prise : immobile 2 s, puis montée lente 2 s (la forme du scénario tremor). */
function priseTremor(amplitude: number): Take {
  const frames = [];
  const images = FPS * 4;
  for (let i = 0; i < images; i += 1) {
    const t = i / FPS;
    const tremble = t < 2 ? Math.sin(i * 7) * amplitude : 0;
    const y = t < 2 ? 0.5 : 0.5 - (t - 2) * 0.15;
    frames.push({ t, hands: [{ side: "left" as const, score: 0.9, points: paume(0.5 + tremble, y + tremble) }] });
  }
  return { format: "thin-air-take/1", fps: FPS, frames };
}

describe("tuning — réglage du filtre sur une prise (lot N7)", () => {
  const take = priseTremor(0.004);
  const points = trajectoirePaume(take);
  const enMouvement = segmenter(points);

  it("la trajectoire suit la paume, échantillon par échantillon", () => {
    expect(points.length).toBe(FPS * 4);
    expect(points[0]).toEqual({ t: 0, x: 0.5, y: 0.5 });
  });

  it("la segmentation sépare l'immobile du mouvement lent", () => {
    const immobiles = enMouvement.filter((mouvement) => !mouvement).length;
    const mouvements = enMouvement.filter(Boolean).length;
    expect(immobiles).toBeGreaterThan(FPS * 1.5);
    expect(mouvements).toBeGreaterThan(FPS * 1.5);
  });

  it("plus fcMin est haut, plus le tremblement résiduel monte (compromis du §7.5)", () => {
    const bas = evaluerReglage(points, enMouvement, 1, 5);
    const haut = evaluerReglage(points, enMouvement, 3, 5);
    expect(bas.tremblement).toBeLessThan(haut.tremblement);
  });

  it("plus la coupure est basse, plus la traîne sur le geste est grande", () => {
    const bas = evaluerReglage(points, enMouvement, 1, 2);
    const haut = evaluerReglage(points, enMouvement, 3, 12);
    expect(bas.traine).toBeGreaterThan(haut.traine);
  });

  it("la grille est explorée entière, dans un ordre déterministe", () => {
    const resultats = explorerGrille(points, enMouvement);
    expect(resultats.length).toBe(16);
    expect(resultats.map((r) => `${r.fcMin}/${r.beta}`)).toEqual(
      explorerGrille(points, enMouvement).map((r) => `${r.fcMin}/${r.beta}`),
    );
  });

  it("la recommandation respecte la cible de tremblement (§5.3) si possible", () => {
    const choix = recommander(explorerGrille(points, enMouvement));
    expect(choix.tremblement).toBeLessThanOrEqual(CIBLE_TREMBLEMENT);
    expect(choix.fcMin).toBeGreaterThan(0);
    expect(choix.beta).toBeGreaterThan(0);
  });

  it("un tremblement lent plus fort que toutes les coupures : repli au plus lisse", () => {
    // Oscillation de 0,02 unité, période 8 s : le déplacement net sur 1 s
    // reste sous le seuil (classée immobile), mais l'écart à la moyenne
    // (~0,013) dépasse la cible quelle que soit la paire de la grille.
    const frames = [];
    for (let i = 0; i < FPS * 8; i += 1) {
      const t = i / FPS;
      const x = 0.5 + 0.02 * Math.sin((2 * Math.PI * t) / 8);
      frames.push({ t, hands: [{ side: "left" as const, score: 0.9, points: paume(x, 0.5) }] });
    }
    const lente: Take = { format: "thin-air-take/1", fps: FPS, frames };
    const p2 = trajectoirePaume(lente);
    const choix = recommander(explorerGrille(p2, segmenter(p2)));
    expect(choix.fcMin).toBe(1);
    expect(choix.tremblement).toBeGreaterThan(CIBLE_TREMBLEMENT);
  });

  it("aucun NaN quelle que soit la paire de la grille (AIR-P-02 sur l'outil)", () => {
    for (const r of explorerGrille(points, enMouvement)) {
      expect(Number.isFinite(r.tremblement)).toBe(true);
      expect(Number.isFinite(r.traine)).toBe(true);
    }
  });

  it("une échantillonneuse vide ne casse rien : trajectoire d'une prise sans main", () => {
    const vide: Take = { format: "thin-air-take/1", fps: FPS, frames: [{ t: 0, hands: [] }] };
    expect(trajectoirePaume(vide).length).toBe(0);
    const echantillons: readonly Echantillon[] = [];
    expect(evaluerReglage(echantillons, [], 1.5, 5)).toEqual({ fcMin: 1.5, beta: 5, tremblement: 0, traine: 0 });
  });
});
