/**
 * La liste figée des fonctionnalités promises, confrontée au code.
 *
 * Une seule source de vérité : `docs/features.json`. Ce module sait
 * (1) lire cette liste et le cahier des charges, (2) découvrir ce que le code
 * livre réellement — les routes lues par l'application et les composants
 * d'écran montés — et (3) dire ce qui diverge, dans les deux sens :
 *
 *   - la liste vers le code : chaque fonctionnalité promise doit se voir
 *     dans le code (un composant exporté qui existe, une route réellement
 *     lue) et doivent avoir une preuve qui existe et qui la cite ;
 *   - le code vers la liste : chaque route lue et chaque composant livré
 *     doit être revendiqué par un écran de la liste.
 *
 * Règle du dépôt (docs/CONTRACT.md) : un fichier ne dépasse pas 500 lignes,
 * une fonction 50. Ici, chaque fonction fait moins de 50 lignes.
 *
 * Aucune requête réseau, aucun son : ce module ne lit que des fichiers.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/** Les dossiers du front, où vivent les écrans et les routes. */
const SOURCES_APP = ["apps/web/src"];

/** La section du cahier qui liste les exigences fonctionnelles. */
const SECTION_EXIGENCES = "## 9. Exigences fonctionnelles";

/** La section du cahier qui liste les parcours utilisateurs. */
const SECTION_PARCOURS = "## 8. Parcours utilisateurs";

/** Le chemin du cahier, relatif à la racine du dépôt. */
const CAHIER = "docs/cahier-des-charges.md";

/** Le chemin de la liste, relatif à la racine du dépôt. */
const LISTE = "docs/features.json";

/** Le chemin du document lisible, relatif à la racine du dépôt. */
const DOCUMENT = "docs/features.md";

/** Les états possibles d'une fonctionnalité. */
export const ETATS = ["livré", "à faire", "hors périmètre"];

/** Les types de preuve possibles. */
export const TYPES_PREUVE = ["test", "commande", "cahier"];

/** Lit un fichier texte ; renvoie `null` s'il n'existe pas. */
export function lireTexte(chemin) {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

/** Liste récursivement les fichiers d'un dossier, dans un ordre stable. */
export function parcourir(dossier) {
  const trouves = [];
  let entrees = [];
  try {
    entrees = readdirSync(dossier, { withFileTypes: true });
  } catch {
    return trouves;
  }
  for (const entree of entrees.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) trouves.push(...parcourir(chemin));
    else if (entree.isFile()) trouves.push(chemin);
  }
  return trouves;
}

/** Les fichiers du front qui ne sont pas des tests. */
function sourcesDuFront(racine) {
  const fichiers = [];
  for (const source of SOURCES_APP) {
    for (const chemin of parcourir(join(racine, source))) {
      if (!/\.(ts|tsx)$/.test(chemin)) continue;
      if (/\.test\.(ts|tsx)$/.test(chemin)) continue;
      fichiers.push(chemin);
    }
  }
  return fichiers;
}

/** Les symboles exportés par un fichier TypeScript. */
export function exportsDe(texte) {
  const symbols = new Set();
  for (const motif of [
    /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm,
    /^export\s+(?:const|let|var|class)\s+([A-Za-z0-9_]+)/gm,
  ]) {
    for (const trouve of texte.matchAll(motif)) symbols.add(trouve[1]);
  }
  for (const trouve of texte.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const morceau of trouve[1].split(",")) {
      const nom = morceau.trim().split(/\s+as\s+/).pop();
      if (nom !== undefined && nom !== "") symbols.add(nom.trim());
    }
  }
  return symbols;
}

/**
 * Les constantes qui portent le nom d'un paramètre d'adresse.
 *
 * `KIOSK_PARAM = "kiosk"` est un paramètre d'adresse ; `TOUCHE_SON = "p"` est
 * une touche du jeu. Sans cette distinction, la touche serait prise pour une
 * route et la couverture la réclamerait à tort.
 */
const NOM_PARAMETRE = /(?:^|_)(?:PARAM|ROUTE|URL|QUERY|OPTION)(?:_|$)/;

