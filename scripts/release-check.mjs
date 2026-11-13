#!/usr/bin/env node
/**
 * Le contrat de release, vérifié après coup.
 *
 * Une release est complète quand elle tient les quatre éléments ensemble :
 * une version, une section de changelog, un tag git, une publication vérifiée.
 * Ce script contrôle les quatre et sort 1 dès que l'un manque.
 *
 * Ce qu'il contrôle, dans l'ordre :
 *   1. le tag de la version existe (API GitHub) ;
 *   2. il pointe sur un commit de `main` (API GitHub, comparaison) ;
 *   3. le changelog du commit du tag a une section pour cette version ;
 *   4. le site public sert le bundle construit, comparaison SHA-256 fichier
 *      par fichier — la publication est vérifiée APRÈS coup, jamais promise.
 *
 * Une publication incomplète échoue : un fichier absent du site public, un
 * contenu différent, une page qui référence un fichier absent du bundle
 * construit — c'est un refus, avec la liste des écarts.
 *
 * Le bundle = le site construit (`apps/web/dist`), hors modèle de vision :
 * le modèle et son moteur d'exécution pèsent 20 Mo et sont contrôlés par la
 * sonde de disponibilité (`scripts/sonde-dispo.mjs`), jamais téléchargés ici.
 *
 * Réseau : deux origines seulement — l'API GitHub et l'adresse publique du
 * site (AIR-N-01). Aucun son, jamais (AIR-N-02).
 *
 * Usage : node scripts/release-check.mjs [--version v0.1.0] [--url <adresse>]
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** L'adresse publique du site (GitHub Pages, base `/thin-air/`). */
export const URL_PUBLIQUE = "https://tradoooo.github.io/thin-air/";

/** L'API GitHub du dépôt : seule autre origine autorisée. */
export const API_GITHUB = "https://api.github.com/repos/Tradoooo/thin-air";

/** Le dossier du site construit par Vite. */
export const DOSSIER_BUNDLE = "apps/web/dist";

/** Ce qui sort du bundle : le modèle de vision et son moteur d'exécution. */
const HORS_BUNDLE = ["models/"];

/** Un motif de version : `1.2.3`, `v1.2.3`, `1.2.3-rc.1`. */
const VERSION = /v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

/** Le SHA-256 d'un contenu, en hexadécimal minuscule. */
export function sha256(contenu) {
  return createHash("sha256").update(contenu).digest("hex");
}

/** Normalise une version ou un titre de section : `v0.1.0 — 2026-11-12` → `0.1.0`. */
export function normaliseVersion(texte) {
  const trouve = VERSION.exec(texte ?? "");
  return trouve ? trouve[1] : String(texte ?? "").trim();
}

/**
 * Le changelog a-t-il une section pour cette version ?
 * Une section = un titre `##` ou `###` ET au moins une ligne de contenu :
 * un titre seul ne raconte rien.
 */
export function sectionDuChangelog(markdown, version) {
  const cible = normaliseVersion(version);
  let dansLaSection = false;
  let contenu = 0;
  for (const ligne of String(markdown ?? "").split("\n")) {
    const entete = /^#{2,3}\s+(.+)$/.exec(ligne);
    if (entete) {
      if (dansLaSection && contenu > 0) return true;
      dansLaSection = normaliseVersion(entete[1]) === cible;
      contenu = 0;
      continue;
    }
    if (dansLaSection && ligne.trim() !== "") contenu += 1;
  }
  return dansLaSection && contenu > 0;
}

/** Les fichiers du bundle construit : chemin relatif et SHA-256, triés. */
export async function bundleConstruit(racine, dossier = DOSSIER_BUNDLE) {
  const base = join(racine, dossier);
  const fichiers = await parcoursBundle(base);
  return fichiers.sort((a, b) => a.chemin.localeCompare(b.chemin));
}

/** Parcourt un dossier et rend ses fichiers (hors modèle de vision). */
async function parcoursBundle(base, dossier = base) {
  const sortie = [];
  let entrees;
  try {
    entrees = await readdir(dossier, { withFileTypes: true });
  } catch {
    return sortie;
  }
  for (const entree of entrees) {
    const chemin = join(dossier, entree.name);
    const relatif = relative(base, chemin).split(sep).join("/");
    if (HORS_BUNDLE.some((prefixe) => relatif.startsWith(prefixe))) continue;
    if (entree.isDirectory()) {
      sortie.push(...(await parcoursBundle(base, chemin)));
      continue;
    }
    sortie.push({ chemin: relatif, sha256: sha256(await readFile(chemin)) });
  }
  return sortie;
}

