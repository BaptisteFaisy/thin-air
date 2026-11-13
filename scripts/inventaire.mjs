#!/usr/bin/env node
/**
 * Inventaire du dépôt : worktrees, branches distantes, orphelins, runners.
 *
 * Trois constats, dans un seul passage, sans rien déplacer ni supprimer :
 *
 *  1. **Les worktrees** — chaque worktree enregistré (`git worktree list`)
 *     avec son chemin, sa branche, son dernier commit, son état (modifié ou
 *     non) et sa taille. Un worktree peut aussi contenir un dossier de runner
 *     (`actions-runner-*`, `_work*`, `.runner`, `Runner.Listener`) ou un
 *     fichier de modèle (`.task`, `.tflite`, `hand_landmarker.task`,
 *     `vision_wasm_internal.wasm`) : c'est signalé, et le script sort en 1 si
 *     un dossier de runner vit dans un worktree — c'est une catastrophe qui
 *     attend (`git clean -ffdx` dans le workspace du runner). La règle est
 *     dans `docs/runners.md`.
 *
 *  2. **Les branches distantes** — dernière modification, date, mergée ou non
 *     dans la base, et nombre de commits non mergés. Les branches
 *     `mergify/merge-queue/*` (éphémères) sont comptées à part.
 *
 *  3. **Les worktrees orphelins** — un dossier sous la racine des worktrees
 *     qui n'est plus enregistré dans `git worktree list` : un reste, ou pire,
 *     un worktree dont le `.git` a été effacé par un nettoyage trop large.
 *
 * Le plan de nettoyage ne supprime rien : chaque ligne est une proposition à
 * confirmer par un humain, jamais une commande exécutée.
 *
 * Usage : `node scripts/inventaire.mjs [racine] [--base branche]`
 *   - `racine` : dépôt à inventorier (défaut : le dossier courant).
 *   - `--base` : branche de référence pour « mergée ou non » (défaut :
 *     `origin/main`) ; un dépôt témoin peut passer `--base main`.
 *
 * Codes de sortie : 0 = rapport rendu, 1 = un dossier de runner est dans un
 * worktree, 2 = usage incorrect.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Signaux remarquables
// ---------------------------------------------------------------------------

/** Un dossier de runner : le workspace persistant d'un runner self-hosted. */
const SIGNAUX_DOSSIER_RUNNER = [/^actions-runner-/];
/** Le dossier de travail d'un runner (`_work`, `_work04`, …). */
const SIGNAUX_DOSSIER_WORK = [/^_work/];
/** Les fichiers d'identité d'un dossier de runner. */
const FICHIERS_RUNNER = new Set([".runner", "Runner.Listener"]);
/** Extensions de modèle de vision (non versionnées, `public/models/`). */
const EXTENSIONS_MODELE = new Set([".task", ".tflite"]);
/** Noms de modèle de vision précis. */
const NOMS_MODELE = new Set(["hand_landmarker.task", "vision_wasm_internal.wasm"]);

const IGNORES_PARCOURS = new Set([".git", "node_modules"]);
const PROFONDEUR_MAX = 10;
const SEPARATEUR = "  ";

// ---------------------------------------------------------------------------
// Git et système
// ---------------------------------------------------------------------------

/** Un appel de processus, en UTF-8, avec un tampon qui encaisse les gros logs. */
function executer(command, args, cwd) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  return { code: r.status ?? 1, sortie: r.stdout ?? "", erreur: r.stderr ?? "" };
}

/** `git …` dans le dossier donné. */
function git(cwd, args) {
  return executer("git", args, cwd);
}

