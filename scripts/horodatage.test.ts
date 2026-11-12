/**
 * L'horloge unique (`scripts/horodatage.mjs`) et le contrôle qui la vérifie
 * (`scripts/check-timestamps.mjs`).
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/horodatage.test.ts`
 * — et le contrôle reste exécutable sans vitest :
 * `node scripts/check-timestamps.mjs`.
 */
import { describe, expect, it } from "vitest";

import {
  FORMAT_ISO_MS,
  dureeMs,
  estIsoUtcMs,
  horlogeMonotone,
  iso,
  millisecondes,
  maintenant,
} from "./horodatage.mjs";
import { analyserLigne } from "./check-timestamps.mjs";

/** Une horloge injectable : elle rend les instants qu'on lui demande. */
function horlogeFixe(valeurs: (number | Date)[]) {
  let index = 0;
  return () => valeurs[Math.min(index++, valeurs.length - 1)];
}

describe("l'horloge unique", () => {
  it("écrit un instant au format canonique", () => {
    const instant = iso(new Date("2026-12-01T14:05:33.412Z"));
    expect(instant).toBe("2026-12-01T14:05:33.412Z");
    expect(FORMAT_ISO_MS.test(instant)).toBe(true);
  });

  it("convertit en UTC, quel que soit le fuseau de la machine", () => {
    const instant = iso(new Date("2026-12-01T15:05:33.412+01:00"));
    expect(instant).toBe("2026-12-01T14:05:33.412Z");
    expect(FORMAT_ISO_MS.test(instant)).toBe(true);
  });

  it("refuse une date invalide", () => {
    expect(() => iso(new Date("pas une date"))).toThrow(RangeError);
  });

  it("lit l'horloge injectée", () => {
    expect(maintenant(horlogeFixe([1_796_133_933_412]))).toBe("2026-12-01T14:05:33.412Z");
  });

  it("ne recule jamais quand l'horloge avance", () => {
    const horloge = horlogeFixe([1_000, 2_000, 3_000]);
    const instants = [maintenant(horloge), maintenant(horloge), maintenant(horloge)];
    expect(instants).toEqual([
      "1970-01-01T00:00:01.000Z",
      "1970-01-01T00:00:02.000Z",
      "1970-01-01T00:00:03.000Z",
    ]);
    for (let index = 1; index < instants.length; index += 1) {
      expect(instants[index] > instants[index - 1]).toBe(true);
    }
  });

  it("sert une horloge strictement croissante", () => {
    const horloge = horlogeMonotone(horlogeFixe([5_000, 5_000, 5_000]));
    const instants = [horloge(), horloge(), horloge()];
    expect(instants).toEqual([5_000, 5_001, 5_002]);
  });

  it("mesure une durée en millisecondes entières", () => {
    expect(dureeMs("2026-12-01T14:05:33.412Z", "2026-12-01T14:05:36.412Z")).toBe(3_000);
    expect(Number.isInteger(dureeMs("2026-12-01T14:05:33.412Z", "2026-12-01T14:05:36.412Z"))).toBe(true);
  });

  it("ne lit un instant que s'il est canonique", () => {
    expect(estIsoUtcMs("2026-12-01T14:05:33.412Z")).toBe(true);
    expect(estIsoUtcMs("2026-12-01T14:05:33Z")).toBe(false);
    expect(estIsoUtcMs("2026-12-01 14:05:33")).toBe(false);
    expect(() => millisecondes("2026-12-01T14:05:33Z")).toThrow(TypeError);
  });
});

describe("le contrôle des horodatages", () => {
  it("accepte un instant canonique", () => {
    expect(analyserLigne("relevé : 2026-12-01T14:05:33.412Z", "doc.md", 1)).toEqual([]);
  });

  it("refuse une heure d'horloge murale", () => {
    const fautes = analyserLigne("mergée à 22:25 UTC le 2026-11-11", "doc.md", 1);
    expect(fautes.length).toBeGreaterThan(0);
  });

  it("refuse une durée hors millisecondes", () => {
    const fautes = analyserLigne("le chantier a duré 7 h 40", "doc.md", 1);
    expect(fautes.some((faute) => faute.message.includes("durée hors millisecondes"))).toBe(true);
  });

  it("refuse une durée relative", () => {
    const fautes = analyserLigne("le contrôle a tourne il y a 3 minutes", "doc.md", 1);
    expect(fautes.some((faute) => faute.message.includes("durée relative"))).toBe(true);
  });

  it("refuse une date locale dans un nom de fichier", () => {
    const fautes = analyserLigne("résultat dans out/sonde/2026-11-12.json", "doc.md", 1);
    expect(fautes.some((faute) => faute.message.includes("nom de fichier"))).toBe(true);
  });

  it("laisse passer un timecode de média", () => {
    expect(analyserLigne("plan de 0:00 à 0:12", "doc.md", 1)).toEqual([]);
  });
});