/** Les fichiers que la page publique référence, en chemins relatifs au site. */
export function referencesHtml(html, url) {
  const base = new URL(url).pathname;
  const trouves = new Set();
  for (const trouve of String(html ?? "").matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
    const valeur = trouve[1];
    if (!valeur.startsWith(base)) continue;
    trouves.add(valeur.slice(base.length));
  }
  return [...trouves].sort();
}

/** Les fichiers servis par le site public : SHA-256, ou null si le site n'en sert pas. */
export async function bundlePublic(url, chemins) {
  const fichiers = [];
  let indexHtml = "";
  for (const chemin of chemins) {
    const reponse = await fetch(url + chemin);
    if (!reponse.ok) {
      fichiers.push({ chemin, sha256: null });
      continue;
    }
    const corps = Buffer.from(await reponse.arrayBuffer());
    if (chemin === "index.html") indexHtml = corps.toString("utf8");
    fichiers.push({ chemin, sha256: sha256(corps) });
  }
  return { fichiers, references: referencesHtml(indexHtml, url) };
}

/** Les écarts entre le bundle construit et le bundle servi en ligne. */
export function ecartsBundle(construit, servi) {
  const enLigne = new Map(servi.fichiers.map((fichier) => [fichier.chemin, fichier.sha256]));
  const ecarts = [];
  for (const fichier of construit) {
    const empreinte = enLigne.get(fichier.chemin);
    if (empreinte === undefined || empreinte === null) {
      ecarts.push(`${fichier.chemin} : absent du site public`);
      continue;
    }
    if (empreinte !== fichier.sha256) {
      ecarts.push(
        `${fichier.chemin} : sha256 construit ${fichier.sha256.slice(0, 12)} ≠ servi ${empreinte.slice(0, 12)}`,
      );
    }
  }
  const connus = new Set(construit.map((fichier) => fichier.chemin));
  for (const reference of servi.references) {
    if (!connus.has(reference)) {
      ecarts.push(`${reference} : référencé par la page publique, absent du bundle construit`);
    }
  }
  return ecarts;
}

/** Une vérification ratée : le motif, et les écarts qui l'expliquent. */
export function echec(motif, details = []) {
  return { ok: false, motif, details };
}

/** Une vérification réussie. */
export function reussite(motif) {
  return { ok: true, motif, details: [] };
}

/**
 * Vérifie une release entière : tag, changelog, bundle public.
 * Le monde (tag, changelog, disque, réseau) est injectable : les tests
 * utilisent des témoins, jamais le réseau.
 */
export async function verifieRelease(monde, version) {
  const tags = await monde.listerTags();
  const tag = tags.find((candidat) => normaliseVersion(candidat.nom) === normaliseVersion(version));
  if (!tag) return echec(`aucun tag pour la version ${version}`);
  if (!(await monde.tagEstDansMain(tag.sha))) {
    return echec(`le tag ${tag.nom} pointe sur un commit absent de main`);
  }
  const changelog = await monde.lireChangelog(tag.sha);
  if (changelog === null) return echec(`CHANGELOG.md absent au commit du tag ${tag.nom}`);
  if (!sectionDuChangelog(changelog, version)) {
    return echec(`le changelog n'a pas de section pour la version ${version}`);
  }
  const bundle = await monde.lireBundleLocal();
  if (bundle.length === 0) {
    return echec(`bundle construit absent (${DOSSIER_BUNDLE}) : construire le site avant le contrôle`);
  }
  const commit = await monde.lireCommitLocal();
  if (commit && commit !== tag.sha) {
    return echec(`le bundle construit vient du commit ${commit.slice(0, 7)}, pas du commit du tag`);
  }
  const servi = await monde.lireBundlePublic(bundle.map((fichier) => fichier.chemin));
  const ecarts = ecartsBundle(bundle, servi);
  if (ecarts.length > 0) return echec("le site public ne sert pas le bundle construit", ecarts);
  return reussite(
    `version ${version} vérifiée : tag ${tag.nom} sur main, changelog présent, ` +
      `bundle public identique (${bundle.length} fichiers)`,
  );
}

