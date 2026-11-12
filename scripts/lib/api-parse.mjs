/**
 * Analyse de la surface publique d'un paquet TypeScript, sans compilateur.
 *
 * Le module lit les `index.ts` de `packages/*`, suit les ré-exports
 * (`export *`, `export { … } from`), et rend pour chaque symbole exporté :
 * son genre (`function`, `const`, `interface`, `type`, `class`), le type écrit
 * dans la source, et la première ligne de sa documentation.
 *
 * C'est le seul endroit où la grammaire est comprise ; `scripts/check-api.mjs`
 * ne fait que comparer le résultat au contrat et parler à l'utilisateur.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/* ------------------------------------------------------------------ lexique */

/** Retire les commentaires, sans toucher au contenu des chaînes. */
function sansCommentaires(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const deux = src.slice(i, i + 2);
    if (deux === "//") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (deux === "/*") {
      i += 2;
      while (i < src.length && src.slice(i, i + 2) !== "*/") i += 1;
      i += 2;
      out += " ";
      continue;
    }
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const fin = finDeChaine(src, i);
      out += src.slice(i, fin);
      i = fin;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Index juste après la chaîne qui commence à `i`. */
function finDeChaine(src, i) {
  const guillemet = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === "\\") {
      j += 2;
      continue;
    }
    if (src[j] === guillemet) return j + 1;
    j += 1;
  }
  return src.length;
}

/** Repère la parenthèse (ou accolade) qui ferme celle de `i`. */
function equilibre(src, i, ouvrante, fermante) {
  let profondeur = 0;
  for (let j = i; j < src.length; j += 1) {
    const c = src[j];
    if (c === ouvrante) profondeur += 1;
    else if (c === fermante) {
      profondeur -= 1;
      if (profondeur === 0) return j + 1;
    }
  }
  return -1;
}

