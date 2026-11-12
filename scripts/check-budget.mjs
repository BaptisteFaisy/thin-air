#!/usr/bin/env node
/**
 * Contrôle du budget CI — 5 min par job de PR, budget explicite ailleurs.
 *
 * La règle du projet : un job de pull_request rend son verdict en 5 minutes
 * au plus. Tant qu'aucun contrôle automatique ne la vérifie, elle reste un
 * souhait ; ce script la vérifie sur tous les workflows et fait échouer la
 * CI quand elle n'est pas tenue.
 *
 * Ce que le contrôle refuse (code de sortie 1) :
 *   - un job sans `timeout-minutes` explicite : le défaut GitHub est 360 min ;
 *   - un job de PR dont le `timeout-minutes` dépasse 5 ;
 *   - un job de PR marqué `continue-on-error: true` : un job de PR doit
 *     être bloquant, sinon le verdict de la file ment ;
 *   - un job hors PR dont le budget dépasse 5 sans justification écrite sur
 *     la ligne du `timeout-minutes`.
 *
 * Un job hors PR (push, schedule, workflow_dispatch) peut donc prendre plus
 * de temps, à condition d'écrire son budget et de le justifier.
 *
 * Usage : `node scripts/check-budget.mjs [racine]` → 0 si tout est vert.
 * Node pur, lecture seule, aucun réseau, aucun son.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Budget maximal d'un job de PR, en minutes. */
export const BUDGET_PR_MINUTES = 5;

/** Déclencheurs qui font entrer un workflow dans le cadre « PR ». */
const DECLENCHEURS_PR = new Set(["pull_request", "merge_group"]);

const DOSSIER_WORKFLOWS = join(".github", "workflows");
const EXTENSIONS = [".yml", ".yaml"];
const CLE = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*:(.*)$/;

/** Un chemin lisible partout, avec `/` comme séparateur. */
function cheminLisible(chemin) {
  return chemin.split(sep).join("/");
}

/** Découpe le reste d'une ligne YAML : la valeur, puis le commentaire final. */
export function separerValeur(reste) {
  let guillemet = null;
  for (let i = 0; i < reste.length; i += 1) {
    const caractere = reste[i];
    if (guillemet) {
      if (caractere === guillemet) guillemet = null;
      continue;
    }
    if (caractere === '"' || caractere === "'") {
      guillemet = caractere;
      continue;
    }
    if (caractere === "#" && (i === 0 || /\s/.test(reste[i - 1]))) {
      return { valeur: reste.slice(0, i).trim(), commentaire: reste.slice(i).trim() };
    }
  }
  return { valeur: reste.trim(), commentaire: "" };
}

/**
 * Les paires clé/valeur du fichier, en ignorant les commentaires, les lignes
 * vides et le contenu des blocs scalaires (`run: |` …), qui n'est pas du YAML.
 */
export function paires(texte) {
  const resultat = [];
  let bloc = null;
  for (const ligne of texte.split("\n")) {
    const brute = ligne.replace(/\r$/, "").replace(/\t/g, "  ");
    const indent = brute.length - brute.trimStart().length;
    const contenu = brute.trim();
    if (bloc !== null) {
      if (contenu === "" || indent > bloc) continue;
      bloc = null;
    }
    if (contenu === "" || contenu.startsWith("#")) continue;
    const trouve = CLE.exec(contenu);
    if (!trouve) continue;
    const { valeur, commentaire } = separerValeur(trouve[2]);
    resultat.push({ indent, cle: trouve[1], valeur, commentaire });
    if (/^[|>][-+]?$/.test(valeur)) bloc = indent;
  }
  return resultat;
}

