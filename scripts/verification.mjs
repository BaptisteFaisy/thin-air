#!/usr/bin/env node
/**
 * Le registre des preuves, rafraîchi automatiquement (cahier §18).
 *
 * Une étape sans preuve n'est pas faite : `docs/preuves.json` liste ce qui doit
 * rester vrai, chaque entrée se rejoue par sa commande, et le résultat écrit
 * ici est ce que le site affiche (route `?preuves=1`).
 *
 * Ce script ne dépend de rien : Node pur, bibliothèque standard seulement.
 *
 *   node scripts/verification.mjs [--filtre <motif>] [--liste]
 *
 * Règles tenues par le runner, pas seulement par les commandes :
 *   - chaque commande s'exécute avec un dossier temporaire pour ses fichiers
 *     intermédiaires (`TMPDIR`), et son dossier de travail est la racine du
 *     dépôt (les commandes y sont écrites en chemins relatifs) ;
 *   - après chaque commande, l'état de Git est comparé : une commande qui
 *     écrit dans le dépôt (hors `out/`, ignoré) fait échouer la preuve ;
 *   - aucune commande ne produit de son : tout passe par des fichiers ou des
 *     journaux de tests ;
 *   - le code de sortie 1 si une seule preuve échoue.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, stat, writeFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const MANIFESTE = join(RACINE, "docs", "preuves.json");
const RESULTAT = join(RACINE, "docs", "preuves-resultat.json");
const REGISTRE = join(RACINE, "docs", "preuves.md");
/** Les deux marqueurs du tableau rafraîchissable de docs/preuves.md. */
const MARQUEUR_DEBUT = "<!-- TABLEAU-PREUVES -->";
const MARQUEUR_FIN = "<!-- /TABLEAU-PREUVES -->";
/** Combien de lignes de sortie on garde : les dernières utiles. */
const LIGNES_EXTRAIT = 12;
/** Au-delà de ce délai, la commande est arrêtée et la preuve échoue. */
const DELAI_MAX_MS = 300_000;

/** Les options de la ligne de commande. */
function options(argv) {
  const opts = { filtre: null, liste: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--filtre") opts.filtre = argv[i + 1] ?? "";
    else if (argv[i] === "--liste") opts.liste = true;
  }
  return opts;
}

