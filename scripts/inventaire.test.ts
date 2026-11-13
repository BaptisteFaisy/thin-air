/**
 * L'inventaire (`scripts/inventaire.mjs`) sur des fixtures : un dépôt témoin
 * avec une branche mergée, une non mergée, deux worktrees, un dossier
 * orphelin, un runner caché dans un worktree et un modèle dans un autre.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement, comme
 * `scripts/check-runner-safety.test.ts` —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/inventaire.test.ts`
 * — et le script lui-même reste exécutable sans vitest :
 * `node scripts/inventaire.mjs`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const RACINE_DEPOT = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE_DEPOT, "scripts", "inventaire.mjs");

const inventaire = (await import("./inventaire.mjs")) as unknown as {
  tailleLisible: (n: number) => string;
  contenusRemarquables: (racine: string) => { runners: string[]; modeles: string[] };
  listerWorktrees: (racine: string) => { chemin: string; branche: string | null; principal: boolean }[];
  listerBranches: (racine: string, base: string) => { nom: string; merges: boolean; nonMerges: number | null }[];
  listerOrphelins: (racine: string, worktrees: unknown[]) => { nom: string; aGit: boolean }[];
  planNettoyage: (worktrees: unknown[], branches: unknown[], orphelins: unknown[]) => { cible: string; action: string }[];
};

const temp = [] as string[];

/** `git …` qui échoue fort si la commande renvoie un code non nul. */
function git(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} : ${r.stderr}`);
  return r.stdout.trim();
}

/** Ajoute un commit sur la branche courante. */
function commiter(cwd: string, nom: string, contenu: string) {
  writeFileSync(join(cwd, nom), contenu);
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", nom]);
}

/**
 * Un dépôt témoin complet : `thin-air/` (principal) + `thin-air-wt/` (liés),
 * avec `origin` en bare, une branche mergée, une non mergée, deux worktrees
 * (un porteur de runner, un porteur de modèle) et un dossier orphelin.
 */
function creerDepot() {
  const dir = mkdtempSync(join(tmpdir(), "inventaire-"));
  temp.push(dir);
  const racine = join(dir, "thin-air");
  const bare = join(dir, "origin.git");
  mkdirSync(racine, { recursive: true });
  mkdirSync(bare, { recursive: true });
  git(bare, ["init", "--bare"]);
  git(racine, ["init"]);
  git(racine, ["config", "user.email", "fixture@example.com"]);
  git(racine, ["config", "user.name", "fixture"]);
  git(racine, ["remote", "add", "origin", bare]);
  commiter(racine, "README.md", "# fixture\n");
  git(racine, ["branch", "-M", "main"]);
  git(racine, ["push", "-u", "origin", "main"]);

  git(racine, ["checkout", "-b", "lot/merges"]);
  commiter(racine, "merges.txt", "x\n");
  git(racine, ["push", "-u", "origin", "lot/merges"]);
  git(racine, ["checkout", "main"]);
  git(racine, ["merge", "--no-ff", "lot/merges", "-m", "fusion lot/merges"]);
  git(racine, ["push", "origin", "main"]);

  git(racine, ["checkout", "-b", "lot/non-merges"]);
  commiter(racine, "non-merges.txt", "x\n");
  git(racine, ["push", "-u", "origin", "lot/non-merges"]);
  git(racine, ["checkout", "main"]);

  const wt = join(dir, "thin-air-wt");
  mkdirSync(wt, { recursive: true });
  const avecRunner = join(wt, "avec-runner");
  const avecModele = join(wt, "avec-modele");
  git(racine, ["worktree", "add", "--detach", avecRunner, "origin/lot/non-merges"]);
  git(racine, ["worktree", "add", avecModele, "lot/merges"]);
  mkdirSync(join(avecRunner, "actions-runner-fixture-01"), { recursive: true });
  writeFileSync(join(avecRunner, "actions-runner-fixture-01", ".runner"), "agent\n");
  mkdirSync(join(avecModele, "public", "models"), { recursive: true });
  writeFileSync(join(avecModele, "public", "models", "hand_landmarker.task"), "modele\n");

  mkdirSync(join(wt, "orphelin"), { recursive: true });
  writeFileSync(join(wt, "orphelin", ".git"), "gitdir: /inexistant\n");
  return { racine, wt };
}

/** Exécute le script sur la racine donnée, capture sortie et code. */
function lancer(racine: string, extra: string[] = []) {
  return spawnSync(process.execPath, [SCRIPT, racine, ...extra], { encoding: "utf8" });
}

afterEach(() => {
  // Nettoyage du dépôt témoin ; `git worktree remove` n'est pas requise car
  // le dossier temporaire entier est recréé à chaque test.
  for (const d of temp.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* dossier déjà parti */
    }
  }
});

describe("tailleLisible", () => {
  it("formate les octets, ko et Mo", () => {
    expect(inventaire.tailleLisible(0)).toBe("0 o");
    expect(inventaire.tailleLisible(512)).toBe("512 o");
    expect(inventaire.tailleLisible(2048)).toBe("2.0 Ko");
    expect(inventaire.tailleLisible(5 * 1024 * 1024)).toBe("5.0 Mo");
  });
});

describe("contenusRemarquables", () => {
  it("repère un dossier de runner et un fichier de modèle", () => {
    const d = mkdtempSync(join(tmpdir(), "remarquable-"));
    temp.push(d);
    mkdirSync(join(d, "actions-runner-x"), { recursive: true });
    writeFileSync(join(d, "actions-runner-x", ".runner"), "agent\n");
    mkdirSync(join(d, "public", "models"), { recursive: true });
    writeFileSync(join(d, "public", "models", "hand_landmarker.task"), "m\n");
    const r = inventaire.contenusRemarquables(d);
    expect(r.runners).toContain("actions-runner-x/");
    expect(r.modeles).toEqual(expect.arrayContaining(["public/models/", "public/models/hand_landmarker.task"]));
  });

  it("ne signale rien sur un dossier ordinaire", () => {
    const d = mkdtempSync(join(tmpdir(), "remarquable-vide-"));
    temp.push(d);
    writeFileSync(join(d, "README.md"), "# rien\n");
    expect(inventaire.contenusRemarquables(d)).toEqual({ runners: [], modeles: [] });
  });
});

describe("sur le dépôt témoin", () => {
  it("liste worktrees, branches mergées/non mergées, orphelins et plan", () => {
    const { racine, wt } = creerDepot();
    const worktrees = inventaire.listerWorktrees(racine);
    const branches = inventaire.listerBranches(racine, "origin/main");
    expect(worktrees.length).toBe(3); // principal + 2 liés
    const merges = branches.find((b) => b.nom === "origin/lot/merges");
    const nonMerges = branches.find((b) => b.nom === "origin/lot/non-merges");
    expect(merges?.merges).toBe(true);
    expect(merges?.nonMerges).toBe(0);
    expect(nonMerges?.merges).toBe(false);
    expect(nonMerges?.nonMerges).toBe(1);

    const orphelins = inventaire.listerOrphelins(racine, worktrees);
    expect(orphelins.map((o) => o.nom)).toContain("orphelin");

    const plan = inventaire.planNettoyage(worktrees, branches, orphelins);
    expect(plan.some((p) => p.cible === "branche lot/merges")).toBe(true);
    expect(plan.some((p) => p.cible.includes("orphelin"))).toBe(true);
    expect(readdirSync(wt).length).toBe(3); // deux worktrees + un orphelin
  });

  it("sort en 1 s'il y a un runner dans un worktree", () => {
    const { racine } = creerDepot();
    const r = lancer(racine);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("RUNNER: actions-runner-fixture-01/");
    expect(r.stderr).toContain("avec-runner");
  });

  it("sort en 0 après retrait du runner, en signalant le modèle", () => {
    const { racine } = creerDepot();
    const wt = join(join(racine, ".."), "thin-air-wt");
    rmSync(join(wt, "avec-runner", "actions-runner-fixture-01"), { recursive: true, force: true });
    const r = lancer(racine);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("modèle:");
    expect(r.stdout).toContain("hand_landmarker.task");
  });
});