/** Les paramètres d'adresse réellement lus par l'application. */
export function decouvrirRoutes(racine) {
  const routes = new Map();
  /** Ajoute une route lue par un fichier, avec le fichier qui la lit. */
  const ajoute = (nom, origine) => {
    const liste = routes.get(nom) ?? [];
    liste.push(origine);
    routes.set(nom, liste);
  };
  for (const chemin of sourcesDuFront(racine)) {
    const texte = lireTexte(chemin) ?? "";
    const origine = relative(racine, chemin);
    // Un paramètre lu en clair : `parametres.get("lang")`.
    for (const trouve of texte.matchAll(/\.get\(\s*"([a-z][a-zA-Z0-9_-]*)"\s*\)/g)) {
      ajoute(trouve[1], origine);
    }
    // Un paramètre porté par une constante : `KIOSK_PARAM = "kiosk"`.
    for (const trouve of texte.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*"([a-z][a-zA-Z0-9_-]*)"/g)) {
      if (!NOM_PARAMETRE.test(trouve[1])) continue;
      ajoute(trouve[2], origine);
    }
  }
  return routes;
}

/** Les composants livrés par le front : fonctions exportées d'un fichier `.tsx`. */
export function decouvrirComposants(racine, exceptions) {
  const livres = [];
  for (const chemin of sourcesDuFront(racine)) {
    if (!/\.tsx$/.test(chemin)) continue;
    const origine = relative(racine, chemin);
    if (exceptions.includes(origine)) continue;
    const texte = lireTexte(chemin) ?? "";
    for (const motif of [
      /^export\s+(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)/gm,
      /^export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*[:=][^=\n]*=>/gm,
    ]) {
      for (const trouve of texte.matchAll(motif)) livres.push(`${origine}#${trouve[1]}`);
    }
  }
  return livres;
}

/** La section du cahier demandée, texte compris. */
function sectionDuCahier(texte, titre) {
  const debut = texte.indexOf(titre);
  if (debut < 0) return "";
  const suite = texte.indexOf("\n## ", debut + titre.length);
  return texte.slice(debut, suite < 0 ? undefined : suite);
}

/** Les exigences fonctionnelles du cahier : identifiant, priorité, titre. */
export function lireExigences(racine) {
  const texte = lireTexte(join(racine, CAHIER)) ?? "";
  const section = sectionDuCahier(texte, SECTION_EXIGENCES);
  const exigences = new Map();
  for (const trouve of section.matchAll(/^- \*\*AIR-F-(\d{2}) \(([ISOX])\) — ([^*]+)\*\*/gm)) {
    exigences.set(`AIR-F-${trouve[1]}`, { priorite: trouve[2], titre: trouve[3].trim() });
  }
  return exigences;
}

/** Les parcours utilisateurs du cahier : P1 à P11. */
export function lireParcours(racine) {
  const texte = lireTexte(join(racine, CAHIER)) ?? "";
  const section = sectionDuCahier(texte, SECTION_PARCOURS);
  const parcours = new Set();
  for (const trouve of section.matchAll(/\bP(\d{1,2})\b/g)) parcours.add(`P${trouve[1]}`);
  return parcours;
}

/** Le nom de la page d'un écran de la liste. */
function nomEcran(ecrans, identifiant) {
  const ecran = ecrans.find((entree) => entree.id === identifiant);
  return ecran === undefined ? identifiant : ecran.nom;
}

/** Les ancres d'une surface, sous la forme `fichier#symbole` ou `?route`. */
function ancresDe(ecran) {
  return (ecran.ancres ?? []).map((ancre) =>
    typeof ancre.route === "string" ? `?${ancre.route.replace(/^\?/, "").split("=")[0]}` : `${ancre.fichier}#${ancre.symbole}`,
  );
}

/** Vérifie qu'une ancre de composant se résout : le fichier existe, le symbole est exporté. */
function ancreResolue(racine, ancre) {
  if (ancre.startsWith("?")) return null;
  const [fichier, symbole] = ancre.split("#");
  if (symbole === undefined) return `l'ancre « ${ancre} » n'a pas de symbole`;
  const texte = lireTexte(join(racine, fichier));
  if (texte === null) return `le fichier « ${fichier} » n'existe pas`;
  if (!exportsDe(texte).has(symbole)) return `« ${fichier} » n'exporte pas « ${symbole} »`;
  return null;
}

