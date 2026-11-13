#!/usr/bin/env node
/**
 * Contrôle du mode hors ligne DEPUIS L'ADRESSE PUBLIQUE du site
 * (`https://tradoooo.github.io/thin-air/`).
 *
 * Ce que le contrôle interroge, sur la seule origine du site (AIR-N-01) :
 *
 *   1. la page répond-elle, en HTML ;
 *   2. le service worker est-il publié (`sw.js`), et est-ce bien du JavaScript ;
 *   3. la liste des fichiers que LE SERVICE WORKER LUI-MÊME déclare mettre en
 *      cache — elle est lue dans son source, pas devinée : c'est elle qui
 *      décide de ce qui redémarre hors ligne ;
 *   4. le modèle de vision et le fichier d'exécution MediaPipe sont-ils
 *      publiés, EN ENTIER (taille déclarée), avec le bon type ;
 *   5. la coquille (`/` et `/index.html`) répond-elle.
 *
 * Aucun octet lourd n'est téléchargé : tout est lu en HEAD, et le corps du
 * seul `sw.js` (5 ko) pour y lire la liste du préchauffage.
 *
 * Le verdict est sans ambiguïté :
 *   « hors ligne opérationnel »     — tout ce qui est nécessaire y est ;
 *   « hors ligne NON opérationnel » — suivi de la raison exacte de l'échec.
 *
 * Le contrôle ne se substitue pas à la preuve du navigateur (le rechargement
 * réseau coupé, lui, se joue dans `apps/web/e2e/hors-ligne.spec.ts`) : il
 * vérifie que ce que le service worker promet de garder est PUBLIÉ, donc
 * qu'il pourra le garder.
 *
 * Usage : node scripts/check-offline.mjs [--url <adresse>] [--json]
 */
import {
  CHEMIN_MODELE,
  CHEMIN_WASM,
  corpsPlafonne,
  enTetes,
  ecris,
  exigenceHttps,
  lisOptions,
  normalise,
} from "./sonde-dispo.mjs";
import { tailleServeur } from "./lib/taille.mjs";

/** Le service worker, tel qu'il est publié à la racine du site. */
const CHEMIN_SW = "sw.js";
/** La coquille : les deux adresses mises en cache à l'installation. */
const COQUILLE = ["./", "./index.html"];
/** Taille minimale du modèle de vision, en octets (le vrai pèse 7 819 105). */
const OCTETS_MODELE = 7_000_000;
/** Taille minimale du fichier d'exécution MediaPipe (le vrai pèse 14 603 354). */
const OCTETS_WASM = 10_000_000;
/** Plafond du corps lu pour `sw.js` : il fait 5 ko, la marge est large. */
const OCTETS_SW = 65_536;

/**
 * La liste des fichiers que le service worker déclare mettre en cache, lue
 * dans son propre source (`const LOURDS = [...]`). `null` si la liste n'est
 * plus lisible : le contrôle le dit alors, il ne devine pas.
 */
export function listePprechauffage(source) {
  const bloc = source.match(/const\s+LOURDS\s*=\s*\[([\s\S]*?)\]/);
  if (bloc === null) return null;
  return [...bloc[1].matchAll(/"([^"]+)"/g)].map((trouve) => trouve[1]);
}

/** La raison exacte d'un échec, ou "" si la ressource est là. */
function raison(entetes, typeAttendu) {
  if (entetes.statut < 200 || entetes.statut >= 300) {
    return `HTTP ${entetes.statut}, attendu 2xx — le fichier n'est pas publié`;
  }
  if (typeAttendu !== "" && !entetes.contentType.includes(typeAttendu)) {
    return `Content-Type « ${entetes.contentType || "absent"} », attendu « ${typeAttendu} »`;
  }
  return "";
}

