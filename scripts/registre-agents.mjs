#!/usr/bin/env node
/**
 * Le registre des agents en cours — l'inventaire lisible d'un lot.
 *
 * Un lot fait tourner plusieurs agents en parallèle (docs/methode-agents.md).
 * Sans registre, on ne sait plus qui travaille sur quoi, ni ce que le lot a
 * coûté. Ce script lit un registre `out/agents.json` et en tire un tableau
 * Markdown : agents en cours, abandons, reprises manuelles, coût cumulé.
 *
 * Usage :
 *   node scripts/registre-agents.mjs [--registre <fichier>] [--sortie <fichier>] [--markdown]
 *
 * Codes de sortie : 0 — registre lu, aucune entrée refusée ; 1 — au moins
 * une entrée refusée (les raisons sont écrites, l'entrée refusée n'est jamais
 * comptée) ; 2 — registre absent ou illisible, usage invalide.
 *
 * Aucun son (AIR-N-02), aucune requête réseau (AIR-N-01) : lecture d'un
 * fichier local, écriture d'un fichier local. Déterminisme (AIR-N-09) : la
 * sortie ne dépend que du registre, jamais de l'heure courante ; les agents
 * sont triés par lot puis par nom.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRE_DEFAUT = "out/agents.json";
const SORTIE_DEFAUT = "out/registre-agents.md";
/** Les quatre statuts qu'une entrée de registre peut porter. */
export const STATUTS = ["en_cours", "termine", "abandonne", "repris_main"];

function usage(code) {
  process.stderr.write(
    "usage : node scripts/registre-agents.mjs [--registre <fichier>] [--sortie <fichier>] [--markdown]\n" +
      "  --registre : le registre à lire (défaut : out/agents.json)\n" +
      "  --sortie   : le Markdown à écrire (défaut : out/registre-agents.md)\n" +
      "  --markdown : le tableau est aussi écrit sur la sortie standard\n",
  );
  process.exit(code);
}

/** Les options de la ligne de commande, avec leurs valeurs par défaut. */
export function lireArguments(argv) {
  const opts = { registre: REGISTRE_DEFAUT, sortie: SORTIE_DEFAUT, markdown: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--registre") opts.registre = argv[++i] ?? "";
    else if (a === "--sortie") opts.sortie = argv[++i] ?? "";
    else if (a === "--markdown") opts.markdown = true;
    else if (a === "--aide" || a === "--help" || a === "-h") usage(0);
    else usage(2);
  }
  if (!opts.registre || !opts.sortie) usage(2);
  return opts;
}