/** Contrôle la forme d'une fonctionnalité : champs, valeurs, unicité. */
function controlerFonctionnalite(fonctionnalite, index, contexte, problemes) {
  const ou = `${contexte}.fonctionnalites[${index}]`;
  if (typeof fonctionnalite.id !== "string" || fonctionnalite.id === "") {
    problemes.push(`${ou} : l'identifiant est vide`);
  }
  const nom = fonctionnalite.nom ?? {};
  for (const langue of ["fr", "en"]) {
    if (typeof nom[langue] !== "string" || nom[langue].trim() === "") {
      problemes.push(`${ou} : le nom ${langue} est vide`);
    }
  }
  if (!ETATS.includes(fonctionnalite.etat)) {
    problemes.push(`${ou} : l'état « ${fonctionnalite.etat} » n'est pas dans ${ETATS.join(", ")}`);
  }
  if (!contexte.exigences.has(fonctionnalite.exigence)) {
    problemes.push(`${ou} : l'exigence « ${fonctionnalite.exigence} » n'est pas dans le cahier §9`);
  }
  for (const parcours of fonctionnalite.parcours ?? []) {
    if (!contexte.parcours.has(parcours)) {
      problemes.push(`${ou} : le parcours « ${parcours} » n'est pas dans le cahier §8`);
    }
  }
  if ((fonctionnalite.parcours ?? []).length === 0) {
    problemes.push(`${ou} : aucun parcours du cahier §8`);
  }
}

/** Contrôle la preuve d'une fonctionnalité : le fichier existe et cite l'ancre. */
function controlerPreuve(fonctionnalite, racine, problemes) {
  const ou = `la fonctionnalité ${fonctionnalite.id}`;
  const preuve = fonctionnalite.preuve;
  if (preuve === undefined || preuve === null) {
    if (fonctionnalite.etat === "livré") problemes.push(`${ou} est livrée sans preuve`);
    return;
  }
  if (!TYPES_PREUVE.includes(preuve.type)) {
    problemes.push(`${ou} : le type de preuve « ${preuve.type} » n'est pas dans ${TYPES_PREUVE.join(", ")}`);
    return;
  }
  if (preuve.type === "cahier" && fonctionnalite.etat === "livré") {
    problemes.push(`${ou} est livrée mais sa preuve n'est qu'une ligne du cahier`);
  }
  const texte = lireTexte(join(racine, preuve.chemin ?? ""));
  if (texte === null) {
    problemes.push(`${ou} : la preuve « ${preuve.chemin} » n'existe pas`);
    return;
  }
  if (typeof preuve.ancre !== "string" || !texte.includes(preuve.ancre)) {
    problemes.push(`${ou} : la preuve « ${preuve.chemin} » ne cite pas « ${preuve.ancre} »`);
  }
}

/** Le tableau lisible de la liste, une ligne par fonctionnalité. */
function tableauMarkdown(donnees) {
  const lignes = ["| ID | Fonctionnalité | Nom (anglais) | Écran | Exigence | Parcours | État | Preuve |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const fonctionnalite of donnees.fonctionnalites) {
    const parcours = (fonctionnalite.parcours ?? []).join(", ");
    const preuve = fonctionnalite.preuve === undefined || fonctionnalite.preuve === null ? "—" : `\`${fonctionnalite.preuve.chemin}\``;
    lignes.push(
      `| ${fonctionnalite.id} | ${fonctionnalite.nom.fr} | ${fonctionnalite.nom.en} | ${nomEcran(donnees.ecrans, fonctionnalite.ecran)} | ${fonctionnalite.exigence} | ${parcours} | ${fonctionnalite.etat} | ${preuve} |`,
    );
  }
  return lignes.join("\n");
}

