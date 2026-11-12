#!/usr/bin/env node
/**
 * Garde de publication — vérifie SANS RIEN PUBLIER que les trois paquets du
 * moteur (`@thin-air/core`, `@thin-air/audio`, `@thin-air/schema`) sont
 * cohérents pour un usage hors du dépôt (docs/bibliotheque.md).
 *
 * Vérifications, par paquet :
 *  1. `package.json` lisible ; `name`, `version`, `type` présents et cohérents
 *     (bloquant), plus les champs requis pour publier (bloquants eux aussi) :
 *     `license`, `files` (tableau non vide) et `exports` dont l'entrée "."
 *     pointe vers un fichier qui existe sur le disque (docs/publication.md).
 *  2. Tout fichier `.ts` de `src/` (hors `*.test.ts`) est joignable depuis
 *     `src/index.ts`, depuis une entrée secondaire déclarée ci-dessous, ou
 *     depuis un test du paquet (fixtures vivantes, pas code mort).
 *  3. Aucune importation d'un paquet non déclaré en dépendance : les imports
 *     nus hors `node:` doivent être dans les `dependencies` du paquet. Un
 *     frère de workspace non déclaré (`@thin-air/*`) → conseil de publication.
 *  4. Aucun fichier sonore : délègue à la garde existante
 *     `scripts/hooks/no-audio-asset-guard.mjs` (zéro duplication).
 *
 * Usage : `node scripts/pack-check.mjs [racine]` → 0 si tout est vert.
 * Code non nul dès le premier problème bloquant ; les conseils sont imprimés
 * mais ne bloquent pas (paquets encore `private`).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(process.argv[2] ?? join(ICI, ".."));
const PAQUETS = ["core", "audio", "schema"];
const BUILTINS = new Set(builtinModules);
const GARDE_SON = join("scripts", "hooks", "no-audio-asset-guard.mjs");

/**
 * Entrées secondaires déclarées, avec leur raison : un module de `src/` qui
 * n'est pas reachable depuis `index.ts` mais sert quand même de point
 * d'entrée documenté. Toute autre orpheline est un problème bloquant.
 */
const ENTRES_SECONDAIRES = {
  audio: [
    {
      file: "src/worklets/pluck-processor.ts",
      raison: "module AudioWorklet chargé par URL (audioWorklet.addModule), jamais importé par le site",
    },
    {
      file: "src/graph/index.ts",
      raison: "barillet documenté de la face jeu direct (voir son en-tête)",
    },
  ],
};

const soucis = [];
const conseils = new Set();

function bloquant(texte) {
  soucis.push(texte);
  process.stderr.write(`✗ ${texte}\n`);
  process.stderr.write(`${soucis.length} problème(s) bloquant(s) — publication incohérente.\n`);
  process.exit(1);
}

function lireJson(fichier, quoi) {
  try {
    return JSON.parse(readFileSync(fichier, "utf8"));
  } catch (erreur) {
    bloquant(`${quoi} illisible : ${relative(RACINE, fichier)} — ${erreur.message}`);
  }
}

/** 1. Manifeste : champs requis, nom cohérent avec le dossier, licence. */
function verifierManifeste(paquet, dossier) {
  const chemin = join(dossier, "package.json");
  if (!existsSync(chemin)) bloquant(`paquet ${paquet} : package.json absent`);
  const m = lireJson(chemin, `packages/${paquet}/package.json`);
  const attendu = `@thin-air/${paquet}`;
  if (m.name !== attendu) bloquant(`${paquet} : name « ${String(m.name)} » ≠ « ${attendu} »`);
  for (const champ of ["version", "type"]) {
    if (typeof m[champ] !== "string" || m[champ] === "") {
      bloquant(`${paquet} : champ « ${champ} » absent de package.json`);
    }
  }
  if (m.type !== "module") bloquant(`${paquet} : type « ${String(m.type)} » ≠ « module » (ESM requis)`);
  verifierPublication(paquet, dossier, m);
  return m;
}

