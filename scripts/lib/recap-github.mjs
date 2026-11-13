/**
 * L'accès GitHub du récapitulatif — par la CLI `gh`, jamais par l'API brute.
 *
 * Le réseau est facultatif : si `gh` n'est pas là, s'il n'est pas
 * authentifié, ou si l'API ne répond pas, l'appel rend `{ ok: false }` avec
 * une raison. Le récapitulatif écrit alors « indisponible » plutôt que
 * d'inventer un chiffre (AIR-N-01 : aucune requête réseau obligatoire).
 *
 * Le lanceur des gardes (`scripts/hooks/lib/lancer.mjs`) est réutilisé tel
 * quel : une seule implémentation du lancement d'une commande enfant.
 */
import { lancer } from "../hooks/lib/lancer.mjs";
import { dateLocale, heureLocale } from "./recap-dates.mjs";

/** Une commande `gh` peut attendre : au-delà, on déclare l'API indisponible. */
const DELAI_MS = 20_000;

/** Le nombre d'éléments demandés à GitHub : une journée tient largement. */
const LIMITE = 50;

/** Une commande `gh` : le JSON rendu, ou la raison de l'échec. */
async function interrogerGh(argumentsGh, cwd) {
  const resultat = await lancer("gh", argumentsGh, { cwd, timeoutMs: DELAI_MS });
  if (resultat.code !== 0) {
    const raison = (resultat.erreur || resultat.sortie || "la commande gh a échoué").split("\n")[0].trim();
    return { ok: false, raison: raison || "la commande gh a échoué" };
  }
  try {
    return { ok: true, donnees: JSON.parse(resultat.sortie) };
  } catch {
    return { ok: false, raison: "réponse de gh illisible" };
  }
}

/** Les arguments communs : le dépôt visé et la taille de la réponse. */
function argumentsCommuns(depot, colonnes) {
  return ["--repo", depot, "--limit", String(LIMITE), "--json", colonnes];
}

/** Les PR mergées le jour donné : numéro, titre, auteur, heure de merge. */
export async function prsMergées(cwd, depot, date) {
  const colonnes = "number,title,mergedAt,author";
  const resultat = await interrogerGh(
    ["pr", "list", "--state", "merged", ...argumentsCommuns(depot, colonnes)],
    cwd,
  );
  if (!resultat.ok) return resultat;
  const lignes = resultat.donnees
    .filter((pr) => dateLocale(pr.mergedAt) === date)
    .map((pr) => ({
      numero: pr.number,
      titre: pr.title,
      auteur: pr.author?.login ?? "inconnu",
      heure: heureLocale(pr.mergedAt),
    }))
    .sort((a, b) => a.numero - b.numero);
  return { ok: true, lignes };
}

/** Les PR encore ouvertes : ce qui reste à finir au moment du bilan. */
export async function prsOuvertes(cwd, depot) {
  const colonnes = "number,title,author,isDraft";
  const resultat = await interrogerGh(
    ["pr", "list", "--state", "open", ...argumentsCommuns(depot, colonnes)],
    cwd,
  );
  if (!resultat.ok) return resultat;
  const lignes = resultat.donnees
    .map((pr) => ({
      numero: pr.number,
      titre: pr.title,
      auteur: pr.author?.login ?? "inconnu",
      brouillon: Boolean(pr.isDraft),
    }))
    .sort((a, b) => a.numero - b.numero);
  return { ok: true, lignes };
}

/** Les exécutions de la CI du jour : ce qui a tourné, ce qui a échoué. */
export async function executions(cwd, depot, date) {
  const colonnes = "workflowName,conclusion,status,createdAt,headBranch,event";
  const resultat = await interrogerGh(
    ["run", "list", ...argumentsCommuns(depot, colonnes)],
    cwd,
  );
  if (!resultat.ok) return resultat;
  const lignes = resultat.donnees
    .filter((course) => dateLocale(course.createdAt) === date)
    .map((course) => ({
      atelier: course.workflowName,
      verdict: course.conclusion ?? course.status ?? "inconnu",
      branche: course.headBranch ?? "",
      evenement: course.event ?? "",
      heure: heureLocale(course.createdAt),
    }));
  return { ok: true, lignes };
}