/** Le document lisible, dérivé de la liste : jamais écrit à la main. */
export function markdown(racine, donnees) {
  const livres = donnees.fonctionnalites.filter((f) => f.etat === "livré").length;
  const aFaire = donnees.fonctionnalites.filter((f) => f.etat === "à faire").length;
  const hors = donnees.fonctionnalites.filter((f) => f.etat === "hors périmètre").length;
  return [
    "# Les fonctionnalités promises",
    "",
    "Ce document est **dérivé** de `docs/features.json`, la source de vérité :",
    "`node scripts/check-features.mjs --markdown` le régénère, et le contrôle",
    "refuse le dépôt si le fichier dérive de la liste. Ne pas l'éditer à la main.",
    "",
    `> **${donnees.regle}**`,
    "",
    `La liste compte ${donnees.fonctionnalites.length} fonctionnalités : ${livres} livrées, ${aFaire} à faire, ${hors} hors périmètre.`,
    "Chaque ligne porte son exigence du cahier (§9), les parcours qu'elle sert (§8),",
    "l'écran où elle se voit, et la preuve qui la fait tenir.",
    "",
    "Les trois états : **livré** — la promesse tient dans le code et une preuve",
    "(test ou commande) la démontre ; **à faire** — le cahier l'exige mais rien",
    "ne la prouve encore dans le code (sa preuve est la ligne du cahier) ;",
    "**hors périmètre** — cette édition l'exclut d'office, elle n'est pas attendue",
    "dans le code.",
    "",
    tableauMarkdown(donnees),
    "",
    "## Les écrans",
    "",
    "| Écran | Ce qui le montre |",
    "| --- | --- |",
    ...donnees.ecrans.map((ecran) => `| ${ecran.nom} | ${ancresDe(ecran).map((ancre) => `\`${ancre}\``).join(", ")} |`),
    "",
    "## Comment vérifier",
    "",
    "```",
    "node scripts/check-features.mjs        # sort 1 et nomme le manque",
    "node scripts/check-features.mjs --markdown   # régénère docs/features.md",
    "```",
    "",
  ].join("\n");
}

/**
 * Contrôle la liste contre le code. Renvoie la liste des manques : vide
 * si tout concorde.
 */
/** Contrôle les écrans de la liste : identifiants uniques, ancres résolues. */
function controlerEcrans(racine, ecrans, routes, problemes) {
  const identifiants = new Set();
  for (const [index, ecran] of ecrans.entries()) {
    const ou = `ecrans[${index}]`;
    if (identifiants.has(ecran.id)) problemes.push(`${ou} : l'identifiant « ${ecran.id} » est en double`);
    identifiants.add(ecran.id);
    if ((ecran.ancres ?? []).length === 0) problemes.push(`${ou} (« ${ecran.id} ») n'a aucune ancre`);
    for (const ancre of ecran.ancres ?? []) {
      if (typeof ancre.route === "string") {
        const nom = ancre.route.replace(/^\?/, "").split("=")[0];
        if (!routes.has(nom)) problemes.push(`${ou} (« ${ecran.id} ») : la route « ?${nom} » n'est pas lue par l'application`);
        continue;
      }
      const probleme = ancreResolue(racine, `${ancre.fichier}#${ancre.symbole}`);
      if (probleme !== null) problemes.push(`${ou} (« ${ecran.id} ») : ${probleme}`);
    }
  }
  return identifiants;
}

/** Contrôle les fonctionnalités : unicité, écran connu, preuve. */
function controlerFonctionnalites(racine, fonctionnalites, contexte, ecransConnus, problemes) {
  const identifiants = new Set();
  const exigencesVues = new Set();
  for (const [index, fonctionnalite] of fonctionnalites.entries()) {
    controlerFonctionnalite(fonctionnalite, index, contexte, problemes);
    if (identifiants.has(fonctionnalite.id)) problemes.push(`l'identifiant « ${fonctionnalite.id} » est en double`);
    identifiants.add(fonctionnalite.id);
    if (exigencesVues.has(fonctionnalite.exigence)) {
      problemes.push(`l'exigence « ${fonctionnalite.exigence} » est portée par deux fonctionnalités`);
    }
    exigencesVues.add(fonctionnalite.exigence);
    if (!ecransConnus.has(fonctionnalite.ecran)) {
      problemes.push(`la fonctionnalité ${fonctionnalite.id} : l'écran « ${fonctionnalite.ecran} » n'est pas dans la liste`);
    }
    controlerPreuve(fonctionnalite, racine, problemes);
  }
  return exigencesVues;
}

