#!/usr/bin/env node
/**
 * Audit du dépôt — un rapport de consolidation, pas un jugement.
 *
 * Le script lit le dépôt, écrit `out/audit.json` et réécrit la section
 * générée de `docs/audit-depot.md` (entre deux marqueurs : ce qui est écrit
 * autour est conservé). Il sort toujours 0 : c'est un rapport, pas un
 * garde-fou. Ce qu'il ne sait pas faire est écrit dans les points durs.
 *
 * Usage :
 *   node scripts/audit-depot.mjs [racine] [--json <chemin>] [--md <chemin>]
 *                               [--sans-github]
 *
 * Aucun son, aucun périphérique, aucune requête réseau : la seule sortie
 * possible est l'appel à l'API GitHub, et seulement si `gh` est présent
 * (AIR-N-01, AIR-N-02).
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { creerResolveur, dependancesDeclarees, dependancesInutiles, exportsOrphelins, importsNonDeclares, paquetsImportes, paquetsInternes } from "./lib/audit/code.mjs";
import { documentsOrphelins, nombreDocuments } from "./lib/audit/documents.mjs";
import { doublons } from "./lib/audit/doublons.mjs";
import { lireGithub, nettoyer } from "./lib/audit/github.mjs";
import { EXTENSIONS_CODE, listerFichiers, lire } from "./lib/audit/lecture.mjs";
import { marqueursCode, todosRestants } from "./lib/audit/marqueurs.mjs";
import { rendreMarkdown, resume } from "./lib/audit/rapport.mjs";
import { fichiersTropLongs, fonctionsTropLonges } from "./lib/audit/taille.mjs";

/** La racine du dépôt, déduite de l'emplacement du script. */
const RACINE_DEFAUT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Les marqueurs du rapport : entre eux, tout est régénéré. */
const DEBUT = "<!-- audit:debut -->";
const FIN = "<!-- audit:fin -->";

/** Les options de la ligne de commande. */
function lireOptions(argv) {
  const options = { racine: null, json: null, md: null, github: true };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    if (argument === "--json") options.json = argv[++i] ?? null;
    else if (argument === "--md") options.md = argv[++i] ?? null;
    else if (argument === "--sans-github") options.github = false;
    else if (!argument.startsWith("--") && options.racine === null) options.racine = argument;
  }
  return options;
}

const options = lireOptions(process.argv.slice(2));
const racine = options.racine ? options.racine : RACINE_DEFAUT;
const cheminJson = options.json ?? join(racine, "out", "audit.json");
const cheminMd = options.md ?? join(racine, "docs", "audit-depot.md");
const pointsDurs = [];

/** Les fichiers du dépôt, avec leur contenu. */
const fichiers = await listerFichiers(racine);
const contenus = new Map();
for (const fichier of fichiers) {
  try {
    contenus.set(fichier.relatif, await lire(fichier));
  } catch {
    pointsDurs.push(`Lecture impossible : \`${fichier.relatif}\` a été ignoré.`);
  }
}
const contenusCode = new Map(
  [...contenus].filter(([relatif]) => EXTENSIONS_CODE.has(extensionDe(relatif))),
);

/** Les alias de modules déclarés par la configuration TypeScript. */
async function lireAlias(base) {
  try {
    const brut = await lireTexte(join(base, "tsconfig.base.json"));
    const config = JSON.parse(brut);
    return config?.compilerOptions?.paths ?? {};
  } catch {
    pointsDurs.push("Alias de modules illisibles : les imports internes sont résolus par le disque.");
    return {};
  }
}

/** Un fichier texte, ou une chaîne vide. */
async function lireTexte(chemin) {
  try {
    return await readFile(chemin, "utf8");
  } catch {
    return "";
  }
}

/** L'extension d'un chemin relatif. */
function extensionDe(chemin) {
  const base = chemin.slice(chemin.lastIndexOf("/") + 1);
  const point = base.lastIndexOf(".");
  return point < 0 ? "" : base.slice(point).toLowerCase();
}

const alias = await lireAlias(racine);
const resolveur = creerResolveur(racine, fichiers, alias, contenus);

