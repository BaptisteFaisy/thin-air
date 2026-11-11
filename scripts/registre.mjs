#!/usr/bin/env node
/**
 * Le registre d'instruments partagés — sans backend (cahier §6.2 : « l'instrument
 * est un fichier »).
 *
 * Un instrument est une DONNÉE validée par schéma, jamais du code : rien ici
 * n'exécute quoi que ce soit venant d'un tiers. Le registre n'est qu'un dossier
 * (local, ou un dépôt git cloné dans un dossier temporaire) dont on liste les
 * fichiers, qu'on valide avec `@thin-air/schema`, et qu'on indexe.
 *
 * Usage (Node pur, aucun outillage de build) :
 *   node scripts/registre.mjs <dossier|url-git> [--publier] [--out <fichier>]
 *
 * Sortie : `out/registre.json` (dossier ignoré) et, avec `--publier`, un
 * Markdown prêt à coller dans le dépôt registre. Un fichier invalide est listé
 * AVEC ses raisons : jamais ignoré en silence (AIR-F-43).
 *
 * Aucun son (AIR-N-02). Aucune requête réseau sauf le `git clone` explicite
 * d'une URL donnée en argument ; depuis la page, rien ne part jamais (AIR-N-01) :
 * l'import réel passe par le fragment d'adresse (AIR-F-45).
 * Déterminisme : ni horodatage ni aléa, entrées triées par chemin.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// `@thin-air/schema` est livré en TypeScript source, sans build. Node décode les
// types, mais ne réécrit pas `./x.js` en `./x.ts` ; ce crochet de résolution fait
// ce seul pont, sur les chemins relatifs uniquement, avec repli si aucun `.ts`
// frère n'existe. Rien d'autre n'est intercepté.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && specifier.endsWith(".js")) {
      try {
        return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
      } catch {
        /* pas de `.ts` frère : le `.js` d'origine reprend la main. */
      }
    }
    return nextResolve(specifier, context);
  },
});

// Résolu depuis CE dépôt : `node_modules` est un lien vers un autre checkout, et
// le registre doit valider avec le schéma de l'arbre où il tourne.
const SCHEMA = new URL("../packages/schema/src/index.ts", import.meta.url);
const { parseInstrument, instrumentToFragment } = await import(SCHEMA.href);

const MOTEURS = { osc: "oscillateurs", pluck: "corde pincée", fm: "modulation de fréquence", drum: "percussion" };
const IGNORES = new Set([".git", "node_modules", "out", "dist", "coverage"]);
const SITE = "https://baptistefaisy.github.io/thin-air/";

function usage(code) {
  process.stderr.write(
    "usage : node scripts/registre.mjs <dossier|url-git> [--publier] [--out <fichier>]\n" +
      "  aucun argument exploitable : code 2\n",
  );
  process.exit(code);
}