/**
 * 1 bis. Champs exigés pour qu'un paquet soit publiable (docs/publication.md) :
 * `license`, `files` (tableau non vide de chemins existants) et `exports`
 * (objet dont chaque cible relative — motif `*` résolu par son index — pointe
 * vers un fichier présent sur le disque). Bloquant, paquet `private` ou non.
 */
function verifierPublication(paquet, dossier, m) {
  if (typeof m.license !== "string" || m.license === "") {
    bloquant(`${paquet} : champ « license » absent de package.json (requis pour publier)`);
  }
  if (!Array.isArray(m.files) || m.files.length === 0 || m.files.some((f) => typeof f !== "string" || f === "")) {
    bloquant(`${paquet} : champ « files » absent ou invalide — attendu un tableau non vide de chemins`);
  }
  for (const entree of m.files) {
    if (!existsSync(join(dossier, entree))) bloquant(`${paquet} : « files » liste un chemin absent : ${entree}`);
  }
  if (typeof m.exports !== "object" || m.exports === null || Array.isArray(m.exports)) {
    bloquant(`${paquet} : champ « exports » absent — attendu un objet de sous-chemins`);
  }
  for (const [cle, cible] of Object.entries(m.exports)) {
    if (typeof cible !== "string" || cible === "") bloquant(`${paquet} : exports["${cle}"] n'est pas une chaîne`);
    const fichier = cible.includes("*") ? cible.replace("*", "index.ts") : cible;
    if (!existsSync(join(dossier, fichier))) {
      bloquant(`${paquet} : exports["${cle}"] → « ${cible} » ne pointe vers aucun fichier existant`);
    }
  }
}

/** Les fichiers `.ts` de `src/`, triés (déterminisme, AIR-N-09). */
function fichiersSrc(src) {
  const trouves = [];
  const pile = [src];
  while (pile.length > 0) {
    const dossier = pile.pop();
    for (const entree of readdirSync(dossier, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) pile.push(chemin);
      else if (entree.name.endsWith(".ts")) trouves.push(chemin);
    }
  }
  return trouves.sort();
}