/** Contrôle que le code livré est entièrement revendiqué par la liste. */
function controlerCouverture(racine, ecrans, fonctionnalites, vues, routes, exceptions, problemes) {
  const exceptes = new Set(exceptions);
  for (const composant of decouvrirComposants(racine, exceptions)) {
    if (!vues.has(composant)) problemes.push(`le composant livré « ${composant} » n'est dans aucun écran de la liste`);
  }
  for (const [route, origines] of routes) {
    if (vues.has(`?${route}`)) continue;
    // Une route lue par la seule coquille exceptée (App.tsx) n'ouvre aucune
    // surface propre : la coquille est exceptée précisément parce qu'elle
    // « branche les écrans, elle n'en montre aucun seule ». Une route portée
    // par une vraie source ne profite jamais de cette exemption.
    if (origines.every((origine) => exceptes.has(origine))) continue;
    problemes.push(`la route « ?${route} » lue par ${origines[0]} n'est dans aucun écran de la liste`);
  }
  for (const ecran of ecrans) {
    if (!fonctionnalites.some((f) => f.ecran === ecran.id)) {
      problemes.push(`l'écran « ${ecran.id} » n'est porté par aucune fonctionnalité`);
    }
  }
}

/**
 * Contrôle la liste contre le code. Renvoie la liste des manques : vide
 * si tout concorde.
 */
export function controler(racine, donnees, options = {}) {
  const problemes = [];
  const exigences = options.exigences ?? lireExigences(racine);
  const parcours = options.parcours ?? lireParcours(racine);
  const routes = options.routes ?? decouvrirRoutes(racine);
  const exceptions = (donnees.exceptions ?? []).map((exception) => exception.fichier);
  const contexte = { exigences, parcours };

  if (!Array.isArray(donnees.ecrans) || donnees.ecrans.length === 0) {
    problemes.push("la liste ne déclare aucun écran");
  }
  if (!Array.isArray(donnees.fonctionnalites) || donnees.fonctionnalites.length === 0) {
    problemes.push("la liste ne déclare aucune fonctionnalité");
  }

  const ecrans = donnees.ecrans ?? [];
  const fonctionnalites = donnees.fonctionnalites ?? [];
  const ecransConnus = controlerEcrans(racine, ecrans, routes, problemes);
  const exigencesVues = controlerFonctionnalites(racine, fonctionnalites, contexte, ecransConnus, problemes);
  for (const exigence of exigences.keys()) {
    if (!exigencesVues.has(exigence)) problemes.push(`l'exigence ${exigence} du cahier §9 n'est dans aucune fonctionnalité`);
  }
  const vues = new Set();
  for (const ecran of ecrans) for (const ancre of ancresDe(ecran)) vues.add(ancre);
  controlerCouverture(racine, ecrans, fonctionnalites, vues, routes, exceptions, problemes);
  problemes.push(...ecartDocument(racine, donnees));
  return problemes;
}

/** Le document lisible tel qu'il est sur le disque, ou `null` s'il manque. */
function documentSurDisque(racine) {
  return lireTexte(join(racine, CHEMIN_DOCUMENT));
}

/** L'écart entre le document lisible et ce que la liste dit aujourd'hui. */
function ecartDocument(racine, donnees) {
  const surDisque = documentSurDisque(racine);
  if (surDisque === null) return [`le document ${CHEMIN_DOCUMENT} est introuvable`];
  if (surDisque === markdown(racine, donnees)) return [];
  return [`le document ${CHEMIN_DOCUMENT} ne correspond plus à ${CHEMIN_LISTE} — le régénérer`];
}

/** La liste lue depuis le disque, ou `null` si elle est illisible. */
export function lireListe(racine, chemin = LISTE) {
  const texte = lireTexte(resolve(racine, chemin));
  if (texte === null) return null;
  try {
    return JSON.parse(texte);
  } catch {
    return null;
  }
}

/** Le chemin du document lisible. */
export const CHEMIN_DOCUMENT = DOCUMENT;

/** Le chemin de la liste. */
export const CHEMIN_LISTE = LISTE;

/** Le chemin du cahier. */
export const CHEMIN_CAHIER = CAHIER;
