/**
 * Outils communs des gardes (cahier §14.3).
 *
 * Trois choses seulement, partagées par tous les hooks :
 *   - la lecture de la charge utile que Kiro dépose sur l'entrée standard ;
 *   - le parcours des fichiers d'un dossier ;
 *   - le journal des refus, écrit dans `out/hook-log.jsonl` (dossier ignoré
 *     par git, donc jamais dans le diff).
 *
 * Aucun son, aucune requête réseau, aucun périphérique : ces outils ne font
 * que lire et écrire du texte (AIR-N-02).
 */
import { appendFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

/** Racine du dépôt : le dossier courant, ou le `cwd` annoncé par Kiro. */
export function racine(chargeUtile) {
  const annonce = chargeUtile && typeof chargeUtile.cwd === "string" ? chargeUtile.cwd : "";
  return annonce.trim() ? annonce : process.cwd();
}

/**
 * Lit le JSON de l'entrée standard. Le champ exact qui porte la commande est
 * marqué « à vérifier » (cahier, annexe D) : `commandeDeLaChargeUtile`
 * accepte les trois formes possibles.
 */
export async function lireChargeUtile(stdin = process.stdin, delaiMs = 400) {
  if (!stdin || stdin.isTTY) return null;
  const texte = await lireTexte(stdin, delaiMs);
  if (!texte.trim()) return null;
  try {
    const valeur = JSON.parse(texte);
    return valeur && typeof valeur === "object" ? valeur : null;
  } catch {
    return null;
  }
}

function lireTexte(stream, delaiMs) {
  return new Promise((resoudre) => {
    let texte = "";
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      resoudre(texte);
    };
    const minuteur = setTimeout(terminer, delaiMs);
    minuteur.unref?.();
    stream.on("data", (bloc) => {
      texte += String(bloc);
    });
    stream.on("end", terminer);
    stream.on("error", terminer);
  });
}

/**
 * La commande que l'agent s'apprête à lancer.
 * `tool_input.command`, `tool_input.cmd`, `tool_input.input` : les trois
 * formes sont admises tant que le champ exact n'est pas confirmé
 * (cahier §14.3 et annexe D).
 */
export function commandeDeLaChargeUtile(chargeUtile) {
  if (!chargeUtile || typeof chargeUtile !== "object") return null;
  const entree = chargeUtile.tool_input;
  if (typeof entree === "string") return entree.trim() ? entree : null;
  if (!entree || typeof entree !== "object") return null;
  for (const cle of ["command", "cmd", "input"]) {
    const valeur = entree[cle];
    if (typeof valeur === "string" && valeur.trim()) return valeur;
  }
  return null;
}

/** Rend les fichiers d'un dossier, récursivement. */
export async function* fichiersSous(dossier, { ignores = [], extensions = null } = {}) {
  let entrees;
  try {
    entrees = await readdir(dossier, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entree of entrees) {
    if (ignores.includes(entree.name)) continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      yield* fichiersSous(chemin, { ignores, extensions });
    } else if (entree.isFile() && (!extensions || extensions.includes(extensionDe(chemin)))) {
      yield chemin;
    }
  }
}

/** Extension en minuscules, point compris (`.json`). */
export function extensionDe(chemin) {
  const base = chemin.slice(chemin.lastIndexOf("/") + 1);
  const point = base.lastIndexOf(".");
  return point < 0 ? "" : base.slice(point).toLowerCase();
}

/**
 * Journal des gardes : une ligne JSON par invocation, dans
 * `out/hook-log.jsonl`. Le dossier `out/` est ignoré par git ; le journal
 * se joint à la soumission (recette §18).
 */
export async function journaliser(base, evenement) {
  try {
    const dossier = join(base, "out");
    await mkdir(dossier, { recursive: true });
    const ligne = `${JSON.stringify({ garde: evenement.garde, ...evenement, at: new Date().toISOString() })}\n`;
    await appendFile(join(dossier, "hook-log.jsonl"), ligne, "utf8");
  } catch {
    // Un journal qui ne s'écrit pas ne doit pas faire échouer une garde.
  }
}

/** Refus : message sur la sortie d'erreur, code de sortie non nul. */
export function refuser(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Acceptation : message sur la sortie standard, code de sortie nul. */
export function accepter(message) {
  process.stdout.write(`${message}\n`);
  process.exit(0);
}
