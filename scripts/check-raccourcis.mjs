#!/usr/bin/env node
/**
 * Contrôle du manifeste des raccourcis clavier (docs/raccourcis.json),
 * lancé par la CI et à la main : `node scripts/check-raccourcis.mjs`.
 *
 * Trois règles, et le script sort 1 à la première qui casse (plus les défauts
 * de forme qui rendraient une règle muette) :
 *   1. aucun raccourci ne masque un raccourci du navigateur (Ctrl+T, Ctrl+W,
 *      Ctrl+N, Ctrl+L, Ctrl+P, Ctrl+S, Ctrl+R, Ctrl+F, Ctrl+D, Ctrl+H, Ctrl+J,
 *      Ctrl+K, Ctrl+Q, Ctrl+Shift+T/N/W, Ctrl+Tab, F5, F11, F12, Alt+F4…), et
 *      l'application ne prend jamais Ctrl, Méta ni Alt — ils appartiennent au
 *      navigateur et au système ;
 *   2. aucune touche n'est assignée deux fois dans le même contexte ;
 *   3. chaque action listée a un raccourci OU une raison documentée.
 *
 * Aucun son, aucune requête réseau : il ne fait que lire un fichier local.
 *
 * Usage : `node scripts/check-raccourcis.mjs [fichier]` (défaut : docs/raccourcis.json).
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Modificateurs que le navigateur ou le système garde pour lui. */
const MODIFICATEURS_RESERVES = new Set(["ctrl", "meta", "cmd", "alt", "option"]);

/** Les raccourcis du navigateur nommés explicitement par la règle du cahier. */
const RACCOURCIS_NAVIGATEUR = new Set([
  "ctrl+t", "ctrl+w", "ctrl+n", "ctrl+shift+t", "ctrl+shift+n", "ctrl+shift+w",
  "ctrl+l", "ctrl+p", "ctrl+s", "ctrl+r", "ctrl+f", "ctrl+d", "ctrl+h", "ctrl+j",
  "ctrl+k", "ctrl+q", "ctrl+shift+q", "ctrl+tab", "ctrl+shift+tab", "ctrl+1", "ctrl+2",
  "ctrl+3", "ctrl+4", "ctrl+5", "ctrl+6", "ctrl+7", "ctrl+8", "ctrl+9", "ctrl+0",
  "f5", "f11", "f12", "alt+f4",
]);

/**
 * Noms de touches factorisés : chaque touche d'une combinaison s'écrit en
 * minuscules, sans espaces autour du « + ». Une flèche s'écrit « ArrowUp ».
 */
function normalise(combinaison) {
  return combinaison
    .trim()
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("+");
}

/** Modificateurs présents dans une combinaison normalisée, dans l'ordre. */
function modificateurs(combinaison) {
  const touches = combinaison.split("+");
  return touches.filter((touche) => MODIFICATEURS_RESERVES.has(touche));
}

/** Vrai si la combinaison masque un raccourci du navigateur ou du système. */
function masqueNavigateur(combinaison) {
  const norme = normalise(combinaison);
  if (RACCOURCIS_NAVIGATEUR.has(norme)) return true;
  const mods = modificateurs(norme);
  // Certains raccourcis système n'ont qu'un modificateur (ex. Ctrl seul) ;
  // tout emploi de modificateur est refusé d'avance, sauf Maj (accessible).
  return mods.some((mod) => mod !== "shift");
}

/** Une ligne de problème, numérotée comme dans le fichier source. */
function probleme(source, action, message) {
  return `${source} → ${action} : ${message}`;
}

/**
 * Les défauts du manifeste, en français : une liste vide = conforme.
 * `source` est le chemin du fichier, pour que le message soit actionnable.
 */
export function verifier(manifeste, source = "docs/raccourcis.json") {
  const defauts = [];
  const forme = manifeste;
  if (forme === null || typeof forme !== "object" || !Array.isArray(forme.actions)) {
    return [`${source} : le manifeste doit être un objet avec une liste « actions ».`];
  }

  const vusTouches = new Map(); // « contexte + ":" + touche » → identifiant de l'action
  const vusIds = new Set();

  for (const action of forme.actions) {
    const id = action?.id ?? "(sans identifiant)";
    const source = `${id}`;

    if (vusIds.has(id)) defauts.push(probleme(source, id, "identifiant dupliqué — un raccourci par action, jamais deux."));
    vusIds.add(id);

    const touches = Array.isArray(action.touches) ? action.touches : [];
    const contexte = typeof action.contexte === "string" ? action.contexte : "";
    const raison = action.raison;
    const raisonDoc = typeof raison?.fr === "string" && raison.fr.trim() !== ""
      && typeof raison?.en === "string" && raison.en.trim() !== "";

    if (id.trim() === "") defauts.push(probleme(source, id, "identifiant vide."));
    if (typeof action.ecran !== "string" || action.ecran.trim() === "") {
      defauts.push(probleme(source, id, "l'écran est absent."));
    }
    if (contexte.trim() === "") defauts.push(probleme(source, id, "le contexte est absent."));
    if (typeof action.libelle?.fr !== "string" || typeof action.libelle?.en !== "string") {
      defauts.push(probleme(source, id, "le libellé français ou anglais est absent."));
    }

    // Règle 1 — ne pas masquer le navigateur.
    for (const combinaison of touches) {
      const norme = normalise(combinaison);
      if (masqueNavigateur(combinaison)) {
        defauts.push(probleme(source, id, `la touche « ${combinaison} » masque un raccourci du navigateur ou du système.`));
      }
      // Règle 2 — une touche par contexte.
      const cle = `${contexte}:${norme}`;
      const deja = vusTouches.get(cle);
      if (deja !== undefined && deja !== id) {
        defauts.push(probleme(source, id, `la touche « ${combinaison} » est déjà assignée à « ${deja} » dans le contexte « ${contexte} ».`));
      }
      vusTouches.set(cle, id);
    }

    // Règle 3 — un raccourci OU une raison documentée.
    if (touches.length === 0 && !raisonDoc) {
      defauts.push(probleme(source, id, "aucun raccourci et aucune raison documentée."));
    }
  }

  return defauts;
}

/** Chemin du manifeste, relatif au dépôt (le dossier parent du script). */
function cheminParDefaut() {
  const ici = fileURLToPath(new URL(".", import.meta.url));
  return join(ici, "..", "docs", "raccourcis.json");
}

const argument = process.argv[2];
const chemin = argument === undefined ? cheminParDefaut() : resolve(process.cwd(), argument);
const source = argument === undefined ? "docs/raccourcis.json" : argument;

let manifeste;
try {
  manifeste = JSON.parse(await readFile(chemin, "utf8"));
} catch (erreur) {
  process.stderr.write(`check-raccourcis : impossible de lire ${source} — ${String(erreur)}\n`);
  process.exit(1);
}

const defauts = verifier(manifeste, source);
if (defauts.length > 0) {
  for (const d of defauts) process.stderr.write(`✗ ${d}\n`);
  process.stderr.write(`${defauts.length} défaut(s) dans le manifeste des raccourcis.\n`);
  process.exit(1);
}
process.stdout.write(`✓ manifeste conforme : ${manifeste.actions.length} actions, aucune touche en conflit ni masquée.\n`);
