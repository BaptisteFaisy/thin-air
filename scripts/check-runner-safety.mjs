#!/usr/bin/env node
/**
 * Contrôle de sécurité des runners — le dépôt ET les runners.
 *
 * Deux constats, dans un seul passage :
 *
 *  1. **Le dépôt.** Chaque étape de workflow qui nettoie (`git clean`,
 *     `rm -rf`) est listée, puis jugée : le motif peut-il atteindre un
 *     dossier de runner (`actions-runner-*`) ? Un `git clean` sans exclusion
 *     est refusé — il efface tout ce qui n'est pas suivi, dossier de runner
 *     compris. Un motif qui vise `~`, `$HOME`, `..`, `_work*` ou
 *     `actions-runner-*` est refusé aussi.
 *
 *  2. **Les runners.** Pour chaque runner de l'inventaire
 *     (`docs/runners.md`), le dossier doit exister avec son `run.sh` et son
 *     `.runner`. La vérification distante se fait en SSH **en lecture seule**
 *     (un `test -f` et un `test -d` par dossier), quand la machine est
 *     joignable. Un runner disparu est signalé, et le contrôle sort en 1.
 *
 * Le contrôle ne supprime rien, ne redémarre rien, ne réinscrit rien : il
 * constate et il parle. La marche à suivre pour réinscrire un runner est dans
 * `docs/runners.md`.
 *
 * Usage :
 *   node scripts/check-runner-safety.mjs [racine] [--serveur hote] [--hors-reseau]
 *
 * Codes de sortie : 0 = rien à signaler, 1 = runner manquant ou motif de
 * nettoyage dangereux, 2 = usage incorrect.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Le runner attendu par ce dépôt (inventaire complet : `docs/runners.md`). */
export const INVENTAIRE = [
  {
    nom: "r630-thin-air-04",
    depot: "Tradoooo/thin-air",
    machine: "r630",
    dossier: "actions-runner-thin-air-04",
  },
];

const SERVEUR_PAR_DEFAUT = process.env.THIN_AIR_SERVEUR_RUNNERS ?? "baptiste@100.124.18.48";
const MOTIF_RUNNER = /actions-runner-/;
const MOTIF_PROTECTION = /(actions-runner-|_work)/;
const DELAI_SSH_MS = 20_000;

// ---------------------------------------------------------------------------
// Analyse d'une commande de nettoyage
// ---------------------------------------------------------------------------