/** Découpe une sortie en lignes non vides, sans espaces parasites. */
function lignes(texte) {
  return String(texte).split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Formatte un nombre d'octets en une taille lisible. */
export function tailleLisible(octets) {
  if (octets <= 0) return "0 o";
  const unites = ["o", "Ko", "Mo", "Go", "To"];
  let n = octets;
  let i = 0;
  while (n >= 1024 && i < unites.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${unites[i]}`;
}

// ---------------------------------------------------------------------------
// Worktrees
// ---------------------------------------------------------------------------

/** Parse `git worktree list --porcelain` en enregistrements. */
export function listerWorktrees(racine) {
  const r = git(racine, ["worktree", "list", "--porcelain"]);
  if (r.code !== 0) return [];
  const resultats = [];
  let courant = null;
  for (const ligne of r.sortie.split("\n")) {
    if (ligne.startsWith("worktree ")) {
      if (courant) resultats.push(courant);
      courant = { chemin: ligne.slice(9).trim(), head: "", branche: null };
    } else if (courant && ligne.startsWith("HEAD ")) {
      courant.head = ligne.slice(5).trim();
    } else if (courant && ligne.startsWith("branch ")) {
      courant.branche = ligne.slice(7).trim().replace(/^refs\/heads\//, "");
    }
  }
  if (courant) resultats.push(courant);
  return resultats.map((w) => ({ ...w, principal: estPrincipal(w.chemin) }));
}

/** Le worktree principal a un vrai dossier `.git` ; les liés, un fichier. */
function estPrincipal(chemin) {
  try {
    return statSync(join(chemin, ".git")).isDirectory();
  } catch {
    return false;
  }
}

/** Le dernier commit d'un chemin : `{ hash, date, sujet }`. */
function dernierCommit(chemin) {
  const r = git(chemin, ["log", "-1", "--format=%h%x09%cI%x09%s"]);
  if (r.code !== 0) return { hash: "?", date: "?", sujet: "?" };
  const [hash, date, sujet] = r.sortie.trim().split("\t");
  return { hash: hash ?? "?", date: date ?? "?", sujet: sujet ?? "?" };
}

/** Vrai si `git status --porcelain` rend quelque chose. */
function travailSale(chemin) {
  const r = git(chemin, ["status", "--porcelain"]);
  return r.code === 0 && r.sortie.trim() !== "";
}

/** Somme des octets des fichiers d'un dossier (`.git`, symlinks exclus). */
function tailleOctets(chemin) {
  let total = 0;
  const visiter = (dossier) => {
    let entrees;
    try {
      entrees = readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      if (IGNORES_PARCOURS.has(e.name)) continue;
      const c = join(dossier, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) visiter(c);
      else if (e.isFile()) {
        try {
          total += statSync(c).size;
        } catch {
          /* fichier disparu pendant la mesure : ignoré */
        }
      }
    }
  };
  visiter(chemin);
  return total;
}

/**
 * Les contenus remarquables d'un worktree : dossiers de runner et fichiers
 * de modèle, en chemins relatifs au worktree, dédupliqués et triés.
 */
export function contenusRemarquables(racineWorktree) {
  const runners = new Set();
  const modeles = new Set();
  const visiter = (dossier, profondeur) => {
    if (profondeur > PROFONDEUR_MAX) return;
    let entrees;
    try {
      entrees = readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    const iciPublic = basename(dossier) === "public";
    for (const e of entrees) {
      if (IGNORES_PARCOURS.has(e.name)) continue;
      const chemin = join(dossier, e.name);
      const rel = relative(racineWorktree, chemin);
      if (e.isDirectory()) {
        if (SIGNAUX_DOSSIER_RUNNER.some((r) => r.test(e.name))) runners.add(`${rel}/`);
        if (SIGNAUX_DOSSIER_WORK.some((r) => r.test(e.name))) runners.add(`${rel}/`);
        if (e.name === "models" && iciPublic) modeles.add(`${rel}/`);
        visiter(chemin, profondeur + 1);
      } else {
        if (FICHIERS_RUNNER.has(e.name)) runners.add(rel);
        const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
        if (EXTENSIONS_MODELE.has(ext) || NOMS_MODELE.has(e.name)) modeles.add(rel);
      }
    }
  };
  visiter(racineWorktree, 0);
  return { runners: [...runners].sort(), modeles: [...modeles].sort() };
}

/** La racine commune des worktrees liés (le dossier `thin-air-wt`). */
export function racineDesWorktrees(racine, worktrees) {
  const lies = worktrees.filter((w) => !w.principal);
  if (lies.length > 0) return dirname(resolve(lies[0].chemin));
  return join(dirname(resolve(racine)), `${basename(resolve(racine))}-wt`);
}

/** Les dossiers sous la racine des worktrees qui ne sont plus enregistrés. */
export function listerOrphelins(racine, worktrees) {
  const racineWt = racineDesWorktrees(racine, worktrees);
  if (!existsSync(racineWt)) return [];
  const enregistres = new Set(worktrees.map((w) => basename(w.chemin)));
  const orphelins = [];
  for (const e of readdirSync(racineWt, { withFileTypes: true })) {
    if (!e.isDirectory() || enregistres.has(e.name)) continue;
    orphelins.push({ nom: e.name, chemin: join(racineWt, e.name), aGit: existsSync(join(racineWt, e.name, ".git")) });
  }
  return orphelins;
}

// ---------------------------------------------------------------------------
// Branches distantes
// ---------------------------------------------------------------------------

/** Les branches distantes, leur état face à la base. */
export function listerBranches(racine, base) {
  const liste = git(racine, ["branch", "-r", "--no-abbrev"]);
  const noms = lignes(liste.sortie).filter((n) => !n.includes("HEAD"));
  const merges = new Set(lignes(git(racine, ["branch", "-r", "--merged", base]).sortie));
  return noms.map((nom) => {
    const info = git(racine, ["log", "-1", "--format=%h%x09%cI%x09%s", nom]).sortie.trim().split("\t");
    const m = merges.has(nom);
    return {
      nom,
      hash: info[0] ?? "?",
      date: info[1] ?? "?",
      merges: m,
      nonMerges: m ? 0 : compterNonMerges(racine, base, nom),
    };
  });
}

/** Nombre de commits de la branche absents de la base (null = non calculable). */
function compterNonMerges(racine, base, branche) {
  const r = git(racine, ["rev-list", "--count", `${base}..${branche}`]);
  if (r.code !== 0) return null;
  const n = Number.parseInt(r.sortie.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Plan de nettoyage (jamais de suppression automatique)
// ---------------------------------------------------------------------------

/** Propositions sûres, triées, sans jamais rien exécuter. */
export function planNettoyage(worktrees, branches, orphelins) {
  const plan = [];
  const mergees = new Set(
    branches.filter((b) => b.merges).map((b) => b.nom),
  );
  for (const b of branches) {
    if (!b.merges || b.nom === "origin/main") continue;
    plan.push({ cible: `branche ${b.nom.replace(/^origin\//, "")}`, action: "suppression suggérée", raison: "mergée dans la base" });
  }
  for (const w of worktrees) {
    if (w.principal) continue;
    const cible = `worktree ${basename(w.chemin)}`;
    if (w.branche && mergees.has(`origin/${w.branche}`)) {
      plan.push({ cible, action: "retrait suggéré", raison: `branche ${w.branche} déjà mergée` });
    } else if (w.branche && !branches.some((b) => b.nom === `origin/${w.branche}`)) {
      plan.push({ cible, action: "à inspecter", raison: `branche ${w.branche} absente du distant` });
    } else if (!w.branche) {
      plan.push({ cible, action: "à inspecter", raison: "HEAD détaché" });
    }
  }
  for (const o of orphelins) {
    plan.push({
      cible: `dossier orphelin ${o.nom}`,
      action: "à inspecter",
      raison: o.aGit ? "a encore un `.git`" : "sans `.git` (nettoyage trop large ?)",
    });
  }
  return plan.sort((a, b) => a.cible.localeCompare(b.cible));
}

// ---------------------------------------------------------------------------
// Tableaux
// ---------------------------------------------------------------------------

/** Colonnes alignées sur les largeurs calculées. */
function table(lignesTable) {
  const largeurs = lignesTable[0].map((_, c) =>
    Math.max(...lignesTable.map((l) => String(l[c] ?? "").length)),
  );
  return lignesTable.map((l) => l.map((c, i) => String(c ?? "").padEnd(largeurs[i])).join(SEPARATEUR)).join("\n");
}

// ---------------------------------------------------------------------------
// Rapport et principal
// ---------------------------------------------------------------------------

/** L'état d'un worktree prêt à afficher (et à signaler). */
function decrireWorktree(w) {
  const info = dernierCommit(w.chemin);
  const modifie = travailSale(w.chemin);
  const taille = tailleLisible(tailleOctets(w.chemin));
  const remake = contenusRemarquables(w.chemin);
  const note = [];
  if (modifie) note.push("modifié");
  if (remake.runners.length > 0) note.push(`RUNNER: ${remake.runners.join(", ")}`);
  if (remake.modeles.length > 0) note.push(`modèle: ${remake.modeles.join(", ")}`);
  return {
    chemin: basename(w.chemin),
    branche: w.branche ?? "(détaché)",
    commit: `${info.hash} ${info.date.slice(0, 10)}`,
    modifie: modifie ? "oui" : "non",
    taille,
    note: note.join(" ; "),
    runners: remake.runners,
  };
}

/** Le rapport complet, prêt à être relu (et collé dans `docs/inventaire.md`). */
/** Les arguments : `[racine] [--base branche]`. */
export function analyserArgs(args) {
  let racine = process.cwd();
  let base = "origin/main";
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--base") {
      base = args[i + 1] ?? base;
      i += 1;
    } else if (!a.startsWith("-")) {
      racine = a;
    }
  }
  return { racine, base };
}

/** La section « Worktrees » du rapport. */
function sectionWorktrees(descriptions) {
  const corps = table([
    ["chemin", "branche", "commit", "modifié", "taille", "note"],
    ...descriptions.map((d) => [d.chemin, d.branche, d.commit, d.modifie, d.taille, d.note]),
  ])
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n");
  return ["## Worktrees", "", corps];
}

/** La section « Branches distantes » du rapport. */
function sectionBranches(utiles, mergeQueue) {
  const corps = table([
    ["branche", "commit", "date", "mergée", "non mergés"],
    ...utiles.map((b) => [
      b.nom.replace(/^origin\//, ""),
      b.hash,
      String(b.date).slice(0, 10),
      b.merges ? "oui" : "non",
      String(b.nonMerges ?? "?"),
    ]),
  ]);
  const fin = mergeQueue.length > 0 ? [`${mergeQueue.length} branche(s) merge-queue (éphémères, non détaillées).`] : [];
  return ["## Branches distantes", "", corps, "", ...fin];
}

/** La section « Worktrees orphelins » du rapport. */
function sectionOrphelins(orphelins) {
  const corps =
    orphelins.length === 0
      ? "aucun"
      : table([["dossier", "état"], ...orphelins.map((o) => [o.nom, o.aGit ? "a un `.git`" : "sans `.git`"])]);
  return ["## Worktrees orphelins", "", corps];
}

/** La section « Plan de nettoyage » du rapport — des propositions, rien d'autre. */
function sectionPlan(worktrees, branches, orphelins) {
  const plan = planNettoyage(worktrees, branches, orphelins);
  const corps =
    plan.length === 0
      ? "rien à proposer"
      : table([["cible", "action", "raison"], ...plan.map((p) => [p.cible, p.action, p.raison])]);
  return ["## Plan de nettoyage (propositions, aucune suppression automatique)", "", corps];
}

/**
 * Le programme principal : rassemble tout, écrit le rapport, rend le code.
 * 0 = rapport, 1 = un dossier de runner est dans un worktree, 2 = usage.
 */
export function principal(args = process.argv.slice(2)) {
  const { racine, base } = analyserArgs(args);
  if (git(racine, ["rev-parse", "--is-inside-work-tree"]).code !== 0) {
    process.stderr.write(`inventaire : ${racine} n'est pas dans un dépôt git\n`);
    return 2;
  }
  const worktrees = listerWorktrees(racine);
  const lies = worktrees.filter((w) => !w.principal);
  const branches = listerBranches(racine, base);
  const orphelins = listerOrphelins(racine, worktrees);
  const mergeQueue = branches.filter((b) => b.nom.includes("mergify/merge-queue"));
  const utiles = branches.filter((b) => !b.nom.includes("mergify/merge-queue"));
  const mortes = branches.filter((b) => !b.merges && !b.nom.includes("mergify/merge-queue"));

  const descriptions = lies.map((w) => decrireWorktree(w));
  const signales = descriptions.filter((d) => d.runners.length > 0);
  const entete = [
    `# Inventaire du dépôt — ${new Date().toISOString().slice(0, 10)}`,
    "",
    `worktrees enregistrés : ${lies.length} (+ le principal)`,
    `branches distantes : ${branches.length} (dont ${mergeQueue.length} merge-queue, éphémères)`,
    `branches non mergées dans ${base} : ${mortes.length}`,
    `worktrees orphelins : ${orphelins.length}`,
    "",
  ];
  const sortie = [
    ...entete,
    ...sectionWorktrees(descriptions),
    "",
    ...sectionBranches(utiles, mergeQueue),
    "",
    ...sectionOrphelins(orphelins),
    "",
    ...sectionPlan(worktrees, branches, orphelins),
  ];

  process.stdout.write(`${sortie.join("\n")}\n`);
  if (signales.length > 0) {
    for (const s of signales) process.stderr.write(`dossier de runner dans le worktree ${s.chemin} : ${s.runners.join(", ")}\n`);
    return 1;
  }
  return 0;
}

// Exécution directe : `node scripts/inventaire.mjs`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(principal());
}
