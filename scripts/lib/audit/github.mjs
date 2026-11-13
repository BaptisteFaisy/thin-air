/**
 * (h) L'état de la forge : nombre de PR ouvertes et contrôles verts, lus
 * par l'API GitHub — mais seulement si `gh` est présent et authentifié.
 *
 * Sans `gh`, la section est omise du rapport : mieux vaut une absence
 * qu'un chiffre inventé. Aucun jeton n'est lu, aucun n'est écrit : seuls
 * des décomptes sortent de l'API.
 */
import { spawnSync } from "node:child_process";

/** Combien de temps on laisse à `gh` avant de déclarer l'appel perdu. */
const DELAI_MS = 20_000;

/** Lit l'état de la forge. Toujours rendu, jamais levé. */
export function lireGithub(racine) {
  if (!ghDisponible()) {
    return { disponible: false, raison: "`gh` n'est pas installé : section omise" };
  }
  const slug = slugDepot(racine);
  if (!slug) {
    return { disponible: false, raison: "origine GitHub introuvable : section omise" };
  }
  return {
    disponible: true,
    depot: slug,
    ...etatForge(slug),
  };
}

/** `gh` répond-il à `--version` ? */
function ghDisponible() {
  try {
    return spawnSync("gh", ["--version"], { encoding: "utf8", timeout: DELAI_MS }).status === 0;
  } catch {
    return false;
  }
}

/** Le dépôt GitHub, déduit de l'origine `origin` (aucune requête réseau). */
function slugDepot(racine) {
  const resultat = spawnSync("git", ["-C", racine, "remote", "get-url", "origin"], {
    encoding: "utf8",
    timeout: DELAI_MS,
  });
  if (resultat.status !== 0) return null;
  const origine = String(resultat.stdout).trim();
  const trouve = origine.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  return trouve ? `${trouve[1]}/${trouve[2]}` : null;
}

/** Les décomptes de la forge : PR ouvertes, contrôles verts, CI verte. */
function etatForge(slug) {
  const prs = compter(slug, "pulls?state=open&per_page=100");
  const controles = compterChecks(slug, "main");
  const ci = compterRuns(slug);
  return {
    prsOuvertes: prs.total ?? null,
    testsVerts: controles.total ?? null,
    controlesTotaux: controles.total !== null ? controles.details.total : null,
    ciVerte: ci.total ?? null,
    notes: [prs.note, controles.note, ci.note].filter(Boolean),
  };
}

/** Le nombre de PR ouvertes. */
function compter(slug, chemin) {
  const appel = gh(["api", `repos/${slug}/${chemin}`, "--jq", "length"]);
  if (appel.code !== 0) return { total: null, note: `PR ouvertes : ${raison(appel)}` };
  return { total: Number(String(appel.sortie).trim()) || 0, note: "" };
}

/** Le nombre de contrôles verts sur la tête de la branche. */
function compterChecks(slug, branche) {
  const appel = gh([
    "api", `repos/${slug}/commits/${branche}/check-runs`,
    "--jq", "[.check_runs[] | select(.conclusion == \"success\")] | length",
  ]);
  if (appel.code !== 0) return { total: null, details: { total: null }, note: `contrôles verts : ${raison(appel)}` };
  const verts = Number(String(appel.sortie).trim()) || 0;
  const total = gh(["api", `repos/${slug}/commits/${branche}/check-runs`, "--jq", ".check_runs | length"]);
  return {
    total: verts,
    details: { total: Number(String(total.sortie).trim()) || null },
    note: "",
  };
}

/** Le nombre de runs de CI verts parmi les derniers. */
function compterRuns(slug) {
  const appel = gh([
    "run", "list", "--repo", slug, "--workflow", "CI", "--limit", "20",
    "--json", "conclusion", "--jq", "[.[] | select(.conclusion == \"success\")] | length",
  ]);
  if (appel.code !== 0) return { total: null, note: `CI verte : ${raison(appel)}` };
  return { total: Number(String(appel.sortie).trim()) || 0, note: "" };
}

/** Un appel à `gh`, sans jamais laisser fuir un jeton. */
function gh(arguments_) {
  const resultat = spawnSync("gh", arguments_, { encoding: "utf8", timeout: DELAI_MS });
  return {
    code: resultat.status ?? 1,
    sortie: String(resultat.stdout ?? ""),
    erreur: String(resultat.stderr ?? ""),
  };
}

/** Une raison courte et sans secret. */
function raison(appel) {
  const texte = `${appel.erreur}${appel.sortie}`.trim().split("\n")[0] ?? "";
  return nettoyer(texte.slice(0, 160)) || "appel refusé";
}

/** Masque toute longue suite de caractères : un jeton ne sort jamais du rapport. */
export function nettoyer(texte) {
  return texte.replace(/[A-Za-z0-9_=-]{24,}/g, "[masqué]");
}
