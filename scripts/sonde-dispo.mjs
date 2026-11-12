#!/usr/bin/env node
/**
 * Sonde de disponibilité du site (AIR-N-13 : site statique en HTTPS, gratuit,
 * en ligne jusqu'au 29 janvier 2027 au moins).
 *
 * Quatre ressources critiques sont interrogées sur l'adresse publique du site :
 * la page, le JS principal, `models/hand_landmarker.task` et un fichier wasm.
 * Les requêtes sont HEAD — ou GET à corps plafonné pour la page seule, afin d'y
 * lire le nom du JS — donc les ~22 Mo du modèle et de son moteur d'exécution ne
 * sont JAMAIS téléchargés.
 *
 * Chaque ressource doit rendre : un code HTTP 2xx, un Content-Type attendu, et
 * un en-tête `Cache-Control` présent. La moindre anomalie fait sortir non nul :
 * c'est l'alerte (`.github/workflows/sonde.yml`, quotidienne).
 *
 * Ce que la sonde prouve : les fichiers sont servis. Ce qu'elle ne prouve PAS :
 * que l'instrument joue (voir `docs/disponibilite.md`).
 *
 * Aucune requête vers un tiers (AIR-N-01) : une seule origine, celle de `--url`.
 *
 * Usage : node scripts/sonde-dispo.mjs [--url <adresse>] [--json] [--out <dossier>]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { instantFichier } from "./horodatage.mjs";

/** Adresse publiée par `deploy.yml` (GitHub Pages, base `/thin-air/`). */
export const URL_DEFAUT = "https://baptistefaisy.github.io/thin-air/";
const CHEMIN_MODELE = "models/hand_landmarker.task";
const CHEMIN_WASM = "models/wasm/vision_wasm_internal.wasm";
/** Plafond du corps lu pour la page : assez pour y trouver le JS, jamais plus. */
const OCTETS_PAGE = 65_536;
const DELAI_MS = 20_000;

/** Types MIME acceptés par ressource, comparés sans paramètre (`; charset=…`). */
const TYPES_ATTENDUS = {
  page: ["text/html"],
  js: ["application/javascript", "text/javascript"],
  modele: ["application/octet-stream"],
  wasm: ["application/wasm", "application/octet-stream"],
};

const HOTES_LOCAUX = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Lit les options de la ligne de commande. Usage invalide → sortie 2. */
export function lisOptions(argv) {
  const options = { url: URL_DEFAUT, json: false, out: join("out", "sonde") };
  const avecValeur = { "--url": "url", "--out": "out" };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i] ?? "";
    const [drapeau, valeur] = argument.split("=");
    if (argument === "--json") options.json = true;
    else if (avecValeur[drapeau] !== undefined) {
      const cle = avecValeur[drapeau];
      const retenue = valeur !== undefined && drapeau !== argument ? valeur : argv[++i];
      if (retenue === undefined) {
        process.stderr.write(`${drapeau} demande une valeur\n`);
        process.exit(2);
      }
      options[cle] = retenue;
    } else {
      process.stderr.write(`option inconnue : ${argument}\n`);
      process.exit(2);
    }
  }
  return options;
}

/** L'adresse du site, terminée par `/` : les chemins relatifs s'y accrochent. */
export function normalise(url) {
  const propre = new URL(url);
  if (!propre.pathname.endsWith("/")) propre.pathname += "/";
  return propre.toString();
}

/** AIR-N-13 : HTTPS obligatoire (la caméra est refusée sur une origine nue). */
export function exigenceHttps(url) {
  const adresse = new URL(url);
  if (adresse.protocol === "https:") return null;
  if (HOTES_LOCAUX.has(adresse.hostname)) return null;
  return `origine (${url}) : adresse non HTTPS (${adresse.protocol}) — la caméra serait refusée`;
}

/** En-têtes utiles d'une réponse, lus sans toucher au corps. */
function releve(reponse, methode) {
  return {
    methode,
    statut: reponse.status,
    contentType: reponse.headers.get("content-type") ?? "",
    cacheControl: reponse.headers.get("cache-control") ?? "",
  };
}

/** Ferme proprement un corps non lu : aucun octet de plus ne circule. */
async function jette(reponse) {
  await reponse.body?.cancel().catch(() => {});
}

