import { describe, expect, it } from "vitest";
import { defaultPlayRect } from "@thin-air/core";
import {
  beginCalibration,
  cancelCalibration,
  COUNTDOWN_S,
  finishCalibration,
  idleCalibration,
  isCalibrating,
  keepDefault,
  restartCalibration,
  sampleCalibration,
  startCountdown,
  storedRect,
  tickCalibration,
} from "./calibration.js";

/** Un relevé de portée : les deux bras écartés, du 5ᵉ au 95ᵉ centile. */
function releve(): readonly { u: number; v: number }[] {
  const points: { u: number; v: number }[] = [];
  for (let index = 0; index < 40; index += 1) {
    points.push({ u: 0.15 + (index % 10) * 0.07, v: 0.3 + Math.floor(index / 10) * 0.1 });
  }
  return points;
}

function lance() {
  return startCountdown(beginCalibration(idleCalibration()));
}

describe("calibration (cahier §7.4, AIR-F-09, écran §12.1)", () => {
  it("le parcours suit la consigne, le décompte, puis le relevé", () => {
    const consigne = beginCalibration(idleCalibration());
    expect(consigne.phase).toBe("instructions");
    expect(isCalibrating(consigne)).toBe(false);
    const decompte = startCountdown(consigne);
    expect(decompte.phase).toBe("countdown");
    expect(decompte.remainingS).toBe(COUNTDOWN_S);
    expect(isCalibrating(decompte)).toBe(true);
    let etat = decompte;
    for (let index = 0; index < COUNTDOWN_S; index += 1) etat = tickCalibration(etat);
    expect(etat.phase).toBe("recording");
  });

  it("le décompte ne descend pas sous zéro avant le relevé", () => {
    let etat = lance();
    for (let index = 0; index < 10; index += 1) etat = tickCalibration(etat);
    expect(["recording", "result", "failed"]).toContain(etat.phase);
    expect(etat.remainingS).toBeGreaterThanOrEqual(0);
  });

  it("AIR-F-09 — un relevé assez large donne un rectangle qui contient les mains", () => {
    let etat = lance();
    for (let index = 0; index < COUNTDOWN_S; index += 1) etat = tickCalibration(etat);
    for (const point of releve()) etat = sampleCalibration(etat, point);
    const fini = finishCalibration(etat, 1000);
    expect(fini.phase).toBe("result");
    expect(fini.rect).not.toBeNull();
    expect(fini.rect?.calibratedAt).toBe(1000);
    expect(fini.rect!.u0).toBeLessThanOrEqual(0.15);
    expect(fini.rect!.u1).toBeGreaterThanOrEqual(0.78);
  });

  it("AIR-F-09 — un relevé trop petit est refusé, l'écran propose de recommencer", () => {
    let etat = lance();
    for (let index = 0; index < COUNTDOWN_S; index += 1) etat = tickCalibration(etat);
    etat = sampleCalibration(etat, { u: 0.5, v: 0.5 });
    const fini = finishCalibration(etat, 1);
    expect(fini.phase).toBe("failed");
    expect(fini.rect).toBeNull();
    expect(keepDefault(fini).rect).toEqual(defaultPlayRect());
    expect(restartCalibration(fini).phase).toBe("instructions");
  });

  it("les points relevés hors du relevé sont ignorés", () => {
    const etat = sampleCalibration(idleCalibration(), { u: 0.2, v: 0.3 });
    expect(etat.samples).toEqual([]);
  });

  it("AIR-F-09 — annuler rend la zone déjà enregistrée, pas une zone vide", () => {
    let etat = lance();
    for (let index = 0; index < COUNTDOWN_S; index += 1) etat = tickCalibration(etat);
    for (const point of releve()) etat = sampleCalibration(etat, point);
    const fini = finishCalibration(etat, 7);
    const annule = cancelCalibration(fini);
    expect(annule.phase).toBe("idle");
    expect(storedRect(annule)).toEqual(fini.rect);
  });

  it("sans calibration, la zone reste les 80 % centraux (AIR-F-08)", () => {
    expect(storedRect(idleCalibration())).toEqual(defaultPlayRect());
  });
});