/** Une requête JSON vers l'API GitHub. */
async function requeteJson(url) {
  const reponse = await fetch(url, {
    headers: { accept: "application/vnd.github+json", "user-agent": "thin-air-release-check" },
  });
  if (!reponse.ok) throw new Error(`API GitHub : ${url} → HTTP ${reponse.status}`);
  return reponse.json();
}

/** Les tags du dépôt : nom et commit visé. */
export async function listerTags(api = API_GITHUB) {
  const tags = await requeteJson(`${api}/tags?per_page=100`);
  return tags.map((tag) => ({ nom: tag.name, sha: tag.commit?.sha ?? "" }));
}

/** Le commit du tag est-il dans `main` ? La comparaison GitHub tranche. */
export async function tagEstDansMain(sha, api = API_GITHUB) {
  const comparaison = await requeteJson(`${api}/compare/main...${sha}`);
  return comparaison.status === "behind" || comparaison.status === "identical";
}

/** Le changelog tel qu'il est au commit du tag — pas celui du travail en cours. */
export async function lireChangelog(sha, api = API_GITHUB) {
  const reponse = await fetch(`${api}/contents/CHANGELOG.md?ref=${sha}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "thin-air-release-check" },
  });
  if (!reponse.ok) return null;
  const donnees = await reponse.json();
  return Buffer.from(donnees.content ?? "", "base64").toString("utf8");
}

/** Le commit local, pour vérifier que le bundle construit vient bien du tag. */
export function commitLocal(racine = process.cwd()) {
  const resultat = spawnSync("git", ["rev-parse", "HEAD"], { cwd: racine, encoding: "utf8" });
  return resultat.status === 0 ? resultat.stdout.trim() : null;
}

/** Le monde réel : API GitHub, site public, disque local. */
export function mondeReel({ url = URL_PUBLIQUE, api = API_GITHUB, racine = process.cwd() } = {}) {
  return {
    listerTags: () => listerTags(api),
    tagEstDansMain: (sha) => tagEstDansMain(sha, api),
    lireChangelog: (sha) => lireChangelog(sha, api),
    lireBundleLocal: () => bundleConstruit(racine),
    lireBundlePublic: (chemins) => bundlePublic(url, chemins),
    lireCommitLocal: () => commitLocal(racine),
  };
}

/** Les options de la ligne de commande. */
export function lisOptions(argv) {
  const options = { version: null, url: URL_PUBLIQUE, api: API_GITHUB, racine: process.cwd() };
  const avecValeur = { "--version": "version", "--url": "url", "--api": "api", "--racine": "racine" };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    const [drapeau, valeur] = argument.split("=");
    if (avecValeur[drapeau] === undefined) continue;
    options[avecValeur[drapeau]] = valeur !== undefined && drapeau !== argument ? valeur : argv[++i];
  }
  return options;
}

/** La version du manifeste, quand la ligne de commande n'en donne pas. */
export async function versionDuManifeste(racine = process.cwd()) {
  try {
    const manifeste = JSON.parse(await readFile(join(racine, "package.json"), "utf8"));
    return manifeste.version ?? null;
  } catch {
    return null;
  }
}

/** La ligne de commande : contrôle, puis code de sortie. */
export async function principal(argv) {
  const options = lisOptions(argv);
  const version = options.version ?? (await versionDuManifeste(options.racine));
  if (!version) {
    process.stderr.write("✗ version inconnue : passer --version <v> ou avoir un package.json\n");
    return 1;
  }
  try {
    const resultat = await verifieRelease(mondeReel(options), version);
    if (resultat.ok) {
      process.stdout.write(`✓ ${resultat.motif}\n`);
      return 0;
    }
    process.stderr.write(`✗ release non vérifiée — ${resultat.motif}\n`);
    for (const detail of resultat.details) process.stderr.write(`  · ${detail}\n`);
    return 1;
  } catch (erreur) {
    process.stderr.write(`✗ release non vérifiée — ${erreur?.message ?? erreur}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await principal(process.argv.slice(2)));
}