/** HEAD ; si l'hôte le refuse (405/501), GET à plage d'un octet, corps jeté. */
export async function enTetes(url) {
  const options = { redirect: "follow", signal: AbortSignal.timeout(DELAI_MS) };
  const reponse = await fetch(url, { ...options, method: "HEAD" });
  if (reponse.status !== 405 && reponse.status !== 501) {
    const entetes = releve(reponse, "HEAD");
    await jette(reponse);
    return entetes;
  }
  await jette(reponse);
  const repli = await fetch(url, {
    ...options,
    method: "GET",
    headers: { Range: "bytes=0-0" },
  });
  const entetes = releve(repli, "GET plage 0-0");
  await jette(repli);
  return entetes;
}

/** GET plafonné : lit au plus `limite` octets, puis coupe la connexion. */
export async function corpsPlafonne(url, limite) {
  const reponse = await fetch(url, {
    method: "GET",
    headers: { Range: `bytes=0-${limite - 1}` },
    redirect: "follow",
    signal: AbortSignal.timeout(DELAI_MS),
  });
  const entetes = releve(reponse, "GET corps plafonné");
  const lecteur = reponse.body?.getReader();
  if (!lecteur) return { ...entetes, corps: "" };
  const morceaux = [];
  let total = 0;
  while (total < limite) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(Buffer.from(value));
    total += value.byteLength;
  }
  await lecteur.cancel().catch(() => {});
  return { ...entetes, corps: Buffer.concat(morceaux).toString("utf8").slice(0, limite) };
}

/** Le JS principal nommé par la page : `assets/<empreinte>.js`. */
export function jsPrincipal(html, base) {
  const trouve = html.match(/<script[^>]+src="([^"]+\.js)"/i);
  if (!trouve?.[1]) return null;
  const adresse = new URL(trouve[1], base);
  if (adresse.origin !== new URL(base).origin) return { tiers: adresse.toString() };
  return { url: adresse.toString() };
}

/** Les trois contrôles communs : code HTTP, Content-Type, Cache-Control. */
export function ecarts(nom, chemin, entetes, typesAcceptes) {
  const trous = [];
  if (!(entetes.statut >= 200 && entetes.statut < 300)) {
    trous.push(`${nom} (${chemin}) : HTTP ${entetes.statut}, attendu 2xx — fichier non servi`);
  }
  const type = entetes.contentType.split(";")[0].trim().toLowerCase();
  if (!typesAcceptes.includes(type)) {
    trous.push(
      `${nom} (${chemin}) : Content-Type « ${entetes.contentType || "absent"} », ` +
        `attendu « ${typesAcceptes.join(" » ou « ")} »`,
    );
  }
  if (entetes.cacheControl.trim() === "") {
    trous.push(
      `${nom} (${chemin}) : Cache-Control absent — le visiteur retéléchargerait le modèle ` +
        "à chaque passage (docs/hosting.md)",
    );
  }
  return trous;
}

/** Une ressource vide : requête impossible, ou sonde interrompue avant. */
const RIEN = { methode: "-", statut: 0, contentType: "", cacheControl: "" };

/** Une ligne de résultat, prête pour le JSON comme pour l'affichage. */
export function ligne(nom, url, entetes, typesAcceptes) {
  const chemin = new URL(url).pathname;
  const trous = ecarts(nom, chemin, entetes, typesAcceptes);
  return {
    nom,
    chemin,
    methode: entetes.methode,
    statut: entetes.statut,
    contentType: entetes.contentType,
    cacheControl: entetes.cacheControl,
    ok: trous.length === 0,
    anomalies: trous,
  };
}

/** Contrôle par les seuls en-têtes : le corps n'est jamais demandé. */
async function controleEnTetes(nom, url, types) {
  try {
    return ligne(nom, url, await enTetes(url), types);
  } catch (erreur) {
    const echec = ligne(nom, url, RIEN, types);
    echec.anomalies.push(`${nom} (${echec.chemin}) : requête impossible — ${message(erreur)}`);
    echec.ok = false;
    return echec;
  }
}

