#!/usr/bin/env node
/**
 * Contrôle de la publication : le site public sert-il EXACTEMENT le bundle
 * construit ? (incident : un bundle de 9 Kio servi pendant des heures, sans
 * que rien ne l'a signalé.)
 *
 * Ce que le script compare, sur l'adresse qu'on lui donne :
 *   - le bundle construit localement (`apps/web/dist`, le fichier nommé par
 *     `index.html`) et le bundle que le site public sert : même SHA-256 ;
 *   - la taille du bundle servi : sous 50 Kio, la publication est incomplète ;
 *   - la présence du modèle et de son moteur d'exécution servis par le site
 *     (`models/hand_landmarker.task`, `models/wasm/…`) : HTTP 200 ou 206, et
 *     une taille non nulle quand elle est connue.
 *
 * Ce que le script ne vérifie PAS : que la caméra fonctionne, que le son est
 * juste, ni le retard. Il compare des octets, pas l'instrument.
 *
 * Aucun son, aucune requête hors l'adresse testée (AIR-N-01, AIR-N-02) : le
 * modèle est mesuré par une requête de plage d'un octet, jamais téléchargé.
 *
 * Usage : node scripts/check-deployed.mjs [--url <adresse>] [--dist <dossier>]
 * Codes de sortie :
 *   0  le site public sert exactement le bundle construit ;
 *   1  écart constaté — une seule ligne sur la sortie d'erreur, qui dit quoi ;
 *   2  vérification impossible (réseau indisponible, ou build local absent).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { URL_DEFAUT, jsPrincipal, normalise } from "./sonde-dispo.mjs";
import { tailleServeur } from "./lib/taille.mjs";

/** Base publique du site (celle de `apps/web/vite.config.ts`). */
const BASE_PUBLIQUE = "/thin-air/";
/** Le modèle et son moteur d'exécution, servis par le site lui-même. */
const CHEMINS_SERVIS = [
  "models/hand_landmarker.task",
  "models/wasm/vision_wasm_internal.js",
  "models/wasm/vision_wasm_internal.wasm",
];
/** Sous cette taille, le bundle servi est un résidu : publication incomplète. */
const TAILLE_MIN_BUNDLE = 50 * 1024;
/** Délai d'une requête, comme la sonde de disponibilité. */
const DELAI_MS = 20_000;

/** Le réseau manque : la vérification est impossible, elle n'est pas en échec. */
class ReseauIndisponible extends Error {}
/** Un écart constaté : le site public ne sert pas le bundle construit. */
class Ecart extends Error {}
/** La vérification ne peut pas se faire (build local absent, option fausse). */
class VerifImpossible extends Error {}

/** SHA-256 d'un buffer, en hexadécimal. */
function sha256(octets) {
  return createHash("sha256").update(octets).digest("hex");
}

/** Découpe `--option=valeur` ; sans `=`, la valeur est l'argument suivant. */
function decoupe(argument, argv, index) {
  const egal = argument.indexOf("=");
  if (egal >= 0) return { valeur: argument.slice(egal + 1), suivant: index };
  const valeur = argv[index + 1];
  if (valeur === undefined || valeur.startsWith("--")) {
    throw new VerifImpossible(`${argument} demande une valeur`);
  }
  return { valeur, suivant: index + 1 };
}

/** Lit les options : `--url <adresse>` et `--dist <dossier local>`. */
function lisOptions(argv) {
  const options = { url: URL_DEFAUT, dist: join(process.cwd(), "apps", "web", "dist") };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i] ?? "";
    const drapeau = argument.split("=", 1)[0];
    if (drapeau !== "--url" && drapeau !== "--dist") {
      throw new VerifImpossible(`option inconnue : ${argument}`);
    }
    const lu = decoupe(argument, argv, i);
    if (drapeau === "--url") options.url = lu.valeur;
    else options.dist = resolve(lu.valeur);
    i = lu.suivant;
  }
  return options;
}

/** Une requête ; toute panne réseau devient « réseau indisponible ». */
async function interroge(url, options = {}) {
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(DELAI_MS),
      ...options,
    });
  } catch (erreur) {
    throw new ReseauIndisponible(`${url} : ${erreur.message}`);
  }
}

/** La page publique ; son corps est lu en entier (elle est minuscule). */
async function pagePublique(base) {
  const reponse = await interroge(base);
  if (!reponse.ok) {
    throw new Ecart(`le site public ne répond pas en 200 sur ${base} (HTTP ${reponse.status})`);
  }
  return await reponse.text();
}

