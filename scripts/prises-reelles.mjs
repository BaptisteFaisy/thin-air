#!/usr/bin/env -S npx tsx
/**
 * L'ingestion des prises réelles (lot N7, cahier §7.11, §13.3, annexe D).
 *
 *   npx tsx scripts/prises-reelles.mjs <dossier-téléchargé> --machine <nom> [--date AAAA-MM-JJ] [--out takes/real]
 *
 * Une seule commande pour un non-développeur : elle lit les fichiers
 * téléchargés depuis la page `?record=1`, les valide (`parseTake` de
 * `@thin-air/schema`), vérifie la vie privée avec la GARDE EXISTANTE
 * `scripts/hooks/take-privacy-guard.mjs` (aucun champ interdit, poids par
 * seconde sous son plafond), les range dans `takes/real/` sous le nom
 * `<scénario>-<machine>-<date>.json`, puis lève la première mesure :
 * la convention de côté du modèle sur la prise `left-hand-only` (§7.3).
 *
 * Décision de versionnage (lot N7) : `takes/real/` est dans `.gitignore`.
 * Les points d'une main restent une donnée corporelle (§7.11) : la prise
 * reste sur l'appareil, seul le harnais (scripts, docs, tests) est versionné.
 *
 * Le script est en JavaScript pur (.mjs) mais importe le schéma TypeScript :
 * le lancer avec `npx tsx` (comme le banc d'essai), jamais avec `node` nu.
 * Aucun son, aucun réseau (AIR-N-01, AIR-N-02).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..");
const GARDE = join(RACINE, "scripts", "hooks", "take-privacy-guard.mjs");
const DATE_DU_JOUR = new Date().toISOString().slice(0, 10);

function ecrire(texte) {
  process.stdout.write(texte);
}

/** Charge le schéma et les scénarios ; dit clairement comment lancer sinon. */
async function chargerOutils() {
  try {
    const schema = await import("@thin-air/schema");
    const scenarios = await import("../apps/web/src/state/realTake.js");
    return { parseTake: schema.parseTake, scenarioFromFilename: scenarios.scenarioFromFilename };
  } catch (erreur) {
    ecrire(`impossible de charger @thin-air/schema : ${String(erreur)}\n`);
    ecrire("lance ce script avec : npx tsx scripts/prises-reelles.mjs …\n");
    process.exit(2);
  }
}

function usage(message) {
  process.stderr.write(
    `${message}\nusage : npx tsx scripts/prises-reelles.mjs <dossier> --machine <nom> [--date AAAA-MM-JJ] [--out takes/real]\n`,
  );
  process.exit(2);
}