/** Texte compacté : les espaces multiples ne font pas partie d'un type. */
function normalise(texte) {
  return texte.replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------- lecture d'un export */

/** Lit le bloc `{ … }` qui suit `i` et rend son contenu. */
function lisCorps(src, i) {
  const fin = equilibre(src, i, "{", "}");
  if (fin < 0) return { corps: "", fin: src.length };
  return { corps: src.slice(i + 1, fin - 1), fin };
}

/** Les membres d'un corps de type ou de classe, normalisés. */
function lisMembres(corps) {
  const membres = [];
  let debut = 0;
  let profondeur = 0;
  let i = 0;
  while (i < corps.length) {
    const c = corps[i];
    if (c === "(" || c === "[") profondeur += 1;
    else if (c === ")" || c === "]") profondeur -= 1;
    else if (c === "{") {
      if (profondeur === 0 && estMethode(corps.slice(debut, i))) {
        membres.push(normalise(corps.slice(debut, i)));
        i = equilibre(corps, i, "{", "}") - 1;
        debut = i + 1;
      } else profondeur += 1;
    } else if (c === "}") profondeur -= 1;
    else if (c === ";" && profondeur === 0) {
      membres.push(normalise(corps.slice(debut, i)));
      debut = i + 1;
    }
    i += 1;
  }
  membres.push(normalise(corps.slice(debut)));
  return membres.filter((m) => m !== "" && !estPrive(m));
}

/** Un `{` suit-il une signature de méthode (des parenthèses avant) ? */
function estMethode(avant) {
  const i = avant.indexOf("(");
  if (i < 0) return false;
  return avant.indexOf(")", i) >= 0;
}

/** Un membre est-il hors de la surface publique ? */
function estPrive(membre) {
  return /^(private|protected)\b/.test(membre) || /(^|\s)#\w/.test(membre);
}

/** Le premier mot de la documentation d'un export, pour l'écarter. */
function lisDescription(src, i) {
  let j = i;
  while (j > 0 && /\s/.test(src[j - 1])) j -= 1;
  if (src.slice(j - 2, j) !== "*/") return "";
  const debut = src.lastIndexOf("/**", j - 2);
  if (debut < 0) return "";
  const bloc = src.slice(debut + 3, j - 2);
  for (const ligne of bloc.split("\n")) {
    const propre = normalise(ligne.replace(/^\s*\*\s?/, ""));
    if (propre !== "") return propre;
  }
  return "";
}

/* ------------------------------------------------- déclarations d'un fichier */

/** Lit une déclaration d'export ; rend `null` si ce n'en est pas une. */
function lisExport(src, i) {
  const suite = src.slice(i + 6);
  const t = suite.trimStart();
  const decalage = suite.length - t.length;
  if (t.startsWith("*")) {
    const m = /^\*\s*from\s*["']([^"']+)["']/.exec(t);
    return m ? { kind: "star", module: m[1], fin: i + 6 + decalage + m[0].length } : null;
  }
  if (/^type\s*\{/.test(t) || t.startsWith("{")) {
    const debutBloc = i + 6 + decalage + t.indexOf("{");
    const finBloc = equilibre(src, debutBloc, "{", "}");
    const bloc = src.slice(debutBloc + 1, finBloc - 1);
    const depuis = /\bfrom\s*["']([^"']+)["']/.exec(src.slice(finBloc, finBloc + 200));
    const noms = bloc
      .replace(/\bfrom\s*["'][^"']+["']/, "")
      .split(",")
      .map((n) => normalise(n.replace(/^type\s+/, "")))
      .filter((n) => n !== "");
    return { kind: "reexport", noms, module: depuis ? depuis[1] : null, fin: finBloc };
  }
  const m = /^\s*(?:declare\s+)?(?:async\s+)?(function|class|interface|type|const|let|var|enum)\s+([A-Za-z0-9_$]+)/.exec(t);
  if (!m) return null;
  const kind = m[1];
  const nom = m[2];
  const apres = i + 6 + decalage + m[0].length;
  const type = lisType(src, apres, kind, nom);
  return { kind, nom, type: type.type, fin: type.fin, description: lisDescription(src, i) };
}

/** Le type écrit d'une déclaration, et où elle finit. */
function lisType(src, i, kind, nom) {
  if (kind === "function") return lisSignature(src, i);
  if (kind === "class" || kind === "interface") return lisForme(src, i, kind, nom);
  if (kind === "type") return lisAlias(src, i, nom);
  return lisValeur(src, i);
}

/** Signature d'une fonction : `(paramètres): retour`. */
function lisSignature(src, i) {
  let j = i;
  while (j < src.length && /\s/.test(src[j])) j += 1;
  if (src[j] === "<") j = equilibreAngles(src, j);
  if (src[j] !== "(") return { type: "() : unknown", fin: j };
  const finParams = equilibre(src, j, "(", ")");
  const params = nettoieParams(src.slice(j + 1, finParams - 1));
  const retour = lisRetour(src, finParams);
  return { type: `(${params}) : ${retour.type}`, fin: retour.fin };
}


/** Coupe une liste de paramètres sur les virgules de premier niveau. */
function coupeVirgules(texte) {
  const morceaux = [];
  let profondeur = 0;
  let courant = "";
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (c === "=" && texte[i + 1] === ">") {
      courant += "=>";
      i += 2;
      continue;
    }
    if (c === "(" || c === "[" || c === "{" || c === "<") profondeur += 1;
    else if (c === ")" || c === "]" || c === "}" || c === ">") profondeur -= 1;
    if (c === "," && profondeur === 0) {
      morceaux.push(courant);
      courant = "";
      i += 1;
      continue;
    }
    courant += c;
    i += 1;
  }
  morceaux.push(courant);
  return morceaux;
}

/** Les paramètres sans valeurs par défaut ; un défaut rend le paramètre optionnel. */
function nettoieParams(texte) {
  return coupeVirgules(texte)
    .map((membre) => {
      const propre = normalise(membre);
      const i = egalDeDefaut(propre);
      if (i < 0) return propre;
      const tete = propre.slice(0, i).trimEnd();
      const nom = tete.split(":")[0].trim();
      const type = tete.includes(":") ? tete.slice(tete.indexOf(":") + 1) : "";
      return type === "" ? `${nom}?` : `${nom}?: ${type}`;
    })
    .filter((membre) => membre !== "")
    .join(", ");
}

/** L'index d'un `=` de valeur par défaut (pas un `=>`, pas un `==`). */
function egalDeDefaut(texte) {
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (c === "=" && texte[i + 1] !== ">" && texte[i + 1] !== "=") return i;
    if (c === "(" || c === "[" || c === "{") return -1;
  }
  return -1;
}

