/**
 * Les fichiers d'exécution (wasm) du paquet MediaPipe : ce que le paquet
 * livre, ce que le site demande, ce qui doit être publié, et la preuve que
 * le repli processeur est garanti.
 *
 * UNE seule implémentation, partagée par `scripts/fetch-model.mjs` (ce qui est
 * copié dans `public/models/wasm/`) et `scripts/check-wasm.mjs` (ce qui est
 * publié dans `apps/web/dist/models/wasm/`) : la règle du dépôt l'exige, et
 * surtout la preuve ne peut pas diverger entre ce qui est copié et ce qui est
 * contrôlé.
 *
 * La règle de nommage n'est PAS recopiée ici : elle est LUE dans le paquet
 * installé, qui reste la source de vérité. Le contrôle s'appuie donc sur le
 * code du paquet lui-même (recherche ciblée, jamais de vidage de bundle).
 *
 * Aucune requête réseau, aucun son : ce module ne lit que des fichiers.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

/** Les fichiers du paquet qui décrivent le fileset (le premier qui parle gagne). */
export const BUNDLES = ["vision_bundle.mjs", "vision_bundle.js", "vision_bundle.cjs"];

/** Les extensions d'une variante : le chargeur (`.js`) et le moteur (`.wasm`). */
export const EXTENSIONS = [".js", ".wasm"];

/** Les dossiers de code parcourus pour trouver les appels du site. */
export const RACINES_SOURCES = ["packages", "apps", "public"];

/** Ce qui n'est jamais du code du site. */
const IGNORES = new Set(["node_modules", "dist", "out", ".git", "coverage"]);

/**
 * La règle de nommage du paquet, lue dans son bundle : le suffixe des
 * fichiers dépend d'un seul indicateur (`useWasmModule`), jamais du délégué
 * (processeur graphique ou processeur). Rendue nulle si la règle n'est pas
 * trouvée : le contrôle doit alors échouer plutôt que supposer.
 */
