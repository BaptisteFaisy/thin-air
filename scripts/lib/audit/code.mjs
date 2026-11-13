/**
 * (c) et (d) Le code : fichiers exportés mais jamais importés ailleurs, puis
 * dépendances déclarées et inutilisées et imports de paquets non déclarés.
 *
 * Rien n'est modifié : le module lit des manifestes et des sources, et rend
 * des listes de pistes. Un fichier exporté sans import est du code mort
 * *probable* : il peut être lu par un outil, une garde ou un document.
 */
import { builtinModules } from "node:module";
import { dirname, join } from "node:path";
import { globEnMotif, modulesImportes, nomPaquet, referencesSpeciales } from "./lecture.mjs";

/** Les dossiers où un fichier exporté peut devenir orphelin. */
const PERIMETRE_CODE = ["packages/", "apps/"];

/** Les modules internes du dépôt (`@thin-air/…`) : ce ne sont pas des paquets. */
const PREFIXE_INTERNE = "@thin-air/";

/** Les binaires des outils qui ne s'importent jamais mais se lancent. */
const BINAIRES = {
  typescript: ["tsc"],
  vitest: ["vitest"],
  vite: ["vite"],
  tsx: ["tsx"],
  "@playwright/test": ["playwright"],
};

/** Les fichiers jamais candidats : tests, points d'entrée, déclarations. */
function estCandidat(fichier) {
  if (!fichier.code) return false;
  if (!PERIMETRE_CODE.some((debut) => fichier.relatif.startsWith(debut))) return false;
  if (!fichier.relatif.includes("/src/")) return false;
  if (/\.test\.[cm]?[jt]sx?$/.test(fichier.relatif)) return false;
  if (/\.d\.ts$/.test(fichier.relatif)) return false;
  if (/(^|\/)index\.[cm]?[jt]sx?$/.test(fichier.relatif)) return false;
  return true;
}

/**
 * Les fichiers exportés mais jamais importés ailleurs. Un fichier est
 * « référencé » s'il est la cible d'un import, d'un ré-export, d'une URL,
 * d'un glob, d'un script HTML ou d'un manifeste du dépôt.
 */
export function exportsOrphelins(fichiers, contenus, resolveur, manifestes = []) {
  const references = new Set();
  for (const [fichier, texte] of contenus) {
    for (const module of modulesImportes(texte)) {
      const cible = resolveur.resoudre(module, fichier);
      if (cible) references.add(cible);
    }
    const speciales = referencesSpeciales(texte);
    for (const url of speciales.urls) {
      const cible = resolveur.resoudreCheminRelatif(url, fichier);
      if (cible) references.add(cible);
    }
    for (const glob of speciales.globs) {
      for (const cible of resolveur.resoudreGlob(glob, fichier)) references.add(cible);
    }
  }
  for (const cible of resolveur.scriptsHtml()) references.add(cible);
  for (const cible of referencesDepuisManifestes(manifestes, fichiers)) references.add(cible);
  const orphelins = [];
  for (const fichier of fichiers) {
    if (!estCandidat(fichier)) continue;
    if (references.has(fichier.relatif)) continue;
    orphelins.push({ fichier: fichier.relatif });
  }
  return orphelins.sort((a, b) => a.fichier.localeCompare(b.fichier));
}

/** Les fichiers désignés par un manifeste (bin, main, scripts d'un paquet). */
function referencesDepuisManifestes(manifestes, fichiers) {
  const cibles = new Set();
  for (const manifeste of manifestes) {
    const dossier = dirname(manifeste.fichier);
    const valeurs = chainesDuManifeste(manifeste.contenu);
    for (const fichier of fichiers) {
      const prefixe = dossier === "." ? "" : `${dossier}/`;
      if (!fichier.relatif.startsWith(prefixe)) continue;
      const relatif = fichier.relatif.slice(prefixe.length);
      if (valeurs.some((valeur) => designe(valeur, relatif))) cibles.add(fichier.relatif);
    }
  }
  return cibles;
}