/** `--publier` est le nom du brief ; `--markdown` reste accepté (même effet). */
function lireArguments(argv) {
  const opts = { source: null, publier: false, out: "out/registre.json" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--publier" || a === "--markdown") opts.publier = true;
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
  if (!/^(https?|ssh|git|file):\/\//i.test(source) && !source.startsWith("git@") && !source.endsWith(".git")) {
    let local;
    try {
      local = resolve(source);
      if (!statSync(local).isDirectory()) throw new Error("ce n'est pas un dossier");
    } catch (erreur) {
      process.stderr.write(`source inexploitable : ${source} (${erreur.message})\n`);
      process.exit(2);
    }
    return { dossier: local, temporaire: null };
  }
  const temporaire = mkdtempSync(join(tmpdir(), "registre-"));
  const clone = execFileSync("git", ["clone", "--depth", "1", source, temporaire], { encoding: "utf8" });
  void clone;
  return { dossier: temporaire, temporaire };
}

/** Tous les `*.json` sous un dossier, triés : même source, même ordre. */
function fichiersJson(dossier) {
  const trouves = [];
  const parcourir = (d) => {
    let entrees;
    try {
      entrees = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      if (IGNORES.has(entree.name)) continue;
      const chemin = join(d, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      else if (entree.name.toLowerCase().endsWith(".json")) trouves.push(chemin);
    }
  };
  parcourir(dossier);
  return trouves.sort();
}

/** Ce que l'instrument dessine : cordes, zones ou étendue. */
function geometrie(instrument) {
  if (instrument.strings) return `${instrument.strings.count} cordes (${instrument.strings.axis})`;
  if (instrument.zones) return `${instrument.zones.zones.length} zones`;
  if (instrument.range) return `étendue ${instrument.range.low}–${instrument.range.high}`;
  return "—";
}

/** Une entrée d'index ; `chemin` est relatif à la source, donc portable. */
function entreeDe(instrument, chemin) {
  return {
    nom: instrument.name,
    moteur: instrument.sound.engine,
    moteurTexte: MOTEURS[instrument.sound.engine] ?? instrument.sound.engine,
    gamme: { racine: instrument.scale.root, degres: [...instrument.scale.steps] },
    aimant: instrument.snap, // 0 = glissé libre, 1 = notes franches.
    geometrie: geometrie(instrument),
    voix: instrument.voices,
    fragment: instrumentToFragment(instrument),
    chemin,
  };
}

/** Lit et valide un fichier : jamais de refus silencieux (AIR-F-43). */
function lireFichier(chemin, dossier) {
  const origine = relative(dossier, chemin).split(sep).join("/");
  let json;
  try {
    json = JSON.parse(readFileSync(chemin, "utf8"));
  } catch (erreur) {
    return { ok: false, refus: { chemin: origine, raisons: [`JSON illisible : ${erreur.message}`] } };
  }
  const resultat = parseInstrument(json);
  if (!resultat.ok) return { ok: false, refus: { chemin: origine, raisons: [...resultat.reasons] } };
  return { ok: true, entree: entreeDe(resultat.value, origine) };
}

function indexer(dossier) {
  const valides = [];
  const refuses = [];
  for (const chemin of fichiersJson(dossier)) {
    const lu = lireFichier(chemin, dossier);
    if (lu.ok) valides.push(lu.entree);
    else refuses.push(lu.refus);
  }
  const parChemin = (a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0);
  return { valides: valides.sort(parChemin), refuses: refuses.sort(parChemin) };
}

/** Le Markdown prêt à coller dans le dépôt registre. */
function enMarkdown(index) {
  const lignes = [
    "# Registre d'instruments Thin Air",
    "",
    "Un instrument est un fichier de données validé par schéma, jamais du code.",
    "Chaque lien ouvre l'instrument depuis le fragment d'adresse : rien ne passe",
    "par un serveur (AIR-F-45, AIR-N-01).",
    "",
    "| Instrument | Moteur | Géométrie | Aimant | Voix | Fichier | Lien |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const i of index.valides) {
    lignes.push(`| ${i.nom} | ${i.moteurTexte} | ${i.geometrie} | ${i.aimant} | ${i.voix} | \`${i.chemin}\` | [ouvrir](${SITE}#i=${i.fragment}) |`);
  }
  if (index.refuses.length > 0) {
    lignes.push("", "## Fichiers refusés", "", "Aucun refus n'est passé sous silence :", "");
    for (const r of index.refuses) lignes.push(`- \`${r.chemin}\` : ${r.raisons.join(" ; ")}`);
  }
  return `${lignes.join("\n")}\n`;
}

function rapporter(index, opts) {
  process.stdout.write(
    `${index.valides.length} instrument(s) valide(s), ${index.refuses.length} refusé(s) → ${opts.out}\n`,
  );
  for (const i of index.valides) {
    process.stdout.write(`  ✓ ${i.nom} · ${i.moteurTexte} · ${i.geometrie} · aimant ${i.aimant}\n`);
  }
  for (const r of index.refuses) {
    process.stderr.write(`  ✗ ${r.chemin} : ${r.raisons.join(" ; ")}\n`);
  }
  if (opts.publier) process.stdout.write(`\n${enMarkdown(index)}`);
}

const opts = lireArguments(process.argv.slice(2));
const { dossier, temporaire } = resoudreSource(opts.source);
try {
  const index = indexer(dossier);
  const cible = resolve(opts.out);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, `${JSON.stringify(index, null, 2)}\n`);
  rapporter(index, opts);
  process.exit(index.valides.length === 0 ? 1 : 0);
} finally {
  if (temporaire) rmSync(temporaire, { recursive: true, force: true });
}