/** L'empreinte du dépôt : les fichiers écrits, avec leur taille et leur date. */
async function empreinteDepot() {
  const empreinte = new Map();
  const parcourir = async (dossier, prefixe) => {
    let entrees;
    try {
      entrees = await readdir(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      if (IGNORES.has(entree.name)) continue;
      const chemin = join(dossier, entree.name);
      const relatif = prefixe === "" ? entree.name : `${prefixe}/${entree.name}`;
      if (entree.isDirectory()) await parcourir(chemin, relatif);
      else if (entree.isFile()) {
        const info = await stat(chemin);
        empreinte.set(relatif, `${info.size}:${info.mtimeMs}`);
      }
    }
  };
  await parcourir(RACINE, "");
  return empreinte;
}

/** Les fichiers que le dépôt ne garde pas : ils ne comptent pas comme écrit. */
const IGNORES = new Set([".git", "node_modules", "out", "dist", "coverage", "bench-out", ".kiro"]);

/** Exécute une commande et rend son code, sa sortie et sa durée. */
function executer(commande, cwd, env) {
  return new Promise((resoudre) => {
    const debut = Date.now();
    const enfant = spawn("/bin/sh", ["-c", commande], { cwd, env });
    let sortie = "";
    const capturer = (bloc) => { sortie += bloc.toString(); };
    enfant.stdout.on("data", capturer);
    enfant.stderr.on("data", capturer);
    const garde = setTimeout(() => {
      sortie += `\n[verification] délai dépassé (${DELAI_MAX_MS} ms), commande arrêtée\n`;
      enfant.kill("SIGKILL");
    }, DELAI_MAX_MS);
    enfant.on("error", (raison) => {
      clearTimeout(garde);
      resoudre({ code: 127, sortie: `${sortie}\n[verification] ${raison.message}`, dureeMs: Date.now() - debut });
    });
    enfant.on("close", (code) => {
      clearTimeout(garde);
      resoudre({ code: code ?? 1, sortie, dureeMs: Date.now() - debut });
    });
  });
}

/** Les dernières lignes utiles d'une sortie : ni vides, ni bruit de npm. */
function extrait(sortie) {
  const lignes = sortie
    .split("\n")
    .map((ligne) => ligne.replace(/\s+$/, ""))
    .filter((ligne) => ligne.trim() !== "")
    .filter((ligne) => !/^npm (notice|warn)/.test(ligne))
    // Aucune adresse URL dans un extrait : il est compilé dans le site publié
    // et doit rester sans origine, même en texte (AIR-N-01). On garde l'hôte.
    .map((ligne) => ligne.replace(/https?:\/\/[^\s"'`]+/g, (adresse) => atténuer(adresse)));
  return lignes.slice(-LIGNES_EXTRAIT);
}

/** Une adresse réduite à son hôte, sans schéma : un fait, pas un lien. */
function atténuer(adresse) {
  const hote = adresse.match(/^https?:\/\/([^/]+)/)?.[1];
  return hote === undefined ? "[adresse]" : `[${hote}]`;
}

/** Les règles d'extraction d'un nombre notable, dans l'ordre. */
const MESURES = [
  /^mesure\s*:\s*([\d.,]+)/m,
  /total\s+publié\s*:\s*([\d.,]+)\s*Mo/im,
  /Tests\s+(\d+)\s+passed/i,
  /([\d]+(?:[.,]\d+)?)\s*(?:Mo|ko|KB|ms|%|octets|échantillons|fichiers)\b/i,
];

/** Le nombre notable de la sortie, s'il y en a un. */
function mesure(sortie) {
  for (const motif of MESURES) {
    motif.lastIndex = 0;
    const trouve = sortie.match(motif);
    if (trouve?.[1] === undefined) continue;
    const nombre = Number.parseFloat(trouve[1].replace(",", "."));
    if (Number.isFinite(nombre)) return nombre;
  }
  return null;
}

/**
 * Une commande de test qui ne fait rien ne prouve rien : Vitest sort 0 quand
 * le filtre `-t` ne sélectionne aucun test. On exige donc au moins un test
 * passé dès que la sortie parle de tests.
 */
function testSansPassage(sortie) {
  if (!/Test Files/.test(sortie)) return false;
  return !/\d+\s+passed/.test(sortie);
}

/** Une preuve : sa commande jouée, son verdict, ses mesures. */
async function jouer(preuve, env, index) {
  const temporaire = await mkdtemp(join(tmpdir(), "thin-air-preuve-"));
  const avant = await empreinteDepot();
  const environnement = { ...env, TMPDIR: temporaire, TEMP: temporaire, TMP: temporaire };
  let resultat;
  try {
    resultat = await executer(preuve.commande, RACINE, environnement);
  } finally {
    await rm(temporaire, { recursive: true, force: true });
  }
  const apres = await empreinteDepot();
  const touches = [...avant.keys()].filter((cle) => avant.get(cle) !== apres.get(cle))
    .concat([...apres.keys()].filter((cle) => !avant.has(cle)));
  const ecrit = touches.length > 0;
  const vide = testSansPassage(resultat.sortie);
  const code = ecrit || vide ? 1 : resultat.code;
  const sortie = ecrit
    ? `${resultat.sortie}\n[verification] la commande a écrit dans le dépôt (${touches.join(", ")}) : preuve invalidée`
    : vide
      ? `${resultat.sortie}\n[verification] aucun test n'a été exécuté : la preuve ne prouve rien`
      : resultat.sortie;
  const lignes = extrait(sortie);
  process.stdout.write(
    `${ecrit ? "✗" : code === 0 ? "✓" : "✗"} ${preuve.id} (${resultat.dureeMs} ms) ${preuve.titre}\n`,
  );
  if (code !== 0) for (const ligne of lignes.slice(-4)) process.stdout.write(`    ${ligne}\n`);
  return {
    id: preuve.id,
    titre: preuve.titre,
    commande: preuve.commande,
    attendu: preuve.attendu,
    fichier: preuve.fichier,
    ok: code === 0,
    code,
    dureeMs: resultat.dureeMs,
    date: new Date().toISOString(),
    extrait: lignes,
    mesure: mesure(sortie),
    ecritDansLeDepot: ecrit,
    ordre: index,
  };
}

/** Le manifeste : sa liste de preuves. */
function lireManifeste() {
  if (!existsSync(MANIFESTE)) {
    process.stderr.write(`manifeste introuvable : ${MANIFESTE}\n`);
    process.exit(2);
  }
  const brut = readFileSync(MANIFESTE, "utf8");
  const manifeste = JSON.parse(brut);
  if (!Array.isArray(manifeste.preuves) || manifeste.preuves.length === 0) {
    process.stderr.write("le manifeste ne contient aucune preuve\n");
    process.exit(2);
  }
  return manifeste;
}

/** La preuve demandée par le filtre, si le filtre est donné. */
function filtrer(preuves, filtre) {
  if (!filtre) return preuves;
  return preuves.filter((preuve) => preuve.id.includes(filtre) || preuve.titre.includes(filtre));
}

/** La ligne du registre lisible : une preuve, son état, sa date, sa commande. */
function ligneLisible(preuve) {
  const etat = preuve.ok ? "ok" : "ko";
  const duree = preuve.dureeMs < 1000
    ? `${preuve.dureeMs} ms`
    : `${(preuve.dureeMs / 1000).toFixed(1)} s`;
  const mesure = preuve.mesure === null ? "—" : String(preuve.mesure);
  return `| ${preuve.id} | ${preuve.titre} | ${etat} | ${mesure} | ${duree} | ${preuve.date.slice(0, 10)} | \`${preuve.commande}\` |`;
}

/** Le tableau du registre lisible : une ligne par preuve. */
function tableauLisible(resultats) {
  const entetes = [
    "| Preuve | Ce qu'elle dit | État | Mesure | Durée | Date | Rejouer |",
    "|---|---|---|---|---|---|---|",
  ];
  return [...entetes, ...resultats.map(ligneLisible)].join("\n");
}

/** Le registre lisible : seule la table est rafraîchie, le reste reste. */
async function ecrireRegistre(resultats) {
  let texte;
  try {
    texte = await readFile(REGISTRE, "utf8");
  } catch {
    return false;
  }
  const debut = texte.indexOf(MARQUEUR_DEBUT);
  const fin = texte.indexOf(MARQUEUR_FIN);
  if (debut < 0 || fin < 0 || fin < debut) return false;
  const nouveau = `${texte.slice(0, debut + MARQUEUR_DEBUT.length)}\n${tableauLisible(resultats)}\n${texte.slice(fin)}`;
  await writeFile(REGISTRE, nouveau, "utf8");
  return true;
}

/** Le fichier écrit : un résumé, puis chaque preuve avec son résultat. */
async function ecrireResultat(manifeste, resultats) {
  const ok = resultats.filter((r) => r.ok).length;
  const contenu = {
    version: 1,
    titre: manifeste.titre ?? "Registre des preuves — Thin Air",
    regle: manifeste.regle ?? "Une étape sans preuve n'est pas faite.",
    genereLe: new Date().toISOString(),
    total: resultats.length,
    ok,
    ko: resultats.length - ok,
    preuves: resultats.map(({ ordre, ...reste }) => reste),
  };
  await writeFile(RESULTAT, `${JSON.stringify(contenu, null, 2)}\n`, "utf8");
  await ecrireRegistre(resultats);
}

const opts = options(process.argv.slice(2));
const manifeste = lireManifeste();
const preuves = filtrer(manifeste.preuves, opts.filtre);

if (opts.liste) {
  for (const preuve of preuves) process.stdout.write(`${preuve.id} — ${preuve.titre}\n`);
  process.exit(0);
}

const resultats = [];
for (const [index, preuve] of preuves.entries()) {
  resultats.push(await jouer(preuve, process.env, index));
}

const ok = resultats.filter((r) => r.ok).length;
if (opts.filtre) {
  // Un filtre ne doit pas écraser le registre complet : le résultat filtré
  // est seulement affiché, le fichier du dépôt garde la dernière exécution
  // complète.
  process.stdout.write(`\n${ok}/${resultats.length} preuve(s) au vert (filtre « ${opts.filtre} » — registre non modifié)\n`);
  process.exit(ok === resultats.length ? 0 : 1);
}

await ecrireResultat(manifeste, resultats);
process.stdout.write(`\n${ok}/${resultats.length} preuve(s) au vert — résultat écrit dans docs/preuves-resultat.json\n`);
process.exit(ok === resultats.length ? 0 : 1);