/** Découpe une ligne de shell en jetons, en ignorant les guillemets. */
export function jetons(texte) {
  return String(texte)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((j) => j.replace(/^["']|["']$/g, ""));
}

/**
 * Le chemin visé peut-il atteindre un dossier de runner ?
 * `~`, `$HOME`, `..`, `_work*` et `actions-runner-*` : oui.
 */
export function cibleAtteintRunner(cible, contexte = {}) {
  const c = jetons(cible)[0] ?? "";
  if (!c) return false;
  if (MOTIF_RUNNER.test(c)) return true;
  if (/(^|\/)\.\.(\/|$)/.test(c)) return true;
  if (/(^|\/)_work/.test(c)) return true;
  if (c === "~" || c.startsWith("~/") || /\$HOME|\$\{HOME\}/.test(c)) return true;
  const maison = contexte.maison ?? homedir();
  return c === maison || c.startsWith(`${maison}/`);
}

/** Analyse les arguments de `git clean` : exclusions et chemins visés. */
function analyserGitClean(parte, contexte) {
  const liste = jetons(parte);
  const exclusions = [];
  const chemins = [];
  for (let i = 0; i < liste.length; i += 1) {
    const j = liste[i];
    if (j === "-e" || j === "--exclude") {
      exclusions.push(liste[i + 1] ?? "");
      i += 1;
    } else if (j.startsWith("--exclude=")) {
      exclusions.push(j.slice("--exclude=".length));
    } else if (j.startsWith("-")) {
      continue; // -f -ff -d -x -X -q : des options, pas des chemins
    } else {
      chemins.push(j);
    }
  }
  const constats = [];
  if (exclusions.length === 0) {
    constats.push({
      niveau: "refus",
      motif: "git clean",
      raison: "aucune exclusion : le motif efface tout ce qui n'est pas suivi, dossier de runner compris",
    });
  } else if (!exclusions.some((e) => MOTIF_PROTECTION.test(e))) {
    constats.push({
      niveau: "avis",
      motif: "git clean",
      raison: `aucune exclusion de dossier de runner (exclusions : ${exclusions.join(", ")})`,
    });
  }
  for (const chemin of [...chemins, contexte.repertoire ?? ""]) {
    if (cibleAtteintRunner(chemin, contexte)) {
      constats.push({
        niveau: "refus",
        motif: "git clean",
        raison: `la cible « ${chemin} » peut atteindre un dossier de runner`,
      });
    }
  }
  return constats;
}

/** Analyse les arguments de `rm -rf` : la cible peut-elle atteindre un runner ? */
function analyserSuppression(parte, contexte) {
  const liste = jetons(parte).filter((j) => !j.startsWith("--"));
  const chemins = liste.filter((j) => !/^-[a-zA-Z]+$/.test(j));
  const constats = [];
  for (const chemin of chemins) {
    if (cibleAtteintRunner(chemin, contexte)) {
      constats.push({
        niveau: "refus",
        motif: "rm",
        raison: `la cible « ${chemin} » peut atteindre un dossier de runner`,
      });
    }
  }
  return constats;
}

/**
 * Constate une commande de nettoyage.
 * Renvoie `{ refus, avis, motifs }` : `refus` est bloquant, `avis` non.
 */
export function analyserCommandeNettoyage(commande, contexte = {}) {
  const constats = [];
  for (const ligne of String(commande ?? "").split("\n")) {
    const t = ligne.trim();
    if (!t || t.startsWith("#")) continue;
    const clean = /\bgit\s+clean\b([^;&|]*)/.exec(t);
    if (clean) constats.push(...analyserGitClean(clean[1], contexte));
    const rm = /\brm\b([^;&|]*)/.exec(t);
    if (rm && /[rR]/.test(rm[1]) && /f/.test(rm[1])) {
      constats.push(...analyserSuppression(rm[1], contexte));
    }
  }
  return {
    refus: constats.filter((c) => c.niveau === "refus"),
    avis: constats.filter((c) => c.niveau === "avis"),
    motifs: constats.map((c) => c.motif),
  };
}

// ---------------------------------------------------------------------------
// Lecture des workflows
// ---------------------------------------------------------------------------

/** Lit un bloc YAML indenté (après `run: |`) ; rend le texte et l'index suivant. */
function lireBloc(lignes, debut, indentBase) {
  const morceaux = [];
  let i = debut;
  for (; i < lignes.length; i += 1) {
    const l = lignes[i];
    if (l.trim() === "") {
      morceaux.push("");
      continue;
    }
    if (l.length - l.trimStart().length <= indentBase) break;
    morceaux.push(l.trim());
  }
  return { texte: morceaux.join("\n"), suivant: i };
}

/** Découpe « clé: valeur ». */
function cleValeur(texte) {
  const i = texte.indexOf(":");
  if (i < 0) return [texte.trim(), ""];
  return [texte.slice(0, i).trim(), texte.slice(i + 1).trim()];
}

/**
 * Extrait les étapes d'un workflow : nom, répertoire de travail, commande.
 * Pas de dépendance YAML : un balayage de lignes suffit pour `run:`.
 */
export function extraireEtapes(contenu) {
  const lignes = String(contenu).split("\n");
  const etapes = [];
  let etape = null;
  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i];
    const item = /^(\s*)-\s+(.*)$/.exec(ligne);
    if (item) {
      if (etape) etapes.push(etape);
      const indent = item[1].length;
      const [cle, valeur] = cleValeur(item[2]);
      etape = { nom: cle === "name" ? valeur : "(sans nom)", repertoireTravail: null, commande: "" };
      if (cle === "run") {
        const r = lireScript(listeScript(valeur), lignes, i, indent);
        etape.commande = r.texte;
        i = r.suivant - 1;
      }
      i += 1;
      continue;
    }
    if (etape && ligne.trim() !== "") {
      const indent = ligne.length - ligne.trimStart().length;
      const [cle, valeur] = cleValeur(ligne.trim());
      if (cle === "working-directory") {
        etape.repertoireTravail = valeur.replace(/^["']|["']$/g, "");
      } else if (cle === "run") {
        const r = lireScript(listeScript(valeur), lignes, i, indent);
        etape.commande = r.texte;
        i = r.suivant - 1;
      }
    }
    i += 1;
  }
  if (etape) etapes.push(etape);
  return etapes;
}

/** `run: |` ouvre un bloc ; `run: echo x` est une ligne unique. */
function listeScript(valeur) {
  const v = valeur.trim();
  return v === "" || /^[|>][-+]?\d*$/.test(v);
}

/** Rend le texte d'un `run:` (bloc indenté ou ligne unique). */
function lireScript(estBloc, lignes, index, indentBase) {
  if (!estBloc) {
    return { texte: cleValeur(lignes[index])[1], suivant: index + 1 };
  }
  const r = lireBloc(lignes, index + 1, indentBase);
  return { texte: r.texte, suivant: r.suivant };
}

// ---------------------------------------------------------------------------
// Constat sur le dépôt
// ---------------------------------------------------------------------------

/** L'inventaire écrit dans `docs/runners.md` (le tableau fait foi). */
export function lireInventaireDocument(racine) {
  const chemin = join(racine, "docs", "runners.md");
  if (!existsSync(chemin)) return null;
  const dossiers = new Set();
  let dansTableau = false;
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    const t = ligne.trim();
    if (!t.startsWith("|")) {
      if (dansTableau) break;
      continue;
    }
    const cellules = t.split("|").map((c) => c.trim());
    if (!dansTableau) {
      const entete = cellules.join(" ").toLowerCase();
      if (entete.includes("nom") && entete.includes("dossier")) dansTableau = true;
      continue;
    }
    for (const cellule of cellules) {
      const m = /actions-runner-[A-Za-z0-9_.-]+/.exec(cellule);
      if (m) dossiers.add(m[0]);
    }
  }
  return [...dossiers].sort();
}

/** Analyse les workflows d'un dépôt : étapes listées, refus et avis. */
export function analyserDepot(racine) {
  const dossierWorkflows = join(racine, ".github", "workflows");
  const fichiers = existsSync(dossierWorkflows)
    ? readdirSync(dossierWorkflows).filter((n) => n.endsWith(".yml") || n.endsWith(".yaml")).sort()
    : [];
  const etapes = [];
  for (const fichier of fichiers) {
    const contenu = readFileSync(join(dossierWorkflows, fichier), "utf8");
    for (const etape of extraireEtapes(contenu)) {
      if (!/git\s+clean|\brm\b/.test(etape.commande)) continue;
      const verdict = analyserCommandeNettoyage(etape.commande, {
        repertoire: etape.repertoireTravail,
      });
      etapes.push({ fichier, nom: etape.nom, commande: etape.commande, ...verdict });
    }
  }
  const refus = [];
  const avis = [];
  for (const e of etapes) {
    for (const c of e.refus) refus.push(`${e.fichier} — « ${e.nom} » : ${c.raison}`);
    for (const c of e.avis) avis.push(`${e.fichier} — « ${e.nom} » : ${c.raison}`);
  }
  const document = lireInventaireDocument(racine);
  if (document) {
    const code = new Set(INVENTAIRE.map((r) => r.dossier));
    const manquants = [...code].filter((d) => !document.includes(d));
    const enTrop = document.filter((d) => !code.has(d));
    if (manquants.length) refus.push(`docs/runners.md — runner(s) de l'inventaire absent(s) du document : ${manquants.join(", ")}`);
    if (enTrop.length) refus.push(`docs/runners.md — dossier(s) de runner dans le document mais pas dans l'inventaire : ${enTrop.join(", ")}`);
  }
  return { etapes, refus, avis };
}

// ---------------------------------------------------------------------------
// Constat sur les runners
// ---------------------------------------------------------------------------

/** Vérifie, sur un disque local, que chaque runner attendu est complet. */
export function verifierDossiersRunners(inventaire, base) {
  const presents = [];
  const manquants = [];
  for (const runner of inventaire) {
    const dossier = join(base, runner.dossier);
    const run = existsSync(join(dossier, "run.sh"));
    const identite = existsSync(join(dossier, ".runner"));
    if (run && identite) presents.push(runner.nom);
    else {
      const manque = [!run ? "run.sh" : null, !identite ? ".runner" : null].filter(Boolean).join(" et ");
      manquants.push(`${runner.nom} (${runner.dossier} : ${manque} absent)`);
    }
  }
  return { presents, manquants };
}

/** Commande distante, en lecture seule : un dossier de runner est-il complet ? */
function commandeDistante(inventaire) {
  const dossiers = inventaire.map((r) => r.dossier).join(" ");
  return `for d in ${dossiers}; do p="$HOME/$d";
  if [ -d "$p" ]; then
    r=oui; [ -f "$p/run.sh" ] || r=non;
    c=oui; [ -f "$p/.runner" ] || c=non;
    echo "$d|present|$r|$c";
  else
    echo "$d|absent|non|non";
  fi
done`;
}

/** Interroge la machine des runners en SSH, en lecture seule. */
export function interrogerRunnersLointains(inventaire, serveur = SERVEUR_PAR_DEFAUT) {
  const r = spawnSync(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", serveur, commandeDistante(inventaire)],
    { encoding: "utf8", timeout: DELAI_SSH_MS },
  );
  if (r.error || r.status !== 0) {
    return { joignable: false, etat: new Map(), raison: r.error ? r.error.message : `ssh a rendu ${r.status}` };
  }
  const etat = new Map();
  for (const ligne of String(r.stdout).split("\n")) {
    const [dossier, present, run, identite] = ligne.trim().split("|");
    if (!dossier) continue;
    etat.set(dossier, { present: present === "present", run: run === "oui", identite: identite === "oui" });
  }
  return { joignable: true, etat, raison: "" };
}

// ---------------------------------------------------------------------------
// Ligne de commande
// ---------------------------------------------------------------------------

/** Affiche l'état des runners, sur disque local et sur la machine distante. */
function afficherRunners(inventaire, racine, serveur, horsReseau) {
  const lignes = [];
  let manquant = 0;
  const locaux = inventaire.filter((r) => estMachineLocale(r.machine));
  const distants = inventaire.filter((r) => !estMachineLocale(r.machine));
  if (locaux.length) {
    const local = verifierDossiersRunners(locaux, racine === "." ? homedir() : racine);
    lignes.push(`runners — disque local (${homedir()}) : ${local.presents.length} présent(s), ${local.manquants.length} manquant(s)`);
    for (const m of local.manquants) lignes.push(`  ✗ ${m}`);
    manquant += local.manquants.length;
  }
  if (!distants.length) return { lignes, manquant };
  if (horsReseau) {
    lignes.push(`runners — machine distante « ${serveur} » : non consultée (--hors-reseau)`);
    return { lignes, manquant };
  }
  const distant = interrogerRunnersLointains(distants, serveur);
  if (!distant.joignable) {
    lignes.push(`runners — machine « ${serveur} » : non joignable (${distant.raison}) — état non constaté`);
    return { lignes, manquant };
  }
  lignes.push(`runners — machine « ${serveur} » (lecture seule) :`);
  for (const runner of distants) {
    const e = distant.etat.get(runner.dossier);
    if (!e) {
      manquant += 1;
      lignes.push(`  ✗ ${runner.nom} (${runner.dossier}) : absent de ${serveur}`);
      continue;
    }
    const complet = e.present && e.run && e.identite;
    if (!complet) manquant += 1;
    const detail = !e.present ? "dossier absent" : !e.run ? "run.sh absent" : !e.identite ? ".runner absent" : "complet";
    lignes.push(`  ${complet ? "✓" : "✗"} ${runner.nom} (${runner.dossier}) : ${detail}`);
  }
  return { lignes, manquant };
}

/** Le runner est-il sur cette machine ? (sinon : il est sur la machine distante) */
export function estMachineLocale(machine) {
  return String(machine).toLowerCase() === hostname().toLowerCase();
}

/** La première ligne de la commande qui nettoie vraiment (pour l'affichage). */
function ligneNettoyage(commande) {
  for (const l of String(commande).split("\n")) {
    const t = l.trim();
    if (/git\s+clean|\brm\s+-/.test(t)) return t;
  }
  return String(commande).split("\n")[0].trim();
}

/** Point d'entrée : le contrôle complet, et son code de sortie. */
export function main(argv = process.argv.slice(2)) {
  const args = argv.filter((a) => a !== "");
  const position = args.findIndex((a) => !a.startsWith("--"));
  const racine = resolve(position >= 0 ? args[position] : ".");
  const serveur = args.includes("--serveur") ? args[args.indexOf("--serveur") + 1] : SERVEUR_PAR_DEFAUT;
  const horsReseau = args.includes("--hors-reseau");
  const sortie = [];
  sortie.push(`contrôle de sécurité des runners — dépôt ${racine}`);
  const depot = analyserDepot(racine);
  sortie.push(`étapes de nettoyage listées : ${depot.etapes.length}`);
  for (const e of depot.etapes) {
    const etat = e.refus.length ? "REFUS" : e.avis.length ? "avis" : "ok";
    sortie.push(`  [${etat}] ${e.fichier} — « ${e.nom} » : ${ligneNettoyage(e.commande)}`);
  }
  for (const r of depot.refus) sortie.push(`  ✗ ${r}`);
  for (const a of depot.avis) sortie.push(`  · ${a}`);
  const runners = afficherRunners(INVENTAIRE, racine, serveur, horsReseau);
  for (const l of runners.lignes) sortie.push(l);
  const problemes = depot.refus.length + runners.manquant;
  sortie.push(problemes === 0 ? "VERDICT : rien à signaler" : `VERDICT : ${problemes} problème(s) à traiter`);
  process.stdout.write(`${sortie.join("\n")}\n`);
  return problemes === 0 ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exit(main());
}