/** La page : seul corps lu (plafonné), car c'est elle qui nomme le JS. */
async function controlePage(base, trous) {
  try {
    const entetes = await corpsPlafonne(base, OCTETS_PAGE);
    const resultat = ligne("page", base, entetes, TYPES_ATTENDUS.page);
    const js = jsPrincipal(entetes.corps, base);
    if (js === null) {
      trous.push(`page (${resultat.chemin}) : aucun <script src="….js"> trouvé — page vide ou tronquée`);
      return { resultat, jsUrl: null };
    }
    if ("tiers" in js) {
      trous.push(`page (${resultat.chemin}) : JS servi par une origine tierce (${js.tiers}) — AIR-N-01`);
      return { resultat, jsUrl: null };
    }
    return { resultat, jsUrl: js.url };
  } catch (erreur) {
    const echec = ligne("page", base, RIEN, TYPES_ATTENDUS.page);
    echec.anomalies.push(`page (${echec.chemin}) : requête impossible — ${message(erreur)}`);
    echec.ok = false;
    trous.push(...echec.anomalies);
    return { resultat: echec, jsUrl: null };
  }
}

/** Les quatre ressources critiques, dans un ordre fixe (déterminisme). */
export async function sonde(base) {
  // Sans HTTPS rien ne peut marcher (la caméra est refusée) : on s'arrête là,
  // sans émettre la moindre requête.
  const https = exigenceHttps(base);
  if (https !== null) return { lignes: [], anomalies: [https] };

  const trous = [];
  const page = await controlePage(base, trous);
  const lignes = [page.resultat];
  if (page.jsUrl !== null) lignes.push(await controleEnTetes("js", page.jsUrl, TYPES_ATTENDUS.js));
  lignes.push(await controleEnTetes("modele", new URL(CHEMIN_MODELE, base).toString(), TYPES_ATTENDUS.modele));
  lignes.push(await controleEnTetes("wasm", new URL(CHEMIN_WASM, base).toString(), TYPES_ATTENDUS.wasm));

  for (const ligne_ of lignes) trous.push(...ligne_.anomalies);
  return { lignes, anomalies: trous };
}

/** Le résultat horodaté, destiné à `out/sonde/<date>.json` (dossier ignoré). */
export function resultat(base, lignes, anomalies) {
  return {
    outil: "scripts/sonde-dispo.mjs",
    exigence: "AIR-N-13",
    horodatage: new Date().toISOString(),
    url: base,
    ok: anomalies.length === 0,
    ressources: lignes.map(({ anomalies: _omises, ...reste }) => reste),
    anomalies,
  };
}

function message(erreur) {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

/** Affichage humain : une ligne par ressource, puis les anomalies. */
export function imprime(resultat_, cheminFichier) {
  process.stdout.write(`sonde Thin Air (AIR-N-13) — ${resultat_.url}\n`);
  for (const ressource of resultat_.ressources) {
    process.stdout.write(
      `  ${ressource.ok ? "✓" : "✗"} ${ressource.nom.padEnd(7)} ${ressource.methode.padEnd(18)} ` +
        `${String(ressource.statut).padEnd(4)} ${ressource.contentType || "-"} · ` +
        `cache-control: ${ressource.cacheControl || "ABSENT"}\n`,
    );
  }
  for (const anomalie of resultat_.anomalies) process.stderr.write(`  ✗ ${anomalie}\n`);
  process.stdout.write(
    resultat_.ok
      ? `site servi, aucune anomalie — résultat écrit dans ${cheminFichier}\n`
      : `${resultat_.anomalies.length} anomalie(s) — lecture dans docs/disponibilite.md\n`,
  );
}

/** Écrit le JSON horodaté et rend son chemin. */
export async function ecris(resultat_, dossier) {
  await mkdir(dossier, { recursive: true });
  const chemin = join(dossier, `${instantFichier(new Date(resultat_.horodatage))}.json`);
  await writeFile(chemin, `${JSON.stringify(resultat_, null, 2)}\n`, "utf8");
  return chemin;
}

/** Une passe complète : sonde, écriture du résultat, affichage, code de sortie. */
export async function principal(argv) {
  const options = lisOptions(argv);
  let base;
  try {
    base = normalise(options.url);
  } catch {
    process.stderr.write(`--url invalide : « ${options.url} »\n`);
    return 2;
  }
  const { lignes, anomalies } = await sonde(base);
  const resultat_ = resultat(base, lignes, anomalies);
  const chemin = await ecris(resultat_, options.out);
  if (options.json) process.stdout.write(`${JSON.stringify(resultat_, null, 2)}\n`);
  else imprime(resultat_, chemin);
  return resultat_.ok ? 0 : 1;
}

if (process.argv[1]?.endsWith("sonde-dispo.mjs")) process.exit(await principal(process.argv.slice(2)));