/** Un texte non vide. */
function estTexte(valeur) {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

/** Un tableau dont chaque élément est un texte. */
function estListeDeTextes(valeur) {
  return Array.isArray(valeur) && valeur.every((element) => typeof element === "string");
}

/** Une date que l'on sait lire (les dates du registre sont des ISO). */
function estDate(valeur) {
  return estTexte(valeur) && !Number.isNaN(Date.parse(valeur));
}

/**
 * Les raisons pour lesquelles une entrée est refusée : la liste est vide si
 * l'entrée est exploitable. Une entrée refusée n'est jamais comptée en
 * silence (AIR-F-43) : la raison est écrite avec son agent.
 */
export function validerEntree(entree, index) {
  const raisons = [];
  if (!entree || typeof entree !== "object" || Array.isArray(entree)) {
    return [`agent #${index + 1} : ce n'est pas un objet`];
  }
  if (!estTexte(entree.nom)) raisons.push("« nom » absent ou vide");
  if (!estTexte(entree.lot)) raisons.push("« lot » absent ou vide");
  if (!estDate(entree.debut)) raisons.push("« debut » absent ou illisible");
  if (entree.fin !== undefined && entree.fin !== null && !estDate(entree.fin)) {
    raisons.push("« fin » illisible");
  }
  if (!STATUTS.includes(entree.statut)) raisons.push(`« statut » hors liste (${STATUTS.join(", ")})`);
  if (!estListeDeTextes(entree.fichiers)) raisons.push("« fichiers » n'est pas une liste de textes");
  if (!estListeDeTextes(entree.commits)) raisons.push("« commits » n'est pas une liste de textes");
  if (entree.note !== undefined && typeof entree.note !== "string") {
    raisons.push("« note » n'est pas un texte");
  }
  if (entree.reprise_minutes !== undefined) {
    if (typeof entree.reprise_minutes !== "number" || !Number.isFinite(entree.reprise_minutes)) {
      raisons.push("« reprise_minutes » n'est pas un nombre");
    } else if (entree.reprise_minutes < 0) {
      raisons.push("« reprise_minutes » est négatif");
    }
  }
  if (estDate(entree.debut) && estDate(entree.fin) && Date.parse(entree.fin) < Date.parse(entree.debut)) {
    raisons.push("« fin » est antérieure à « debut »");
  }
  return raisons.map((raison) => `agent #${index + 1} (${entree.nom ?? "sans nom"}) : ${raison}`);
}

/**
 * Le temps de travail d'un agent, en minutes : la durée mesurée par ses
 * horodatages s'il a fini, sinon le temps déjà consigné à la main. `null`
 * quand ni l'un ni l'autre n'existe — un agent qui n'a pas commencé ne coûte
 * rien, mais il n'est pas non plus compté comme gratuit.
 */
export function tempsMinutes(entree) {
  if (estDate(entree.debut) && estDate(entree.fin)) {
    return Math.round((Date.parse(entree.fin) - Date.parse(entree.debut)) / 60000);
  }
  if (typeof entree.minutes === "number" && Number.isFinite(entree.minutes)) return entree.minutes;
  return null;
}

/**
 * Le registre lu et trié : les agents par lot puis par nom, les refus à
 * part. Un registre illisible est une erreur d'usage (code 2).
 */
export function lireRegistre(texte, nomFichier) {
  let brut;
  try {
    brut = JSON.parse(texte);
  } catch (erreur) {
    throw new Error(`${nomFichier} : JSON illisible (${erreur.message})`);
  }
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) {
    throw new Error(`${nomFichier} : ce n'est pas un objet de registre`);
  }
  const brutAgents = Array.isArray(brut.agents) ? brut.agents : [];
  const agents = [];
  const refus = [];
  brutAgents.forEach((entree, index) => {
    const raisons = validerEntree(entree, index);
    if (raisons.length > 0) refus.push(...raisons);
    else agents.push(entree);
  });
  agents.sort((a, b) => (a.lot === b.lot ? a.nom.localeCompare(b.nom) : a.lot.localeCompare(b.lot)));
  const quota = brut.quota && typeof brut.quota === "object" ? brut.quota : null;
  return { agents, refus, quota };
}

/** Les agents regroupés par statut : en cours, abandons, reprises manuelles. */
export function classer(agents) {
  return {
    enCours: agents.filter((a) => a.statut === "en_cours"),
    abandonnes: agents.filter((a) => a.statut === "abandonne"),
    reprises: agents.filter((a) => a.statut === "repris_main"),
    termines: agents.filter((a) => a.statut === "termine"),
  };
}

/** Le coût cumulé du lot : temps de travail, reprises, commits, fichiers. */
export function coutCumule(agents, groupes) {
  let minutes = 0;
  let minutesReprise = 0;
  let commits = 0;
  let fichiers = 0;
  for (const agent of agents) {
    const temps = tempsMinutes(agent);
    if (temps !== null) minutes += temps;
    if (agent.statut === "repris_main") minutesReprise += agent.reprise_minutes ?? 0;
    commits += agent.commits.length;
    fichiers += agent.fichiers.length;
  }
  return {
    minutes,
    minutesReprise,
    commits,
    fichiers,
    abandonnes: groupes.abandonnes.length,
    reprises: groupes.reprises.length,
    enCours: groupes.enCours.length,
    termines: groupes.termines.length,
  };
}

/** Une cellule de tableau : le `|` d'un texte ne doit pas casser la table. */
function cellule(valeur) {
  return String(valeur ?? "—").replace(/\|/g, "\\|");
}

/** Le tableau d'une section : un en-tête, puis une ligne par agent. */
function section(titre, compte, entetes, lignes) {
  const sortie = [
    `## ${titre} (${compte})`,
    "",
    `| ${entetes.join(" | ")} |`,
    `| ${entetes.map(() => "---").join(" | ")} |`,
  ];
  for (const ligne of lignes) sortie.push(`| ${ligne.map(cellule).join(" | ")} |`);
  if (lignes.length === 0) sortie.push(`| ${entetes.map(() => "—").join(" | ")} |`);
  return sortie;
}