/** saute un bloc de génériques `<…>`. */
function equilibreAngles(src, i) {
  let profondeur = 0;
  for (let j = i; j < src.length; j += 1) {
    if (src[j] === "<") profondeur += 1;
    else if (src[j] === ">") {
      profondeur -= 1;
      if (profondeur === 0) return j + 1;
    }
  }
  return src.length;
}

/** Le type de retour d'une fonction, `unknown` s'il n'est pas écrit. */
function lisRetour(src, i) {
  let j = i;
  while (j < src.length && /\s/.test(src[j])) j += 1;
  if (src[j] !== ":") return { type: "unknown", fin: j };
  j += 1;
  while (j < src.length && /\s/.test(src[j])) j += 1;
  const debut = j;
  let profondeur = 0;
  while (j < src.length) {
    const c = src[j];
    if (c === "{" && profondeur === 0 && j > debut) break;
    if (c === "(" || c === "[" || c === "{") profondeur += 1;
    else if (c === ")" || c === "]" || c === "}") profondeur -= 1;
    else if (profondeur === 0 && c === ";") break;
    j += 1;
  }
  return { type: normalise(src.slice(debut, j)) || "unknown", fin: j };
}

/** La forme d'une classe ou d'une interface : nom et membres publics. */
function lisForme(src, i, kind, nom) {
  let j = i;
  while (j < src.length && src[j] !== "{") {
    if (src[j] === ";" || src[j] === "=") return { type: kind, fin: j };
    j += 1;
  }
  const { corps, fin } = lisCorps(src, j);
  const membres = lisMembres(corps);
  const tete = kind === "class" ? "class" : "interface";
  const corpsTexte = membres.length === 0 ? "" : ` { ${membres.join("; ")} }`;
  return { type: `${tete} ${nom}${corpsTexte}`, fin };
}

/** Un alias de type : `type X = …`. */
function lisAlias(src, i, nom) {
  let j = i;
  while (j < src.length && src[j] !== "=") j += 1;
  j += 1;
  const debut = j;
  let profondeur = 0;
  while (j < src.length) {
    const c = src[j];
    if (c === "(" || c === "[" || c === "{") profondeur += 1;
    else if (c === ")" || c === "]" || c === "}") profondeur -= 1;
    else if (profondeur === 0 && c === ";") break;
    j += 1;
  }
  const valeur = normalise(src.slice(debut, j)).replace(/^\|\s*/, "");
  return { type: `type ${nom} = ${valeur}`, fin: j };
}

/** Le type d'une constante : annotation, `satisfies`, ou valeur littérale. */
function lisValeur(src, i) {
  let j = i;
  let profondeur = 0;
  let deuxPoints = -1;
  let egal = -1;
  while (j < src.length) {
    const c = src[j];
    if (c === "(" || c === "[" || c === "{") profondeur += 1;
    else if (c === ")" || c === "]" || c === "}") profondeur -= 1;
    else if (profondeur === 0 && c === ":" && deuxPoints < 0) deuxPoints = j;
    else if (profondeur === 0 && c === "=" && src[j + 1] !== ">" && src[j + 1] !== "=") {
      egal = j;
      break;
    } else if (profondeur === 0 && c === ";") break;
    j += 1;
  }
  if (deuxPoints > 0 && egal > deuxPoints) {
    return { type: normalise(src.slice(deuxPoints + 1, egal)), fin: j };
  }
  if (egal < 0) return { type: "unknown", fin: j };
  const reste = src.slice(egal + 1);
  const satisfait = /\bsatisfies\s+([^;]+)/.exec(reste);
  if (satisfait) return { type: normalise(satisfait[1]), fin: j };
  const litteral = normalise(reste).replace(/\s+as\s+const.*$/, "");
  if (/^[-+]?\d/.test(litteral)) return { type: "number", fin: j };
  if (/^["'`]/.test(litteral)) return { type: "string", fin: j };
  if (/^(true|false)\b/.test(litteral)) return { type: "boolean", fin: j };
  return { type: "(inféré)", fin: j };
}

/* ------------------------------------------------- le graphe des ré-exports */

/** Un fichier du dépôt : ses déclarations, ses ré-exports, ses imports. */
function analyseFichier(fichier) {
  const src = sansCommentaires(readFileSync(fichier, "utf8"));
  const declarations = new Map();
  const etoiles = [];
  const nommes = [];
  const imports = new Map();
  let i = 0;
  let profondeur = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = finDeChaine(src, i);
      continue;
    }
    if (c === "{" || c === "(" || c === "[") profondeur += 1;
    else if (c === "}" || c === ")" || c === "]") profondeur -= 1;
    const mot = src.startsWith("export", i) ? "export" : src.startsWith("import", i) ? "import" : "";
    if (profondeur === 0 && mot !== "" && !/[\w$]/.test(src[i + mot.length] ?? "")) {
      const lu = mot === "export" ? lisExport(src, i) : lisImport(src, i);
      if (lu) {
        if (lu.kind === "star") etoiles.push(lu.module);
        else if (lu.kind === "reexport") nommes.push(lu);
        else if (lu.kind === "import") imports.set(lu.nom, lu.module);
        else declarations.set(lu.nom, { kind: lu.kind, type: lu.type, description: lu.description });
        i = Math.max(lu.fin, i + mot.length);
        continue;
      }
    }
    i += 1;
  }
  return { fichier, declarations, etoiles, nommes, imports };
}