/** Une valeur de manifeste désigne-t-elle ce fichier ? */
function designe(valeur, relatif) {
  const nette = valeur.replace(/^\.\//, "");
  return nette === relatif || nette.endsWith(`/${relatif}`) || nette.endsWith(` ${relatif}`);
}

/** Toutes les chaînes d'un manifeste, à toutes les profondeurs. */
function chainesDuManifeste(valeur) {
  if (typeof valeur === "string") return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(chainesDuManifeste);
  if (valeur && typeof valeur === "object") {
    return Object.values(valeur).flatMap(chainesDuManifeste);
  }
  return [];
}

/** Les dépendances déclarées dans un manifeste, avec le dossier qui les porte. */
export function dependancesDeclarees(manifestes) {
  const declarees = [];
  for (const manifeste of manifestes) {
    const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    for (const section of sections) {
      const bloc = manifeste.contenu[section];
      if (!bloc || typeof bloc !== "object") continue;
      for (const [nom, version] of Object.entries(bloc)) {
        declarees.push({ nom, version: String(version), manifeste: manifeste.fichier, section });
      }
    }
  }
  return declarees;
}

/** Les paquets réellement importés par le code du dépôt. */
export function paquetsImportes(contenus) {
  const utilises = new Map();
  for (const [fichier, texte] of contenus) {
    for (const module of modulesImportes(texte)) {
      if (module.startsWith(".") || module.startsWith(PREFIXE_INTERNE)) continue;
      const nom = nomPaquet(module);
      if (!nom || estModuleNode(nom)) continue;
      if (!utilises.has(nom)) utilises.set(nom, []);
      utilises.get(nom).push(fichier);
    }
  }
  return utilises;
}

/** Les paquets du dépôt importés par le code (`@thin-air/…`). */
export function paquetsInternes(contenus) {
  const utilises = new Set();
  for (const [, texte] of contenus) {
    for (const module of modulesImportes(texte)) {
      if (module.startsWith(PREFIXE_INTERNE)) utilises.add(nomPaquet(module));
    }
  }
  return utilises;
}

/**
 * Les dépendances déclarées et jamais utilisées. Un paquet du dépôt
 * (`@thin-air/…`) est utilisé s'il est importé ; les types ambient
 * (`@types/…`) sont laissés de côté : ils ne s'importent jamais.
 */
export function dependancesInutiles(declarees, utilises, internes, textes) {
  const inutiles = [];
  for (const dependance of declarees) {
    if (dependance.nom.startsWith(PREFIXE_INTERNE)) {
      if (internes.has(dependance.nom)) continue;
    } else if (utilises.has(dependance.nom)) {
      continue;
    }
    if (dependance.nom.startsWith("@types/")) continue;
    if (mentionneDans(dependance.nom, textes)) continue;
    inutiles.push(dependance);
  }
  return inutiles.sort((a, b) => a.nom.localeCompare(b.nom) || a.manifeste.localeCompare(b.manifeste));
}

/** Les paquets importés sans être déclarés dans un manifeste du dépôt. */
export function importsNonDeclares(utilises, declarees) {
  const declares = new Set(declarees.map((dependance) => dependance.nom));
  const nonDeclares = [];
  for (const [nom, fichiers] of utilises) {
    if (declares.has(nom)) continue;
    nonDeclares.push({ nom, fichiers: [...new Set(fichiers)].sort() });
  }
  return nonDeclares.sort((a, b) => a.nom.localeCompare(b.nom));
}

/** Un paquet est-il un module natif de Node ? */
function estModuleNode(nom) {
  if (nom.startsWith("node:")) return true;
  return builtinModules.includes(nom);
}

/** Le nom ou le binaire d'un paquet est-il cité dans les textes ? */
function mentionneDans(nom, textes) {
  const candidats = [nom, ...(BINAIRES[nom] ?? [])];
  return candidats.some((candidat) => {
    const echappe = candidat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const motif = new RegExp(`(?<![\\w@/.-])${echappe}(?![\\w@/-])`);
    return textes.some((texte) => motif.test(texte));
  });
}

/**
 * Un résolveur de modules : alias du dépôt (`@thin-air/…`), modules
 * relatifs et scripts HTML. Un module nu (un paquet) ne se résout pas.
 */
export function creerResolveur(racine, fichiers, alias, contenus = new Map()) {
  const parChemin = new Map(fichiers.map((fichier) => [fichier.relatif, fichier]));
  const extensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

  function resoudreChemin(base) {
    if (parChemin.has(base)) return base;
    for (const extension of extensions) {
      if (parChemin.has(base + extension)) return base + extension;
      if (parChemin.has(`${base}/index${extension}`)) return `${base}/index${extension}`;
    }
    // Le dépôt importe en `.js` (style NodeNext) : `.js` vaut `.ts`.
    const transcrit = base.replace(/\.jsx?$/, "").replace(/\.mjs$/, ".mts");
    if (transcrit !== base) return resoudreChemin(transcrit);
    return null;
  }

  function resoudreAlias(specificateur) {
    const candidates = Object.keys(alias).sort((a, b) => b.length - a.length);
    for (const cle of candidates) {
      const cible = Array.isArray(alias[cle]) ? alias[cle][0] : alias[cle];
      if (cle.endsWith("/*")) {
        const prefixe = cle.slice(0, -1);
        if (!specificateur.startsWith(prefixe)) continue;
        const reste = specificateur.slice(prefixe.length);
        const trouve = resoudreChemin(cible.replace("*", reste));
        if (trouve) return trouve;
      } else if (specificateur === cle) {
        const trouve = resoudreChemin(cible);
        if (trouve) return trouve;
      }
    }
    return null;
  }

  function resoudreInterne(specificateur) {
    const morceaux = specificateur.slice(PREFIXE_INTERNE.length).split("/");
    const nom = morceaux[0];
    const reste = morceaux.slice(1).join("/");
    for (const base of [`packages/${nom}/src`, `apps/${nom}/src`]) {
      const cible = reste ? `${base}/${reste}` : `${base}/index`;
      const trouve = resoudreChemin(cible);
      if (trouve) return trouve;
    }
    return null;
  }

  function resoudre(specificateur, depuis) {
    if (specificateur.startsWith(".")) {
      return resoudreCheminRelatif(specificateur, depuis);
    }
    if (specificateur.startsWith(PREFIXE_INTERNE)) {
      return resoudreAlias(specificateur) ?? resoudreInterne(specificateur);
    }
    return null;
  }

  /** Un chemin relatif au fichier qui le mentionne. */
  function resoudreCheminRelatif(specificateur, depuis) {
    const base = join(dirname(depuis), specificateur).split("\\").join("/");
    return resoudreChemin(base.replace(/^\.\//, "").replace(/^\//, ""));
  }

  /** Les fichiers désignés par un motif de glob, relatif au fichier. */
  function resoudreGlob(motif, depuis) {
    const base = join(dirname(depuis), motif).split("\\").join("/");
    const expression = globEnMotif(base.replace(/^\.\//, "").replace(/^\//, ""));
    return fichiers
      .map((fichier) => fichier.relatif)
      .filter((relatif) => expression.test(relatif));
  }

  function scriptsHtml() {
    const cibles = [];
    for (const fichier of fichiers) {
      if (fichier.extension !== ".html") continue;
      const texte = contenus.get(fichier.relatif);
      if (!texte) continue;
      for (const match of texte.matchAll(/<script[^>]*src="([^"]+)"/g)) {
        const source = match[1].replace(/^\//, "").split("?")[0];
        const trouve = resoudreCheminRelatif(source, fichier.relatif);
        if (trouve) cibles.push(trouve);
      }
    }
    return cibles;
  }

  return { resoudre, resoudreCheminRelatif, resoudreGlob, scriptsHtml, racine };
}
