#!/usr/bin/env node
/**
 * La garde des rapports de rendu figés, pour la CI.
 *
 *   node scripts/check-golden.mjs
 *
 * Rejoue les sept rendus de référence avec le banc (`bench render --no-wav`),
 * les compare aux rapports gelés dans `takes/reference/<nom>.expected.json`
 * avec `bench compare` (tolérances du cahier §13), et sort non nul au premier
 * écart. Une ligne par prise, avec les nombres clés, pour un journal lisible.
 *
 * Node pur, aucune dépendance : le script n'importe que `node:*` et fait
 * calculer le banc (tsx). Aucun son, aucun périphérique audio (AIR-N-02) :
 * les rendus sont hors ligne et les écritures restent dans `os.tmpdir()`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join("apps", "bench", "src", "cli.ts");

/**
 * Les prises que la recette §18 compare avec l'aimant à 1. Même liste que
 * `apps/bench/src/golden.test.ts` (ce script est en Node pur et ne peut pas
 * l'importer) — les deux doivent bouger ensemble.
 */
const AIMANT_UN = new Set(["slow-rise", "tremor-at-boundary"]);

/** Le tsx du dépôt, lancé par Node directement (pas de `npx`, plus lent). */
function tsx() {
  const local = join(RACINE, "node_modules", ".bin", "tsx");
  return { commande: local, args: [] };
}

/** Nombre à décimales fixes, virgule française (comme la sortie du banc). */
function fixe(valeur, decimales) {
  return valeur.toFixed(decimales).replace("-", "−").replace(".", ",");
}

/** Lance le banc et rend { code, sortie } ; `code` null = processus tué. */
function banc(args, options = {}) {
  const { commande, args: prefixe } = tsx();
  const resultat = spawnSync(commande, [...prefixe, CLI, ...args], {
    cwd: RACINE,
    encoding: "utf8",
    ...options,
  });
  return { code: resultat.status, sortie: `${resultat.stdout ?? ""}${resultat.stderr ?? ""}` };
}

/**
 * La liste des prises vient du banc lui-même (`REFERENCE_TAKES`), jamais
 * recopiée ici : un tsx éphémère l'importe et l'imprime en JSON.
 */
function casDuBanc() {
  const snippet =
    "import('./apps/bench/src/takes.js').then((m) => process.stdout.write(" +
    "JSON.stringify(m.REFERENCE_TAKES.map((s) => ({ name: s.name, instrument: s.instrument })))));";
  const { commande } = tsx();
  const resultat = spawnSync(commande, ["-e", snippet], { cwd: RACINE, encoding: "utf8" });
  if (resultat.status !== 0) throw new Error(`liste des prises illisible : ${resultat.stderr}`);
  return JSON.parse(resultat.stdout);
}

/** Rend une prise dans le dossier temporaire et rend le chemin du rapport. */
function rendre(cas, tmp) {
  const args = [
    "render",
    "--take", join("takes", "reference", `${cas.name}.json`),
    "--instrument", cas.instrument,
    "--out", join(tmp, cas.name),
    "--no-wav",
  ];
  if (AIMANT_UN.has(cas.name)) {
    const reglages = join(tmp, "aimant-1.json");
    writeFileSync(reglages, '{"magnet":1}\n');
    args.push("--settings", reglages);
  }
  const { code, sortie } = banc(args);
  if (code !== 0) throw new Error(`rendu de ${cas.name} en échec (code ${code}) :\n${sortie}`);
  return join(tmp, cas.name, "report.json");
}

/** La ligne de journal d'une prise : paliers, écart max, crête, silence. */
function ligne(cas, rapport) {
  const ecartMax = rapport.notes.reduce((max, note) => Math.max(max, Math.abs(note.cents)), 0);
  return (
    `✓ ${cas.name.padEnd(20)} ` +
    `paliers ${String(rapport.notes.length).padStart(2)} · ` +
    `écart max ${fixe(ecartMax, 2)} centièmes · ` +
    `crête ${fixe(rapport.peakDb, 2)} dB · ` +
    `silence final ${fixe(rapport.silenceAfterMs, 1)} ms`
  );
}

function verifier(cas, tmp) {
  const rapport = JSON.parse(readFileSync(rendre(cas, tmp), "utf8"));
  const { code, sortie } = banc([
    "compare",
    join(tmp, cas.name, "report.json"),
    join("takes", "reference", `${cas.name}.expected.json`),
  ]);
  if (code !== 0) {
    process.stdout.write(`✗ ${cas.name} — écart au rapport gelé :\n${sortie}`);
    process.exit(1);
  }
  process.stdout.write(`${ligne(cas, rapport)}\n`);
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), "check-golden-"));
  try {
    for (const cas of casDuBanc()) verifier(cas, tmp);
    process.stdout.write("rapports de référence conformes : aucun écart au-delà des tolérances du §13.\n");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