/** Une ressource contrôlée : son adresse, son statut, sa taille, ses remarques. */
function ressource(nom, chemin, entetes, remarques) {
  return {
    nom,
    chemin,
    statut: entetes.statut,
    methode: entetes.methode,
    contentType: entetes.contentType,
    contentLength: entetes.contentLength,
    ok: remarques.length === 0,
    remarques,
  };
}

/** Un contrôle en HEAD, avec sa raison d'échec éventuelle. */
async function controle(nom, chemin, url, typeAttendu) {
  try {
    const entetes = await enTetes(url);
    const echec = raison(entetes, typeAttendu);
    return { ...ressource(nom, chemin, entetes, echec === "" ? [] : [echec]), echec };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    return {
      ...ressource(nom, chemin, { statut: 0, methode: "HEAD", contentType: "", contentLength: 0 }, [
        `requête impossible — ${message}`,
      ]),
      echec: `requête impossible — ${message}`,
    };
  }
}

/**
 * La taille réelle du fichier servi, et la remarque si le fichier est tronqué.
 *
 * Un HEAD annonce la taille COMPRESSÉE : sur GitHub Pages, le modèle de
 * 7 819 105 o est annoncé à 5 882 509 o, et la comparaison avec la taille
 * attendue dirait « tronqué » à tort. La mesure est donc faite par une plage
 * d'un octet, dont la réponse donne la taille totale — la même mesure que
 * `scripts/check-deployed.mjs` (`scripts/lib/taille.mjs`, une seule
 * implémentation).
 */