/** L'URL du bundle publié, d'après le `<script src>` de la page publique. */
function urlBundle(html, base) {
  const trouve = jsPrincipal(html, base);
  if (trouve === null) throw new Ecart("la page publique ne nomme aucun bundle JavaScript");
  if ("tiers" in trouve) {
    throw new Ecart(`le bundle est servi par une origine tierce (${trouve.tiers}) — AIR-N-01`);
  }
  const chemin = new URL(trouve.url).pathname;
  if (!/\/assets\/index-[^/]+\.js$/.test(chemin)) {
    throw new Ecart(`la page publique ne nomme pas un bundle assets/index-*.js (${chemin})`);
  }
  return trouve.url;
}

/** Le fichier du bundle dans le build local, et son SHA-256. */
async function bundleLocal(dist) {
  let html;
  try {
    html = await readFile(join(dist, "index.html"), "utf8");
  } catch {
    throw new VerifImpossible(
      `build local introuvable : ${dist} — lancer « npm run build » avant le contrôle`,
    );
  }
  const trouve = html.match(/<script[^>]+src="([^"]*assets\/index-[^"]*\.js)"/i);
  if (!trouve?.[1]) {
    throw new VerifImpossible(`le build local ne nomme aucun bundle assets/index-*.js (${dist})`);
  }
  const octets = await litBundleLocal(dist, trouve[1]);
  return { chemin: trouve[1], octets, sha: sha256(octets) };
}

/** Lit le bundle dans le build local : chemin direct, puis dossier `assets`. */
async function litBundleLocal(dist, src) {
  const sansBase = src.startsWith(BASE_PUBLIQUE) ? src.slice(BASE_PUBLIQUE.length) : src;
  const candidats = [join(dist, sansBase.replace(/^\/+/, "")), join(dist, "assets", basename(src))];
  for (const candidat of candidats) {
    try {
      return await readFile(candidat);
    } catch {
      /* fichier absent : on essaie le suivant */
    }
  }
  throw new VerifImpossible(`bundle local introuvable (${src}) dans ${dist}`);
}

/** Le bundle servi par le site public, avec son SHA-256. */
async function bundlePublic(url) {
  const reponse = await interroge(url);
  if (!reponse.ok) {
    throw new Ecart(`le bundle public n'est pas servi (HTTP ${reponse.status}) sur ${url}`);
  }
  const octets = Buffer.from(await reponse.arrayBuffer());
  return { octets, sha: sha256(octets) };
}

/** Le modèle et son moteur d'exécution doivent être servis, non vides. */
async function verifieRessources(base) {
  for (const chemin of CHEMINS_SERVIS) {
    const url = new URL(chemin, base).toString();
    let mesure;
    try {
      mesure = await tailleServeur(url);
    } catch (erreur) {
      throw new ReseauIndisponible(`${url} : ${erreur.message}`);
    }
    if (mesure.statut !== 200 && mesure.statut !== 206) {
      throw new Ecart(`${chemin} n'est pas servi par le site public (HTTP ${mesure.statut})`);
    }
    if (mesure.taille === 0) {
      throw new Ecart(`${chemin} est servi vide (0 octet)`);
    }
  }
}

/** Une passe complète : le verdict, ou l'écart, en une ligne. */
async function principal(argv) {
  const options = lisOptions(argv);
  let base;
  try {
    base = normalise(options.url);
  } catch {
    throw new VerifImpossible(`adresse invalide : ${options.url}`);
  }
  const page = await pagePublique(base);
  const url = urlBundle(page, base);
  const local = await bundleLocal(options.dist);
  const servi = await bundlePublic(url);
  if (servi.octets.length < TAILLE_MIN_BUNDLE) {
    throw new Ecart(
      `le bundle public ne fait que ${servi.octets.length} octets ` +
        `(< ${TAILLE_MIN_BUNDLE}) — publication incomplète`,
    );
  }
  if (servi.sha !== local.sha) {
    throw new Ecart(
      `le site public ne sert pas le bundle construit : SHA-256 ${servi.sha.slice(0, 12)}… ` +
        `(public) au lieu de ${local.sha.slice(0, 12)}… (construit)`,
    );
  }
  await verifieRessources(base);
  process.stdout.write(
    `site public conforme : ${url} servi, SHA-256 ${servi.sha.slice(0, 12)}… ` +
      "identique au bundle construit ; modèle et moteur d'exécution servis.\n",
  );
  return 0;
}

try {
  process.exit(await principal(process.argv.slice(2)));
} catch (erreur) {
  if (erreur instanceof Ecart) {
    process.stderr.write(`${erreur.message}\n`);
    process.exit(1);
  }
  if (erreur instanceof ReseauIndisponible || erreur instanceof VerifImpossible) {
    process.stderr.write(`vérification impossible : ${erreur.message}\n`);
    process.exit(2);
  }
  throw erreur;
}