/** Les manifestes du dépôt : racine, paquets et applications. */
async function lireManifestes(base) {
  const cibles = ["package.json"];
  for (const dossier of ["packages", "apps"]) {
    let entrees = [];
    try {
      entrees = await readdir(join(base, dossier), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entree of entrees) {
      if (entree.isDirectory()) cibles.push(`${dossier}/${entree.name}/package.json`);
    }
  }
  const manifestes = [];
  for (const cible of cibles) {
    const brut = await lireTexte(join(base, cible));
    if (!brut) continue;
    try {
      manifestes.push({ fichier: cible, contenu: JSON.parse(brut) });
    } catch {
      pointsDurs.push(`Manifeste illisible : \`${cible}\` a été ignoré.`);
    }
  }
  return manifestes;
}

/**
 * Le texte des commandes du dépôt : les scripts npm et les commandes de la
 * CI. Seul le bloc `scripts` du manifeste est lu : les dépendances y sont
 * aussi écrites, et une dépendance ne s'utilise pas en se déclarant.
 */
async function texteCommandes(base) {
  const morceaux = [];
  const brut = await lireTexte(join(base, "package.json"));
  if (brut) {
    try {
      const manifeste = JSON.parse(brut);
      morceaux.push(JSON.stringify(manifeste.scripts ?? {}));
    } catch {
      pointsDurs.push("Manifeste racine illisible : les outils lancés en ligne de commande peuvent paraître inutilisés.");
    }
  }
  try {
    for (const nom of await readdir(join(base, ".github", "workflows"))) {
      if (!nom.endsWith(".yml") && !nom.endsWith(".yaml")) continue;
      morceaux.push(await lireTexte(join(base, ".github", "workflows", nom)));
    }
  } catch {
    pointsDurs.push("Commandes de la CI illisibles : les outils lancés en ligne de commande peuvent paraître inutilisés.");
  }
  return morceaux.join("\n");
}

const manifestes = await lireManifestes(racine);
const declarees = dependancesDeclarees(manifestes);
const utilises = paquetsImportes(contenusCode);
const internes = paquetsInternes(contenusCode);
const textes = [await texteCommandes(racine), ...contenusCode.values()];
const rapport = {
  genereLe: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  racine,
  fichiersTropLongs: fichiersTropLongs(contenusCode),
  fonctionsTropLonges: fonctionsTropLonges(contenusCode),
  todos: todosRestants(contenusCode),
  exportsOrphelins: exportsOrphelins(fichiers, contenusCode, resolveur, manifestes),
  dependancesInutiles: dependancesInutiles(declarees, utilises, internes, textes),
  importsNonDeclares: importsNonDeclares(utilises, declarees),
  documentsOrphelins: documentsOrphelins(fichiers, contenus, exclusDuRapport(racine, cheminMd)),
  marqueurs: marqueursCode(contenusCode, exclusDuAudit(fichiers)),
  doublons: doublons(fichiers, contenus),
  github: options.github ? lireGithub(racine) : { disponible: false, raison: "désactivé (--sans-github)" },
  pointsDurs: [...pointsDurs, ...limitesDuRapport(nombreDocuments(fichiers))],
};

/** L'audit ne se compte pas lui-même : ses propres fichiers sont exclus. */
function exclusDuAudit(fichiers) {
  return fichiers
    .filter((fichier) => fichier.relatif === "scripts/audit-depot.mjs" || fichier.relatif.startsWith("scripts/lib/audit/") || fichier.relatif === "scripts/audit-depot.test.ts")
    .map((fichier) => fichier.relatif);
}

/** Le rapport lui-même : il ne peut pas être orphelin. */
function exclusDuRapport(base, chemin) {
  const relatif = relative(base, chemin).split("\\").join("/");
  return relatif.startsWith("..") ? [] : [relatif];
}

/** Ce que le rapport ne sait pas faire, écrit noir sur blanc. */
function limitesDuRapport(documents) {
  return [
    "Le découpage des fonctions est une heuristique de lecture des accolades : un signalement est une piste, pas une preuve.",
    `Les documents orphelins sont comptés parmi ${documents} documents du dépôt ; un document peut être lu sans être cité.`,
    "Un fichier exporté jamais importé peut être lu par une garde, un script ou un document.",
    "Une dépendance déclarée jamais importée peut être lancée en ligne de commande ou servir à l'outillage.",
  ];
}

/** Le rapport est écrit : JSON pour les machines, Markdown pour les gens. */
await mkdir(dirname(cheminJson), { recursive: true });
await writeFile(cheminJson, `${JSON.stringify(rapport, null, 2)}\n`, "utf8");
await ecrireMarkdown(cheminMd, rendreMarkdown(rapport));

/** Écrit le Markdown en gardant ce qui entoure les marqueurs. */
async function ecrireMarkdown(chemin, corps) {
  const existant = await lireTexte(chemin);
  const debut = existant.indexOf(DEBUT);
  const fin = existant.indexOf(FIN);
  let avant = "";
  let apres = "";
  if (debut >= 0 && fin > debut) {
    avant = existant.slice(0, debut);
    apres = existant.slice(fin + FIN.length);
  } else if (existant.trim() === "") {
    avant = "# Audit du dépôt\n\n";
  }
  await mkdir(dirname(chemin), { recursive: true });
  // La coupe finale : le fichier doit se terminer par un saut de ligne, sinon
  // la garde de formatage le refuse (`.editorconfig`, `insert_final_newline`).
  const texte = `${avant}${DEBUT}\n${corps}${FIN}${apres}`;
  await writeFile(chemin, texte.endsWith("\n") ? texte : `${texte}\n`, "utf8");
}

const chiffres = resume(rapport).map(([mesure, valeur]) => `${mesure} : ${valeur}`).join(" · ");
process.stdout.write(`${nettoyer(chiffres)}\n`);
process.stdout.write(`rapport écrit : ${cheminJson} et ${cheminMd}\n`);
process.exit(0);
