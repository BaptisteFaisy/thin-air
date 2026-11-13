/**
 * Les rapports de rendu figés de la recette §18.
 *
 * Chaque prise de référence a son rapport de rendu gelé dans
 * `takes/reference/<nom>.expected.json`, produit par le banc lui-même
 * (`bench render … --no-wav`). Ce test rejoue le rendu et le compare au
 * fichier gelé avec `compareReports` : si le moteur, la mesure ou la chaîne
 * d'événements bouge, l'écart est nommé champ par champ.
 *
 * Les tolérances sont celles de la section 13 du cahier, portées par
 * `DEFAULT_TOLERANCES` (5 centièmes de demi-ton, une image près soit 33 ms,
 * ±0,5 dB sur la crête et le niveau moyen, ±100 ms sur le silence final).
 *
 * Aucun son, aucun périphérique audio (AIR-N-02) : le rendu est hors ligne,
 * dans un tableau d'échantillons, et rien n'est écrit hors mémoire.
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Settings } from "@thin-air/core";

import { DEFAULT_TOLERANCES, compareReports, formatComparison } from "./compare.js";
import { readJsonFile } from "./io.js";
import { readInstrumentFile, readTakeFile } from "./load.js";
import { renderTake } from "./render.js";
import { parseReport } from "./report.js";
import { REFERENCE_TAKES } from "./takes.js";
import type { ReferenceTakeSpec } from "./takes.js";

/**
 * Les prises que la recette §18 compare avec l'aimant à 1 : le thérémine
 * aimanté donne les huit notes exactes du cahier §7.14. La même liste vit
 * dans `scripts/check-golden.mjs` (Node pur, qui ne peut pas importer ce
 * fichier) — les deux doivent bouger ensemble.
 */
export const AIMANT_UN: ReadonlySet<string> = new Set(["slow-rise", "tremor-at-boundary"]);

/** Réglages d'une prise de référence : l'aimant à 1, ou les défauts. */
function settingsOf(spec: ReferenceTakeSpec): Partial<Settings> | undefined {
  return AIMANT_UN.has(spec.name) ? { magnet: 1 } : undefined;
}

/** Le rapport gelé d'une prise, validé par le banc avant tout usage. */
function rapportGele(spec: ReferenceTakeSpec) {
  const chemin = `takes/reference/${spec.name}.expected.json`;
  return parseReport(readJsonFile(chemin), chemin);
}

/** Rejoue le rendu exact du gel : même prise, même instrument, mêmes réglages. */
async function rendre(spec: ReferenceTakeSpec) {
  const take = await readTakeFile(`takes/reference/${spec.name}.json`);
  const instrument = await readInstrumentFile(spec.instrument);
  return renderTake(take, instrument, { settings: settingsOf(spec), takeName: spec.name });
}

describe("rapports de rendu figés (recette §18)", () => {
  it("chaque prise de référence a son rapport gelé", () => {
    for (const spec of REFERENCE_TAKES) {
      const chemin = `takes/reference/${spec.name}.expected.json`;
      expect(existsSync(chemin), `${chemin} est absent — le regeler avec bench render`).toBe(true);
    }
  });

  it("les tolérances du banc sont bien celles de la section 13", () => {
    expect(DEFAULT_TOLERANCES).toEqual({
      cents: 5,
      peakDb: 0.5,
      rmsDb: 0.5,
      noteTimeMs: 33,
      silenceAfterMs: 100,
    });
  });

  for (const spec of REFERENCE_TAKES) {
    it(`${spec.name} — le rendu rejoué est conforme au rapport gelé`, async () => {
      const attendu = rapportGele(spec);
      const actuel = await rendre(spec);
      const ecarts = compareReports(actuel, attendu, DEFAULT_TOLERANCES);
      expect(ecarts.map((ecart) => ecart.field), formatComparison(ecarts)).toEqual([]);
    });
  }
});