/** Un import nommé : `{ a, b } from "./x.js"`. */
function lisImport(src, i) {
  const m = /^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/.exec(src.slice(i));
  if (!m) return null;
  const nom = normalise(m[1].replace(/^type\s+/, "").split(/\s+as\s+/)[0]);
  return { kind: "import", nom, module: m[2], fin: i + m[0].length };
}

/** Le fichier visé par un ré-export relatif (`.js` → `.ts`). */
function cibleDe(fichier, module) {
  if (!module || !module.startsWith(".")) return null;
  return join(dirname(fichier), module.replace(/\.js$/, ".ts"));
}

/** Tous les exports d'un fichier, ré-exports compris. */
function exportsDuFichier(fichier, cache, enCours = new Set()) {
  if (cache.has(fichier)) return cache.get(fichier);
  if (enCours.has(fichier)) return new Map();
  enCours.add(fichier);
  const analyse = analyseFichier(fichier);
  const sortie = new Map();
  for (const [nom, d] of analyse.declarations) sortie.set(nom, d);
  for (const module of analyse.etoiles) {
    const cible = cibleDe(fichier, module);
    if (!cible || !existsSync(cible)) continue;
    for (const [nom, d] of exportsDuFichier(cible, cache, enCours)) {
      if (!sortie.has(nom)) sortie.set(nom, d);
    }
  }
  for (const bloc of analyse.nommes) {
    for (const nom of bloc.noms) {
      const trouve = bloc.module
        ? chercherExport(cibleDe(fichier, bloc.module), nom, cache)
        : chercherLocal(analyse, nom, cache);
      if (trouve) sortie.set(nom, trouve);
    }
  }
  enCours.delete(fichier);
  cache.set(fichier, sortie);
  return sortie;
}

/** Un export nommé, cherché dans un autre fichier. */
function chercherExport(fichier, nom, cache) {
  if (!fichier || !existsSync(fichier)) return null;
  return exportsDuFichier(fichier, cache).get(nom) ?? null;
}

/** Un export nommé sans `from` : il vient du fichier ou d'un de ses imports. */
function chercherLocal(analyse, nom, cache) {
  if (analyse.declarations.has(nom)) return analyse.declarations.get(nom);
  const module = analyse.imports.get(nom);
  return module ? chercherExport(cibleDe(analyse.fichier, module), nom, cache) : null;
}


export { sansCommentaires, normalise, exportsDuFichier, surfacePaquet, paquetsDuDepot };

/** La surface publique réelle d'un paquet. */
function surfacePaquet(racine, nomPaquet, cache) {
  const index = join(racine, "packages", nomPaquet, "src", "index.ts");
  if (!existsSync(index)) return null;
  return exportsDuFichier(index, cache);
}

/** Les paquets du dépôt, et ceux du contrat. */
function paquetsDuDepot(racine) {
  const dossier = join(racine, "packages");
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