/** Les déclencheurs du workflow (`on:`), en style bloc ou en style flux. */
export function declencheurs(lesPaires) {
  const trouve = new Set();
  let dansOn = false;
  let indentOn = null;
  for (const paire of lesPaires) {
    if (paire.indent === 0) {
      dansOn = paire.cle === "on";
      indentOn = null;
      if (dansOn && paire.valeur) {
        const brut = paire.valeur.startsWith("[")
          ? paire.valeur.replace(/^\[/, "").replace(/\]$/, "")
          : paire.valeur;
        for (const nom of brut.split(",")) {
          const nettoye = nom.trim().replace(/^["']|["']$/g, "");
          if (nettoye) trouve.add(nettoye);
        }
      }
      continue;
    }
    if (!dansOn) continue;
    if (indentOn === null) indentOn = paire.indent;
    if (paire.indent === indentOn) trouve.add(paire.cle);
  }
  return trouve;
}

/** Les jobs du workflow : nom, budget déclaré, tolérance à l'échec. */
export function jobs(lesPaires) {
  const liste = [];
  let dansJobs = false;
  let courant = null;
  for (const paire of lesPaires) {
    if (paire.indent === 0) {
      dansJobs = paire.cle === "jobs";
      courant = null;
      continue;
    }
    if (!dansJobs) continue;
    if (paire.indent === 2) {
      courant = {
        nom: paire.cle,
        timeoutDeclare: false,
        timeout: null,
        continueOnError: false,
        ligne: null,
      };
      liste.push(courant);
      continue;
    }
    if (paire.indent !== 4 || !courant) continue;
    if (paire.cle === "timeout-minutes") {
      courant.timeoutDeclare = true;
      courant.ligne = paire;
      const nombre = paire.valeur === "" ? Number.NaN : Number(paire.valeur);
      courant.timeout = Number.isFinite(nombre) ? nombre : null;
    } else if (paire.cle === "continue-on-error") {
      courant.continueOnError = paire.valeur.toLowerCase() === "true";
    }
  }
  return liste;
}

/** Les fautes d'un job : ce que la règle refuse, fichier et job en tête. */
function fautesDuJob(job, fichier, estPr) {
  const fautes = [];
  if (!job.timeoutDeclare) {
    fautes.push({
      fichier,
      job: job.nom,
      message: "aucun timeout-minutes explicite (le défaut GitHub est 360 min)",
    });
    return fautes;
  }
  if (job.timeout === null) {
    fautes.push({
      fichier,
      job: job.nom,
      message: `timeout-minutes illisible (${job.ligne.valeur || "vide"})`,
    });
    return fautes;
  }
  if (estPr && job.timeout > BUDGET_PR_MINUTES) {
    fautes.push({
      fichier,
      job: job.nom,
      message: `timeout-minutes: ${job.timeout} > ${BUDGET_PR_MINUTES} (budget des PR)`,
    });
  }
  if (!estPr && job.timeout > BUDGET_PR_MINUTES && !job.ligne.commentaire) {
    fautes.push({
      fichier,
      job: job.nom,
      message: `timeout-minutes: ${job.timeout} hors PR, sans justification écrite sur la ligne`,
    });
  }
  if (estPr && job.continueOnError) {
    fautes.push({
      fichier,
      job: job.nom,
      message: "continue-on-error: true — un job de PR doit être bloquant",
    });
  }
  return fautes;
}

/** Analyse un workflow : ses jobs, son cadre (PR ou hors PR), ses fautes. */
export function analyserWorkflow(texte, fichier) {
  const lesPaires = paires(texte);
  const triggers = declencheurs(lesPaires);
  const estPr = [...triggers].some((nom) => DECLENCHEURS_PR.has(nom));
  const liste = jobs(lesPaires);
  return {
    fichier,
    estPr,
    declencheurs: [...triggers],
    jobs: liste,
    fautes: liste.flatMap((job) => fautesDuJob(job, fichier, estPr)),
  };
}

/** Analyse tous les workflows d'un dépôt. */
export function analyserDepot(racine) {
  const dossier = join(racine, DOSSIER_WORKFLOWS);
  let noms = [];
  try {
    noms = readdirSync(dossier)
      .filter((nom) => EXTENSIONS.some((extension) => nom.endsWith(extension)))
      .sort();
  } catch {
    return {
      workflows: [],
      fautes: [{ fichier: cheminLisible(DOSSIER_WORKFLOWS), job: "-", message: "dossier introuvable" }],
    };
  }
  const workflows = noms.map((nom) =>
    analyserWorkflow(
      readFileSync(join(dossier, nom), "utf8"),
      cheminLisible(join(DOSSIER_WORKFLOWS, nom)),
    ),
  );
  return { workflows, fautes: workflows.flatMap((workflow) => workflow.fautes) };
}

/** Une faute, telle qu'elle est affichée. */
function decrire(faute) {
  return `${faute.fichier} : job '${faute.job}' : ${faute.message}`;
}

/** Point d'entrée : affiche le rapport et rend un code non nul s'il y a faute. */
export function principale(argv) {
  const racine = resolve(argv[0] ?? join(ICI, ".."));
  const { workflows, fautes } = analyserDepot(racine);
  for (const workflow of workflows) {
    if (workflow.fautes.length === 0) {
      const cadre = workflow.estPr ? "PR" : "hors PR";
      process.stdout.write(`  ✓ ${workflow.fichier} — ${workflow.jobs.length} job(s), ${cadre}\n`);
      continue;
    }
    for (const faute of workflow.fautes) {
      process.stdout.write(`  ✗ ${decrire(faute)}\n`);
    }
  }
  for (const faute of fautes) {
    process.stderr.write(`::error::${decrire(faute)}\n`);
  }
  const total = workflows.reduce((nombre, workflow) => nombre + workflow.jobs.length, 0);
  process.stdout.write(
    `budget CI : ${workflows.length} workflow(s), ${total} job(s), ${fautes.length} erreur(s)` +
      ` — ${BUDGET_PR_MINUTES} min par job de PR\n`,
  );
  return fautes.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(principale(process.argv.slice(2)));
}