async function verifieTaille(controle_, url, octetsMinimum) {
  if (controle_.echec !== "") return;
  let mesure;
  try {
    mesure = await tailleServeur(url);
  } catch (erreur) {
    controle_.remarques.push(
      `taille non mesurée — ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    );
    return;
  }
  if (mesure.taille === null) {
    controle_.remarques.push("taille non mesurée — l'hébergeur ne la donne pas");
    return;
  }
  controle_.contentLength = mesure.taille;
  if (mesure.taille >= octetsMinimum) return;
  const message = `taille ${mesure.taille} o, attendu au moins ${octetsMinimum} o — fichier tronqué`;
  controle_.remarques.push(message);
  controle_.echec = message;
  controle_.ok = false;
}

/**
 * La liste de préchauffage déclarée par `sw.js`, et l'état de publication de
 * chacun de ses fichiers. Un fichier absent n'est pas une anomalie du mode
 * hors ligne : le worker ignore l'échec, et le site ne demande pas ces
 * fichiers (voir `scripts/fetch-model.mjs`). C'est dit, pas caché.
 */
async function listePublique(base, anomalies) {
  const precache = [];
  let source = "";
  try {
    const lu = await corpsPlafonne(new URL(CHEMIN_SW, base).toString(), OCTETS_SW);
    source = lu.corps;
  } catch (erreur) {
    anomalies.push(`service worker : source illisible — ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    return precache;
  }
  const declares = listePprechauffage(source);
  if (declares === null) {
    anomalies.push("service worker : liste de préchauffage illisible dans sw.js");
    return precache;
  }
  for (const chemin of declares) {
    const entetes = await enTetes(new URL(chemin, base).toString());
    precache.push({
      chemin,
      statut: entetes.statut,
      publie: entetes.statut >= 200 && entetes.statut < 300,
      contentLength: entetes.contentLength,
    });
  }
  return precache;
}

/**
 * Le contrôle complet : la page, le service worker, sa liste de préchauffage,
 * le modèle, le wasm et la coquille.
 */
export async function controleHorsLigne(base) {
  const anomalies = [];
  const ressources = [];

  const https = exigenceHttps(base);
  if (https !== null) return { base, anomalies: [https], ressources, precache: [], verdict: false };

  const page = await controle("page", "/", base, "text/html");
  ressources.push(page);
  if (page.echec !== "") anomalies.push(`page : ${page.echec}`);

  const worker = await controle("service worker", `/${CHEMIN_SW}`, new URL(CHEMIN_SW, base).toString(), "javascript");
  ressources.push(worker);
  if (worker.echec !== "") anomalies.push(`service worker : ${worker.echec}`);

  const precache = await listePublique(base, anomalies);

  const urlModele = new URL(CHEMIN_MODELE, base).toString();
  const modele = await controle("modele", `/${CHEMIN_MODELE}`, urlModele, "");
  await verifieTaille(modele, urlModele, OCTETS_MODELE);
  ressources.push(modele);
  if (modele.echec !== "") anomalies.push(`modele : ${modele.echec}`);

  const urlWasm = new URL(CHEMIN_WASM, base).toString();
  const wasm = await controle("wasm", `/${CHEMIN_WASM}`, urlWasm, "wasm");
  await verifieTaille(wasm, urlWasm, OCTETS_WASM);
  ressources.push(wasm);
  if (wasm.echec !== "") anomalies.push(`wasm : ${wasm.echec}`);

  for (const chemin of COQUILLE) {
    const coquille = await controle("coquille", chemin, new URL(chemin, base).toString(), "");
    ressources.push(coquille);
    if (coquille.echec !== "") anomalies.push(`coquille (${chemin}) : ${coquille.echec}`);
  }

  return { base, anomalies, ressources, precache, verdict: anomalies.length === 0 };
}

/** Le résultat, prêt pour le JSON comme pour l'affichage. */
export function resultat(base, controle_) {
  const absents = controle_.precache.filter((entree) => !entree.publie).map((entree) => entree.chemin);
  return {
    outil: "scripts/check-offline.mjs",
    exigence: "AIR-F-54",
    horodatage: new Date().toISOString(),
    url: base,
    ok: controle_.verdict,
    verdict: controle_.verdict ? "hors ligne opérationnel" : "hors ligne NON opérationnel",
    ressources: controle_.ressources,
    precache: controle_.precache,
    nonPublies: absents,
    anomalies: controle_.anomalies,
  };
}

/** Affichage humain : une ligne par ressource, puis le verdict. */
export function imprime(r) {
  process.stdout.write(`contrôle hors ligne — ${r.url}\n`);
  for (const entree of r.ressources) {
    process.stdout.write(
      `  ${entree.ok ? "✓" : "✗"} ${entree.nom.padEnd(15)} ${String(entree.statut).padEnd(4)} ` +
        `${entree.contentType || "-"} · ${entree.contentLength} o\n`,
    );
  }
  for (const anomalie of r.anomalies) process.stderr.write(`  ✗ ${anomalie}\n`);
  if (r.nonPublies.length > 0) {
    process.stdout.write(
      `  · préchauffage : ${r.nonPublies.length} fichier(s) déclaré(s) par sw.js ne sont pas publiés ` +
        `(${r.nonPublies.join(", ")}) — le site ne les demande pas (scripts/fetch-model.mjs), ` +
        "sans effet sur le mode hors ligne\n",
    );
  }
  process.stdout.write(`VERDICT : ${r.verdict}\n`);
}

/** Une passe complète : contrôle, écriture du résultat, affichage, code de sortie. */
export async function principal(argv) {
  const options = lisOptions(argv, "out/hors-ligne");
  let base;
  try {
    base = normalise(options.url);
  } catch {
    process.stderr.write(`--url invalide : « ${options.url} »\n`);
    return 2;
  }
  const r = resultat(base, await controleHorsLigne(base));
  const chemin = await ecris(r, options.out);
  if (options.json) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  else imprime(r);
  process.stdout.write(`résultat écrit dans ${chemin}\n`);
  return r.ok ? 0 : 1;
}

// `process.exitCode` plutôt que `process.exit` : la sortie standard est
// asynchrone quand elle est branchée sur un tube, et un appel direct à
// `process.exit` tronquerait le verdict affiché.
if (process.argv[1]?.endsWith("check-offline.mjs")) process.exitCode = await principal(process.argv.slice(2));
