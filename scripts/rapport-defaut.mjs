#!/usr/bin/env -S npx tsx
/**
 * Le rapport de défaut en un clic (cahier §7.11, §16).
 *
 *   npx tsx scripts/rapport-defaut.mjs --prise <prise.json> --instrument <instrument.json> --out <dossier>
 *
 * Produit UN fichier JSON auto-suffisant, `<dossier>/rapport-defaut.json` :
 * la prise (les points, rien d'autre), l'instrument, les réglages, le rapport
 * de rendu, les mesures de retard, la version du dépôt, la date UTC, la
 * commande de rejeu et un résumé en clair. Aucun son, aucun réseau (AIR-N-01,
 * AIR-N-02) : le rendu est calculé par le banc, comme `bench render`.
 *
 * Le script importe le banc (`apps/bench`) en TypeScript source : le lancer
 * avec `npx tsx`, jamais avec `node` nu (comme `scripts/prises-reelles.mjs`).
 */
import { execFileSync } from "node:child_process";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..");

const { renderDefectReport, reglagesDe } = await import("../apps/bench/src/rapport-defaut.js");
const { readInstrumentFile, readSettingsFile, readTakeFile } = await import("../apps/bench/src/load.js");
const { writeJsonFile } = await import("../apps/bench/src/io.js");

function usage(message) {
  process.stderr.write(
    `${message}\nusage : npx tsx scripts/rapport-defaut.mjs --prise <fichier> --instrument <fichier> --out <dossier> [--settings <fichier>]\n`,
  );
  process.exit(2);
}

/** Les options : chaque valeur attendue est exigée, jamais devinée. */
function lireOptions(argv) {
  const options = { prise: null, instrument: null, out: null, settings: null };
  for (let index = 0; index < argv.length; index += 1) {
    const jeton = argv[index];
    if (jeton === "--prise") options.prise = argv[++index] ?? usage("--prise attend un fichier");
    else if (jeton === "--instrument") options.instrument = argv[++index] ?? usage("--instrument attend un fichier");
    else if (jeton === "--out") options.out = argv[++index] ?? usage("--out attend un dossier");
    else if (jeton === "--settings") options.settings = argv[++index] ?? usage("--settings attend un fichier");
    else usage(`option inconnue : ${jeton}`);
  }
  if (options.prise === null) usage("--prise manquant");
  if (options.instrument === null) usage("--instrument manquant");
  if (options.out === null) usage("--out manquant");
  return options;
}

/** La version du dépôt : le commit et la description, sans réseau. */
function versionDuDepot() {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: RACINE, encoding: "utf8" }).trim();
    const description = execFileSync("git", ["describe", "--tags", "--always"], { cwd: RACINE, encoding: "utf8" }).trim();
    return description === commit ? commit : `${commit} (${description})`;
  } catch {
    return "inconnu";
  }
}

/**
 * Un chemin relatif au dépôt, en séparateurs `/` : un rapport ne porte jamais
 * de chemin absolu (aucune donnée personnelle). Hors du dépôt, le nom du
 * fichier seul, pour rester rejouable depuis la racine.
 */
function cheminRelatif(chemin) {
  const relatif = relative(RACINE, resolve(chemin));
  if (relatif.startsWith("..")) return basename(chemin);
  return relatif.split(sep).join("/");
}

async function principal(argv) {
  const options = lireOptions(argv);
  const instrument = await readInstrumentFile(options.instrument);
  const prise = await readTakeFile(options.prise);
  const reglages = reglagesDe(instrument, {
    settings: options.settings === null ? undefined : readSettingsFile(options.settings),
  });
  const chemins = {
    prise: cheminRelatif(options.prise),
    instrument: cheminRelatif(options.instrument),
    sortie: cheminRelatif(options.out),
  };
  const rapport = await renderDefectReport({
    prise,
    instrument,
    reglages,
    version: versionDuDepot(),
    date: new Date().toISOString(),
    chemins,
  });
  const fichier = writeJsonFile(join(options.out, "rapport-defaut.json"), rapport);
  process.stdout.write(`rapport écrit : ${fichier}\n`);
  process.stdout.write(`rejeu : ${rapport.rejeu}\n\n`);
  process.stdout.write(rapport.resume);
  process.stdout.write("\n");
}

principal(process.argv.slice(2)).catch((erreur) => {
  process.stderr.write(`échec : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`);
  process.exit(2);
});