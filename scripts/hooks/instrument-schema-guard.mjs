#!/usr/bin/env node
/**
 * Garde du schéma des instruments (AIR-F-21, 22, 23, 43 ; cahier §7.8, §11.4).
 *
 * Valide chaque fichier de `instruments/` contre la structure du type
 * `Instrument` (`packages/core/src/types.ts`), vérifie que les six
 * instruments du cahier sont bien là, et refuse en entier tout fichier qui
 * ne tient pas — avec ses raisons, jamais de valeur par défaut silencieuse.
 *
 * Usage : `node scripts/hooks/instrument-schema-guard.mjs` → 0 si tout est
 * valide.
 */
import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { accepter, extensionDe, fichiersSous, journaliser, lireChargeUtile, racine, refuser } from "./lib/io.mjs";
import { INSTRUMENTS_ATTENDUS, validerInstrument } from "./lib/instrument-schema.mjs";

const NOM = "instrument-schema-guard";

const chargeUtile = await lireChargeUtile();
const base = racine(chargeUtile);
const refus = [];
const vus = [];

for await (const chemin of fichiersSous(`${base}/instruments`)) {
  if (extensionDe(chemin) !== ".json") continue;
  const etiquette = relative(base, chemin);
  vus.push(etiquette);
  let forme;
  try {
    forme = JSON.parse(await readFile(chemin, "utf8"));
  } catch (erreur) {
    refus.push(`${etiquette} — JSON illisible (${String(erreur)})`);
    continue;
  }
  const resultat = validerInstrument(forme);
  if (!resultat.ok) {
    for (const raison of resultat.erreurs) refus.push(`${etiquette} — ${raison}`);
  }
}

const manquants = INSTRUMENTS_ATTENDUS.filter((nom) => !vus.some((fichier) => fichier.includes(`${nom}.json`)));
for (const manquant of manquants) refus.push(`instruments/${manquant}.json absent — un des six instruments du §7.8`);

if (refus.length > 0) {
  await journaliser(base, { garde: NOM, evenement: "refus", fichiers: vus.length, refus });
  for (const raison of refus) process.stderr.write(`${raison}\n`);
  refuser(`${NOM} : ${refus.length} refus sur ${vus.length} fichier(s)`);
}
await journaliser(base, { garde: NOM, evenement: "acceptation", fichiers: vus.length });
accepter(`${vus.length} instrument(s) conforme(s) au type Instrument : ${vus.map((f) => f.split("/").pop()).join(", ")}`);