export function regleDeNommage(texte) {
  const trouve =
    /(\w+)\$\{\w+\?("[^"]*"|'[^']*'):("[^"]*"|'[^']*')\}(_\w+)/.exec(texte);
  if (trouve === null) return null;
  const sansGuillemets = (mot) => mot.slice(1, -1);
  return {
    tete: trouve[1],
    suffixeModule: sansGuillemets(trouve[2]),
    suffixeSimple: sansGuillemets(trouve[3]),
    suffixeFinal: trouve[4],
    extrait: trouve[0],
  };
}

/** La valeur par défaut de `useWasmModule` dans `forVisionTasks` (false = non-module). */
export function defautUseWasmModule(texte) {
  const trouve =
    /forVisionTasks\s*=\s*function\s*\(\s*\w+\s*,\s*\w+\s*=\s*(!1|!0|true|false)\s*\)/.exec(texte);
  if (trouve === null) return null;
  return trouve[1] === "!1" || trouve[1] === "false" ? false : true;
}

/** Le préfixe des fichiers d'exécution pour la famille de tâches demandée. */
export function prefixeTasks(texte) {
  const trouve =
    /forVisionTasks\s*=\s*function\s*\([^)]*\)\s*\{\s*return\s+\w+\(\s*"([a-z0-9_]+)"/.exec(texte);
  return trouve === null ? null : trouve[1];
}

/** Le nom d'une variante : `vision_wasm_internal` ou `vision_wasm_module_internal`. */
export function nomVariante(prefixe, regle, useWasmModule) {
  const suffixe = useWasmModule ? regle.suffixeModule : regle.suffixeSimple;
  return `${prefixe}_${regle.tete}${suffixe}${regle.suffixeFinal}`;
}

/** Les fichiers d'une variante : le chargeur et le moteur. */
export function fichiersDeVariante(nom) {
  return EXTENSIONS.map((extension) => `${nom}${extension}`);
}

/**
 * Les variantes que le site va demander : celle par défaut (le second
 * argument absent ou faux) et, si un appel demande la variante module,
 * celle-ci aussi. Un appel dont l'indicateur est une expression impose les
 * deux : le contrôle ne devine pas.
 */
export function variantesDemandees(appels, prefixe, regle, defautModule) {
  const demandees = new Set();
  demandees.add(nomVariante(prefixe, regle, defautModule));
  let expression = false;
  for (const appel of appels) {
    if (appel.expression) {
      expression = true;
      continue;
    }
    if (appel.passeModule) demandees.add(nomVariante(prefixe, regle, true));
  }
  if (expression) {
    demandees.add(nomVariante(prefixe, regle, true));
    demandees.add(nomVariante(prefixe, regle, false));
  }
  return { noms: [...demandees], expression };
}

/** Les fichiers d'exécution que le site va demander, tous formats confondus. */
export function fichiersDemandes(appels, prefixe, regle, defautModule) {
  const { noms } = variantesDemandees(appels, prefixe, regle, defautModule);
  return noms.flatMap((nom) => fichiersDeVariante(nom));
}

/**
 * La fenêtre de code autour de la règle de nommage : elle prouve que le nom
 * des fichiers ne dépend ni du délégué, ni d'un second chemin. Elle est
 * Targeted ( quelques centaines de caractères), jamais le bundle entier.
 */
export function fenetreDeRegle(texte, extrait) {
  const position = texte.indexOf(extrait);
  if (position < 0) return "";
  return texte.slice(Math.max(0, position - 200), position + extrait.length + 200);
}

/** Les fichiers d'exécution livrés par le paquet installé. */
export async function fichiersDuPaquet(dossierPaquet) {
  try {
    const entrees = await readdir(join(dossierPaquet, "wasm"), { withFileTypes: true });
    return entrees
      .filter((entree) => entree.isFile())
      .map((entree) => entree.name)
      .sort();
  } catch {
    return [];
  }
}

/** Le bundle du paquet qui décrit le fileset, et son texte. */
export async function lireBundle(dossierPaquet) {
  for (const nom of BUNDLES) {
    try {
      const texte = await readFile(join(dossierPaquet, nom), "utf8");
      if (texte.includes("forVisionTasks")) return { nom, texte };
    } catch {
      /* fichier absent : on essaie le suivant */
    }
  }
  return null;
}

/**
 * L'analyse complète du paquet : ce qu'il livre, la règle de nommage, et les
 * faits qui prouvent que le délégué ne change pas les fichiers demandés.
 */
export async function analyserPaquet(dossierPaquet) {
  const fichiers = await fichiersDuPaquet(dossierPaquet);
  const bundle = await lireBundle(dossierPaquet);
  if (bundle === null) return { fichiers, bundle: null, regle: null, prefixe: null };
  const regle = regleDeNommage(bundle.texte);
  const prefixe = prefixeTasks(bundle.texte);
  const defautModule = defautUseWasmModule(bundle.texte);
  const fenetre = regle === null ? "" : fenetreDeRegle(bundle.texte, regle.extrait);
  return {
    fichiers,
    bundle: bundle.nom,
    regle,
    prefixe,
    defautModule,
    fenetre,
    delegateDansLaRegle: /GPU|CPU|delegate/i.test(fenetre),
    occurrencesBinary: (bundle.texte.match(/wasmBinaryPath/g) ?? []).length,
    brancheDelegate: /"GPU"\s*===[^;]{0,40}delegate/.test(bundle.texte),
  };
}

/** Les fichiers de code du site, sous les racines données (racine du dépôt). */
export async function fichiersDeCode(dossierSources) {
  const trouves = [];
  const parcourir = async (dossier) => {
    let entrees;
    try {
      entrees = await readdir(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      if (IGNORES.has(entree.name)) continue;
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) await parcourir(chemin);
      else if (/\.(ts|tsx|mjs|js)$/.test(entree.name)) trouves.push(chemin);
    }
  };
  for (const racine of RACINES_SOURCES) await parcourir(join(dossierSources, racine));
  return trouves.sort();
}

/** Les arguments d'un appel `forVisionTasks(...)`, tillés au niveau supérieur. */
function argumentsDeLappel(source, position) {
  const debut = source.indexOf("(", position);
  if (debut < 0) return { arguments: [], fin: -1 };
  const arguments_ = [];
  let courant = "";
  let profondeur = 1; // la parenthèse de l'appel est déjà ouverte
  let guillemet = "";
  for (let i = debut + 1; i < source.length && i < debut + 400; i += 1) {
    const caractere = source[i];
    if (guillemet !== "") {
      courant += caractere;
      if (caractere === guillemet) guillemet = "";
      continue;
    }
    if (caractere === '"' || caractere === "'" || caractere === "`") {
      guillemet = caractere;
      courant += caractere;
      continue;
    }
    if ("([{".includes(caractere)) profondeur += 1;
    if (")]}".includes(caractere)) {
      profondeur -= 1;
      if (profondeur === 0) {
        arguments_.push(courant.trim());
        return { arguments: arguments_, fin: i };
      }
    }
    if (caractere === "," && profondeur === 1) {
      arguments_.push(courant.trim());
      courant = "";
      continue;
    }
    courant += caractere;
  }
  return { arguments: arguments_, fin: -1 };
}

/**
 * Les appels du site à `forVisionTasks` : le fichier, la ligne, et le second
 * argument — le seul qui compte. `forVisionTasks(racine)` prend la variante
 * non-module (le défaut du paquet) ; `forVisionTasks(racine, true)` prend la
 * variante module. Le délégué n'y figure jamais : il est choisi plus tard,
 * dans `createFromOptions`, une fois le fileset résolu.
 */
export async function appelsForVisionTasks(dossierSources) {
  const appels = [];
  for (const chemin of await fichiersDeCode(dossierSources)) {
    const source = await readFile(chemin, "utf8");
    const motif = /forVisionTasks\s*\(/g;
    let trouve;
    while ((trouve = motif.exec(source)) !== null) {
      const { arguments: args, fin } = argumentsDeLappel(source, trouve.index);
      if (fin < 0) continue;
      // Une déclaration de type (`forVisionTasks(path: string): Promise<…>`)
      // n'est pas un appel : ce qui suit la parenthèse est un `:`, pas un `;`.
      if (/^\s*:/.test(source.slice(fin + 1, fin + 4))) continue;
      const ligne = source.slice(0, trouve.index).split("\n").length;
      appels.push({
        fichier: relative(dossierSources, chemin),
        ligne,
        chemin: args[0] ?? "",
        indicateur: args[1] ?? "",
        passeModule: /^\s*true\s*$/i.test(args[1] ?? ""),
        expression: args.length > 1 && !/^\s*(true|false)\s*$/i.test(args[1] ?? ""),
      });
    }
  }
  return appels;
}

/** Les fichiers d'exécution que le service worker demande (et précharge). */
export async function referencesDuWorker(dossierSources) {
  const chemin = join(dossierSources, "public", "sw.js");
  try {
    const texte = await readFile(chemin, "utf8");
    return [...texte.matchAll(/models\/wasm\/([\w.-]+)/g)].map((trouve) => trouve[1]);
  } catch {
    return [];
  }
}

/** Ce que contient le dossier publié, et ce qui manque pour la publication. */
export async function verifierPublication(dossierPublie, requis) {
  let presents = [];
  try {
    presents = (await readdir(dossierPublie, { withFileTypes: true }))
      .filter((entree) => entree.isFile())
      .map((entree) => entree.name)
      .sort();
  } catch {
    presents = [];
  }
  return {
    presents,
    manquants: requis.filter((nom) => !presents.includes(nom)),
    autres: presents.filter((nom) => !requis.includes(nom)),
  };
}