/** Imports relatifs et nus d'un fichier (statiques, dynamiques, `export *`). */
function importsDe(fichier) {
  const texte = readFileSync(fichier, "utf8");
  const motif = /(?:\bfrom|\bimport|\bexport)\s*\(?\s*["']([^"']+)["']/g;
  const specifiques = [];
  let m;
  while ((m = motif.exec(texte)) !== null) specifiques.push(m[1]);
  return specifiques;
}

function resoudreRelatif(spec, depuis) {
  let cible = resolve(dirname(depuis), spec);
  if (cible.endsWith(".js")) cible = `${cible.slice(0, -3)}.ts`;
  return existsSync(cible) ? cible : null;
}

/**
 * 2. Accessibilité : BFS depuis index.ts, entrées secondaires et tests.
 * Rend la liste des sources et l'ensemble PUBLIC (joignable depuis index.ts
 * ou une entrée secondaire) : le reste est du soutien de tests, non livré.
 */
function verifierAccessibilite(paquet, src) {
  const index = join(src, "index.ts");
  if (!existsSync(index)) bloquant(`${paquet} : src/index.ts absent`);
  const tous = fichiersSrc(src);
  const secondaires = (ENTRES_SECONDAIRES[paquet] ?? []).map((e) => {
    const chemin = join(src, "..", e.file);
    if (!existsSync(chemin)) bloquant(`${paquet} : entrée secondaire déclarée absente : ${e.file}`);
    return chemin;
  });
  const publics = atteindre([index, ...secondaires]);
  const soutenus = atteindre(tous.filter((f) => f.endsWith(".test.ts")));
  for (const fichier of tous) {
    if (fichier.endsWith(".test.ts") || publics.has(fichier) || soutenus.has(fichier)) continue;
    bloquant(`${paquet} : fichier orphelin, joignable depuis aucune entrée : ${relative(RACINE, fichier)}`);
  }
  return { sources: tous.filter((f) => !f.endsWith(".test.ts")), publics };
}

/** Fermeture transitive des imports relatifs depuis les fichiers racines. */
function atteindre(racines) {
  const vus = new Set();
  const file = [...racines];
  while (file.length > 0) {
    const courant = file.pop();
    if (vus.has(courant)) continue;
    vus.add(courant);
    for (const spec of importsDe(courant)) {
      if (!spec.startsWith(".")) continue;
      const cible = resoudreRelatif(spec, courant);
      if (cible !== null && !vus.has(cible)) file.push(cible);
    }
  }
  return vus;
}

/** Le nom de paquet d'un spécificateur nu (`zod`, `@thin-air/core/x`…). */
function nomPaquet(spec) {
  const morceaux = spec.split("/");
  return spec.startsWith("@") ? morceaux.slice(0, 2).join("/") : morceaux[0];
}

/**
 * 3. Dépendances : tout import nu est déclaré, built-in, ou signalé.
 * La surface publique n'a droit qu'aux `dependencies` du paquet ; les tests
 * et leur soutien (non livrés) peuvent utiliser les devDependencies racine.
 */
function verifierDependances(paquet, manifeste, sources, publics) {
  const racinePkg = lireJson(join(RACINE, "package.json"), "package.json racine");
  const declares = new Set(Object.keys(manifeste.dependencies ?? {}));
  const devRacine = new Set(Object.keys(racinePkg.devDependencies ?? {}));
  const workspaces = nomsWorkspaces(racinePkg);
  for (const fichier of sources) {
    const soutien = !publics.has(fichier);
    for (const spec of importsDe(fichier)) {
      if (spec.startsWith(".") || spec.startsWith("node:")) continue;
      const nom = nomPaquet(spec);
      if (nom === manifeste.name || BUILTINS.has(nom) || declares.has(nom)) continue;
      if (soutien && devRacine.has(nom)) continue; // tests : outillage du monorepo
      if (workspaces.has(nom)) {
        conseils.add(`${paquet} : « ${nom} » importé (${relative(RACINE, dirname(fichier))}/…) mais non déclaré — à déclarer avant publication`);
        continue;
      }
      bloquant(`${paquet} : import « ${nom} » (${relative(RACINE, fichier)}) d'un paquet non déclaré en dépendance`);
    }
  }
}

/** Les noms de paquets déclarés dans les workspaces de la racine. */
function nomsWorkspaces(racinePkg) {
  return new Set(
    (racinePkg.workspaces ?? []).map((w) => {
      const chemin = join(RACINE, w, "package.json");
      return existsSync(chemin) ? lireJson(chemin, w).name : null;
    }),
  );
}

/** 4. Aucun fichier sonore : la garde existante du dépôt, telle quelle. */
function verifierAucunSon() {
  const garde = join(RACINE, GARDE_SON);
  if (!existsSync(garde)) bloquant(`garde sonore absente : ${GARDE_SON} (la CI du dépôt doit la fournir)`);
  const r = spawnSync(process.execPath, [garde], { cwd: RACINE, encoding: "utf8" });
  if (r.status !== 0) bloquant(`fichier sonore détecté par ${GARDE_SON} :\n${r.stderr ?? r.stdout}`);
}

process.stdout.write(`pack-check — racine : ${RACINE}\n`);
for (const paquet of PAQUETS) {
  const dossier = join(RACINE, "packages", paquet);
  if (!existsSync(dossier)) bloquant(`paquet manquant : packages/${paquet}`);
  const manifeste = verifierManifeste(paquet, dossier);
  const { sources, publics } = verifierAccessibilite(paquet, join(dossier, "src"));
  verifierDependances(paquet, manifeste, sources, publics);
  process.stdout.write(`✓ @thin-air/${paquet} : manifeste, ${sources.length} sources joignables, dépendances\n`);
}
verifierAucunSon();
process.stdout.write("✓ aucun fichier sonore (garde no-audio-asset-guard)\n");
for (const conseil of conseils) process.stdout.write(`• conseil : ${conseil}\n`);
process.stdout.write(conseils.size > 0 ? `pack-check : 0 problème, ${conseils.size} conseil(s)\n` : "pack-check : 0 problème\n");