export function lireOptions(argv) {
  const options = { dossier: null, machine: null, date: DATE_DU_JOUR, out: join(RACINE, "takes", "real") };
  for (let i = 0; i < argv.length; i += 1) {
    const jeton = argv[i];
    if (jeton === "--machine") options.machine = argv[++i] ?? usage("--machine attend un nom");
    else if (jeton === "--date") options.date = argv[++i] ?? usage("--date attend AAAA-MM-JJ");
    else if (jeton === "--out") options.out = resolve(argv[++i] ?? usage("--out attend un dossier"));
    else if (jeton.startsWith("--")) usage(`option inconnue : ${jeton}`);
    else if (options.dossier === null) options.dossier = resolve(jeton);
    else usage("un seul dossier attendu");
  }
  if (options.dossier === null) usage("dossier manquant");
  if (options.machine === null) usage("--machine manquant (le nom de la machine qui mesure, ex. : pc-portable)");
  if (!/^[a-z0-9-]+$/i.test(options.machine)) usage(`nom de machine refusé : ${options.machine} (lettres, chiffres, tirets)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) usage(`date refusée : ${options.date} (AAAA-MM-JJ attendu)`);
  return options;
}

/** Un fichier candidat : son nom, son scénario, sa prise validée ou ses raisons de refus. */
export function examiner(chemin, outils) {
  const nom = chemin.slice(chemin.lastIndexOf("/") + 1);
  const scenario = outils.scenarioFromFilename(nom);
  if (scenario === null) {
    return { nom, refus: ["nom illisible : attendu left-hand-only-…, reach-… ou tremor-… (fichiers de la page ?record=1)"] };
  }
  let brut;
  try {
    brut = JSON.parse(readFileSync(chemin, "utf8"));
  } catch (erreur) {
    return { nom, scenario, refus: [`JSON illisible (${String(erreur)})`] };
  }
  const resultat = outils.parseTake(brut);
  if (!resultat.ok) return { nom, scenario, refus: resultat.reasons.map((raison) => `prise invalide : ${raison}`) };
  return { nom, scenario, prise: resultat.value, refus: [] };
}

/** Le nom normalisé : `<scénario>-<machine>-<date>.json`, sans collision. */
export function nomNormalise(scenario, machine, date, dejaPris) {
  let nom = `${scenario}-${machine}-${date}.json`;
  let numero = 2;
  while (dejaPris.has(nom)) nom = `${scenario}-${machine}-${date}-${numero++}.json`;
  dejaPris.add(nom);
  return nom;
}

/**
 * La vie privée d'UN candidat, vérifiée par la GARDE du dépôt (zéro
 * duplication) : il est copié dans une racine temporaire en `takes/real/`,
 * puis `take-privacy-guard.mjs` est lancé dessus (clés refusées, poids par
 * seconde sous son plafond). Rend la liste des raisons de refus.
 */
function gardePrivee(nomCible, prise) {
  const racine = mkdtempSync(join(tmpdir(), "prises-reelles-"));
  try {
    mkdirSync(join(racine, "takes", "real"), { recursive: true });
    writeFileSync(join(racine, "takes", "real", nomCible), JSON.stringify(prise));
    const garde = spawnSync(process.execPath, [GARDE], {
      input: JSON.stringify({ cwd: racine }),
      encoding: "utf8",
      timeout: 60_000,
    });
    if (garde.status === 0) return [];
    const sortie = `${garde.stderr ?? ""}${garde.stdout ?? ""}`;
    return sortie
      .split("\n")
      .filter((ligne) => ligne.includes(" — ") || ligne.includes("refus"))
      .map((ligne) => ligne.trim());
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

/**
 * Mesure 1 (annexe D, §7.3) : la convention de côté sur image en miroir.
 * Sur une prise réelle `left-hand-only`, chaque main de chaque image DOIT
 * être annoncée « left » par le modèle. Rend null si conforme, sinon la raison.
 */
export function verifierCote(prise) {
  const cotes = new Set(prise.frames.flatMap((image) => image.hands.map((main) => main.side)));
  const vus = [...cotes].sort().join(", ");
  if (cotes.size === 1 && cotes.has("left")) return null;
  return `côtés vus : { ${vus} } — « left » seul attendu (convention du modèle, §7.3)`;
}

/** Examine puis passe à la garde chaque fichier du dossier : candidats et refus. */
function trierFichiers(options, outils) {
  const entrees = readdirSync(options.dossier).filter((nom) => nom.endsWith(".json")).sort();
  if (entrees.length === 0) usage(`aucun fichier .json dans ${options.dossier}`);
  const candidats = [];
  const refus = [];
  const dejaPris = new Set();
  for (const nom of entrees) {
    const examen = examiner(join(options.dossier, nom), outils);
    if (examen.prise === undefined) {
      for (const raison of examen.refus) refus.push(`${nom} — ${raison}`);
      continue;
    }
    const nomCible = nomNormalise(examen.scenario, options.machine, options.date, dejaPris);
    const raisonsGarde = gardePrivee(nomCible, examen.prise);
    if (raisonsGarde.length > 0) {
      for (const raison of raisonsGarde) refus.push(`${nom} — garde take-privacy : ${raison}`);
      continue;
    }
    candidats.push({ ...examen, nomCible });
  }
  return { candidats, refus };
}

/** Mesure 1 (annexe D, §7.3) sur chaque prise `left-hand-only` rangée. */
function mesurerCote(candidats) {
  let echec = 0;
  for (const candidat of candidats.filter((c) => c.scenario === "left-hand-only")) {
    const ecart = verifierCote(candidat.prise);
    if (ecart === null) {
      ecrire(`✓ MESURE côté (§7.3) sur ${candidat.nomCible} : le modèle annonce « left » — convention confirmée sur caméra réelle.\n`);
    } else {
      ecrire(`✗ MESURE côté (§7.3) sur ${candidat.nomCible} : ${ecart}\n`);
      echec = 1;
    }
  }
  return echec;
}

/** Le bilan, et les commandes qui lèvent les deux autres points de l'annexe D. */
function conclure(candidats, refus) {
  ecrire(`\n${candidats.length} prise(s) rangée(s), ${refus.length} refus.\n`);
  ecrire("Suites (docs/prises-reelles.md) :\n");
  ecrire("  filtre (§7.5)  : npx tsx apps/bench/src/tuning.ts --take takes/real/tremor-<machine>-<date>.json\n");
  ecrire("  calibration    : la prise reach-<machine>-<date>.json porte l'envergure (§7.4)\n");
  ecrire("  retard (§18)   : lire le panneau Latency de la page sur chaque machine, recopier dans docs/latency.md\n");
}

async function principal(argv) {
  const outils = await chargerOutils();
  const options = lireOptions(argv);
  let tri;
  try {
    tri = trierFichiers(options, outils);
  } catch (erreur) {
    usage(`dossier illisible : ${options.dossier} (${String(erreur)})`);
    return 2;
  }
  const { candidats, refus } = tri;
  if (candidats.length > 0) {
    mkdirSync(options.out, { recursive: true });
    for (const candidat of candidats) {
      writeFileSync(join(options.out, candidat.nomCible), JSON.stringify(candidat.prise));
      ecrire(`✓ ${candidat.nom} → ${join(options.out, candidat.nomCible)}\n`);
    }
  }
  for (const raison of refus) ecrire(`✗ ${raison}\n`);
  const echecMesure = mesurerCote(candidats);
  conclure(candidats, refus);
  return refus.length > 0 || echecMesure > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (erreur) => {
      process.stderr.write(`échec : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`);
      process.exit(2);
    },
  );
}