/** Les lignes d'agents en cours : qui travaille, sur quoi, depuis quand. */
function lignesEnCours(agents) {
  return agents.map((a) => [a.nom, a.lot, a.fichiers.length, a.debut, a.commits.length, a.note ?? "—"]);
}

/** Les lignes d'abandon : ce qui a été perdu, et pourquoi. */
function lignesAbandonnes(agents) {
  return agents.map((a) => [a.nom, a.lot, a.debut, a.commits.length, a.note ?? "—"]);
}

/** Les lignes de reprise manuelle : qui a repris, et à quel prix. */
function lignesReprises(agents) {
  return agents.map((a) => [a.nom, a.lot, a.debut, a.commits.length, a.reprise_minutes ?? 0, a.note ?? "—"]);
}

/**
 * Le tableau Markdown du lot : en tête le quota et le compte des agents, puis
 * les quatre sections — en cours, abandons, reprises manuelles, coût cumulé.
 */
export function enMarkdown(registre, nomRegistre = REGISTRE_DEFAUT) {
  const { agents, refus, quota } = registre;
  const groupes = classer(agents);
  const cout = coutCumule(agents, groupes);
  const lignes = [
    "# Registre des agents — Thin Air",
    "",
    `Registre : \`${nomRegistre}\` — ${agents.length} agent(s) retenu(s), ${refus.length} entrée(s) refusée(s).`,
    "",
  ];
  if (quota) {
    lignes.push(
      `Quota : **${quota.nom ?? "sans nom"}** — ${quota.simultanes ?? "?"} agent(s) simultané(s).` +
        (quota.raison ? ` ${quota.raison}` : ""),
      "",
    );
  }
  lignes.push(...section("Agents en cours", groupes.enCours.length, ["Agent", "Lot", "Fichiers", "Début", "Commits", "Note"], lignesEnCours(groupes.enCours)));
  lignes.push("");
  lignes.push(...section("Abandons", groupes.abandonnes.length, ["Agent", "Lot", "Début", "Commits", "Raison"], lignesAbandonnes(groupes.abandonnes)));
  lignes.push("");
  lignes.push(...section("Reprises manuelles", groupes.reprises.length, ["Agent", "Lot", "Début", "Commits", "Minutes reprise", "Note"], lignesReprises(groupes.reprises)));
  lignes.push("");
  lignes.push("## Coût cumulé", "", "| Mesure | Valeur |", "| --- | --- |");
  lignes.push(`| Temps de travail | ${cout.minutes} min |`);
  lignes.push(`| Temps de reprise manuelle | ${cout.minutesReprise} min |`);
  lignes.push(`| Reprises manuelles | ${cout.reprises} |`);
  lignes.push(`| Abandons | ${cout.abandonnes} |`);
  lignes.push(`| Commits produits | ${cout.commits} |`);
  lignes.push(`| Fichiers couverts | ${cout.fichiers} |`);
  lignes.push(`| Agents terminés | ${cout.termines} |`);
  lignes.push("");
  return `${lignes.join("\n")}\n`;
}

/** Le point d'entrée : lire, écrire, dire. */
export function principale(argv) {
  const opts = lireArguments(argv);
  let texte;
  try {
    texte = readFileSync(resolve(opts.registre), "utf8");
  } catch (erreur) {
    process.stderr.write(`registre illisible : ${opts.registre} (${erreur.message})\n`);
    process.exit(2);
  }
  let registre;
  try {
    registre = lireRegistre(texte, opts.registre);
  } catch (erreur) {
    process.stderr.write(`${erreur.message}\n`);
    process.exit(2);
  }
  const markdown = enMarkdown(registre, opts.registre);
  const cible = resolve(opts.sortie);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, markdown, "utf8");
  for (const raison of registre.refus) process.stderr.write(`✗ ${raison}\n`);
  process.stdout.write(`${registre.agents.length} agent(s) → ${opts.sortie}\n`);
  if (opts.markdown) process.stdout.write(`\n${markdown}`);
  process.exit(registre.refus.length > 0 ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  principale(process.argv.slice(2));
}
