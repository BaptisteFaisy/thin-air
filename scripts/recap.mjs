#!/usr/bin/env node
/**
 * Le récapitulatif quotidien — la journée en un écran, cinq rubriques.
 *
 * Le script écrit `docs/recap-<AAAA-MM-JJ>.md` à partir de quatre sources :
 * les PR mergées et les exécutions de la CI (par la CLI `gh`, si elle est là
 * et si le réseau répond), le journal de bord (`docs/journal.md`) et le
 * rapport d'audit (`docs/audit-rapport.md`).
 *
 * Le réseau n'est jamais obligatoire : sans `gh`, sans réseau ou sans
 * authentification, la source est notée « indisponible » dans le
 * récapitulatif. `--hors-ligne` coupe la recherche volontairement.
 *
 * Le modèle à remplir à la main quand l'API manque est dans
 * `docs/recap-modele.md`.
 *
 * Usage :
 *   node scripts/recap.mjs [--date AAAA-MM-JJ] [--racine <chemin>]
 *                           [--depot owner/name] [--hors-ligne]
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { dateDuJour } from "./lib/recap-dates.mjs";
import { executions, prsMergées, prsOuvertes } from "./lib/recap-github.mjs";
import { classerPoints, lireAudit, lireJournal } from "./lib/recap-journal.mjs";
import { rendreRecap } from "./lib/recap-rendu.mjs";

/** Les options de la ligne de commande, lues sans dépendance. */
export function lireOptions(argv) {
  const options = { date: "", racine: "", depot: "", horsLigne: false };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    if (argument === "--hors-ligne") options.horsLigne = true;
    else if (argument === "--date") options.date = argv[i + 1] ?? "";
    else if (argument === "--racine") options.racine = argv[i + 1] ?? "";
    else if (argument === "--depot") options.depot = argv[i + 1] ?? "";
  }
  return options;
}

/** Le dépôt lu dans la remoto git : `owner/name`, ou vide si on ne sait pas. */
export function depotParDefaut(racine) {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: racine,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const trouve = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
    return trouve ? trouve[1] : "";
  } catch {
    return "";
  }
}

/** Les sources du récapitulatif, une par une, sans exception non rattrapée. */
async function chercherLesSources({ racine, depot, date, horsLigne }) {
  const indisponible = { ok: false, raison: "mode hors ligne demandé" };
  const [mergees, ouvertes, courses] = horsLigne
    ? [indisponible, indisponible, indisponible]
    : await Promise.all([
        prsMergées(racine, depot, date),
        prsOuvertes(racine, depot),
        executions(racine, depot, date),
      ]);
  const journal = lireJournal(racine, date);
  const audit = lireAudit(racine);
  const rubriques = journal.ok
    ? classerPoints(journal.points)
    : { avance: [], bloque: [], couteux: [], demain: [], risques: [] };
  return { date, depot, prsMergees: mergees, prsOuvertes: ouvertes, executions: courses, journal, audit, rubriques };
}

/** Le chemin du récapitulatif du jour. */
function cheminRecap(racine, date) {
  return join(racine, "docs", `recap-${date}.md`);
}

/** Point d'entrée : rassemble, écrit, dit où c'est écrit. */
async function main(argv) {
  const options = lireOptions(argv);
  const racine = resolve(options.racine || process.cwd());
  const date = options.date || dateDuJour();
  const depot = options.depot || depotParDefaut(racine);
  const donnees = await chercherLesSources({ racine, depot, date, horsLigne: options.horsLigne });
  const chemin = cheminRecap(racine, date);
  await mkdir(dirname(chemin), { recursive: true });
  await writeFile(chemin, rendreRecap(donnees), "utf8");
  process.stdout.write(`récapitulatif écrit : ${chemin}\n`);
  return 0;
}

process.exit(await main(process.argv.slice(2)));
