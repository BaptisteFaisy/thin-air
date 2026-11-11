#!/usr/bin/env -S tsx
/**
 * Le registre d'instruments partagés — sans backend (cahier §6.2 : « l'instrument
 * est un fichier »).
 *
 * Un instrument est une DONNÉE validée par schéma, jamais du code : rien ici
 * n'exécute quoi que ce soit venant d'un tiers. Le registre n'est qu'un dossier
 * (local, ou un dépôt git cloné dans un dossier temporaire) dont on liste les
 * fichiers, qu'on valide avec `@thin-air/schema`, et qu'on indexe.
 *
 * Usage :
 *   npx tsx scripts/registre.mjs <dossier|url-git> [--markdown] [--out <fichier>]
 *
 * Sortie : `out/registre.json` (dossier ignoré) et, avec `--markdown`, un tableau
 * prêt à coller dans le dépôt registre. Un fichier invalide est listé AVEC ses
 * raisons : jamais ignoré en silence.
 *
 * Aucun son, aucun réseau sauf le `git clone` explicite d'une URL.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseInstrument, instrumentToFragment } from "@thin-air/schema";

const MOTEURS = { osc: "oscillateurs", pluck: "corde pincée", fm: "modulation de fréquence", drum: "percussion" };

function usage(code) {
  process.stderr.write(
    "usage : registre.mjs <dossier|url-git> [--markdown] [--out <fichier>]\n" +
      "  aucun argument exploitable : code 2\n",
  );
  process.exit(code);
}

function lireArguments(argv) {
  const opts = { source: null, markdown: false, out: "out/registre.json" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--markdown") opts.markdown = true;
    else if (a === "--out") opts.out = argv[++i] ?? opts.out;
    else if (a === "--help" || a === "-h") usage(0);
    else if (!opts.source) opts.source = a;
    else usage(2);
  }
  if (!opts.source) usage(2);
  return opts;
}

/** Une URL git est clonée dans un dossier temporaire, jeté à la fin. */
function resoudreSource(source) {
  if (!/^https?:\/\//.test(source) && !source.endsWith(".git")) {
    const local = resolve(source);
    if (!statSync(local).isDirectory()) {
      process.stderr.write(`source introuvable : ${source}\n`);
      process.exit(2);
    }
    return { dossier: local, temporaire: null };
  }
  const temporaire = mkdtempSync(join(tmpdir(), "registre-"));
  execFileSync("git", ["clone", "--depth", "1", source, temporaire], { stdio: "ignore" });
  return { dossier: temporaire, temporaire };
}

function fichiersJson(dossier) {
  const trouves = [];
  const parcourir = (d) => {
    for (const entree of readdirSync(d, { withFileTypes: true })) {
      if (entree.name === ".git" || entree.name === "node_modules") continue;
      const chemin = join(d, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      else if (entree.name.endsWith(".json")) trouves.push(chemin);
    }
  };
  parcourir(dossier);
  return trouves.sort();
}

function geometrie(instrument) {
  if (instrument.strings) return `${instrument.strings.count} cordes (${instrument.strings.axis})`;
  if (instrument.zones) return `${instrument.zones.zones.length} zones`;
  if (instrument.range) return `étendue ${instrument.range.low}–${instrument.range.high}`;
  return "—";
}

function indexer(dossier) {
  const valides = [];
  const refuses = [];
  for (const chemin of fichiersJson(dossier)) {
    let json;
    try {
      json = JSON.parse(readFileSync(chemin, "utf8"));
    } catch (erreur) {
      refuses.push({ chemin, raisons: [`JSON illisible : ${erreur.message}`] });
      continue;
    }
    const resultat = parseInstrument(json);
    if (!resultat.ok) {
      refuses.push({ chemin, raisons: resultat.reasons });
      continue;
    }
    const i = resultat.value;
    valides.push({
      nom: i.name,
      moteur: i.sound.engine,
      moteurTexte: MOTEURS[i.sound.engine] ?? i.sound.engine,
      gamme: { racine: i.scale.root, degres: i.scale.steps },
      aimant: i.snap,
      geometrie: geometrie(i),
      voix: i.voices,
      fragment: instrumentToFragment(i),
      chemin,
    });
  }
  valides.sort((a, b) => a.nom.localeCompare(b.nom));
  return { generéLe: null, valides, refuses };
}

function enMarkdown(index) {
  const lignes = [
    "| Instrument | Moteur | Géométrie | Aimant | Voix | Fragment (extrait) |",
    "|---|---|---|---|---|---|",
  ];
  for (const i of index.valides) {
    lignes.push(`| ${i.nom} | ${i.moteurTexte} | ${i.geometrie} | ${i.aimant} | ${i.voix} | \`${i.fragment.slice(0, 18)}…\` |`);
  }
  if (index.refuses.length > 0) {
    lignes.push("", "## Fichiers refusés", "");
    for (const r of index.refuses) lignes.push(`- \`${r.chemin}\` : ${r.raisons.join(" ; ")}`);
  }
  return `${lignes.join("\n")}\n`;
}

const opts = lireArguments(process.argv.slice(2));
const { dossier, temporaire } = resoudreSource(opts.source);
try {
  const index = indexer(dossier);
  mkdirSync(dirname(resolve(opts.out)), { recursive: true });
  writeFileSync(resolve(opts.out), `${JSON.stringify({ valides: index.valides, refuses: index.refuses }, null, 2)}\n`);
  process.stdout.write(
    `${index.valides.length} instrument(s) valide(s), ${index.refuses.length} refusé(s) → ${opts.out}\n`,
  );
  for (const i of index.valides) {
    process.stdout.write(`  ✓ ${i.nom} · ${i.moteurTexte} · ${i.geometrie} · aimant ${i.aimant}\n`);
  }
  for (const r of index.refuses) {
    process.stderr.write(`  ✗ ${r.chemin} : ${r.raisons.join(" ; ")}\n`);
  }
  if (opts.markdown) process.stdout.write(`\n${enMarkdown(index)}`);
  process.exit(index.refuses.length > 0 && index.valides.length === 0 ? 1 : 0);
} finally {
  if (temporaire) rmSync(temporaire, { recursive: true, force: true });
}
