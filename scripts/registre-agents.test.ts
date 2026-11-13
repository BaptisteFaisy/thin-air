/**
 * Le registre des agents (`scripts/registre-agents.mjs`) exécuté pour de
 * vrai : un registre complet, un registre avec une entrée refusée, un
 * registre illisible, et le dépôt réel (qui n'a pas encore de registre).
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement —
 * `npx vitest run --config scripts/vitest.scripts.config.ts scripts/registre-agents.test.ts`
 * — et le script lui-même reste exécutable sans vitest :
 * `node scripts/registre-agents.mjs`.
 *
 * Aucun son, aucune requête réseau, rien d'écrit hors du dossier témoin :
 * les fixtures sont des JSON écrits dans un dossier temporaire.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "registre-agents.mjs");

/** Un registre complet : un agent en cours, un terminé, un abandonné, une reprise. */
const REGISTRE_COMPLET = {
  quota: {
    nom: "deux-par-lot",
    simultanes: 2,
    raison: "Deux agents suffisent à garder un worktree lisible par un humain.",
  },
  agents: [
    {
      nom: "registre-agents",
      lot: "lot/registre-agents",
      fichiers: ["scripts/registre-agents.mjs", "scripts/registre-agents.test.ts"],
      debut: "2026-11-12T09:00:00Z",
      fin: "2026-11-12T09:40:00Z",
      statut: "termine",
      commits: ["abc1234"],
      note: "quatre fichiers livrés",
    },
    {
      nom: "docs-methode",
      lot: "lot/registre-agents",
      fichiers: ["docs/methode-agents.md"],
      debut: "2026-11-12T09:05:00Z",
      fin: null,
      statut: "en_cours",
      commits: [],
      note: "en train de relire",
    },
    {
      nom: "vision-fige",
      lot: "lot/vision",
      fichiers: ["packages/vision/src/index.ts"],
      debut: "2026-11-12T09:10:00Z",
      fin: "2026-11-12T09:25:00Z",
      statut: "abandonne",
      commits: [],
      note: "aucun commit en 15 min, fournisseur figé",
    },
    {
      nom: "schema-reprise",
      lot: "lot/schema",
      fichiers: ["packages/schema/src/index.ts"],
      debut: "2026-11-12T09:15:00Z",
      fin: "2026-11-12T10:05:00Z",
      statut: "repris_main",
      commits: ["def5678"],
      reprise_minutes: 20,
      note: "repris à la main après l'abandon",
    },
  ],
};

let travail = "";

/** Un dossier témoin, et le chemin de son registre `out/agents.json`. */
function temoin(registre: unknown): string {
  const racine = mkdtempSync(join(tmpdir(), "registre-agents-"));
  mkdirSync(join(racine, "out"), { recursive: true });
  writeFileSync(join(racine, "out", "agents.json"), `${JSON.stringify(registre, null, 2)}\n`);
  return racine;
}

/** Lance le script sur un registre et rend son code de sortie et ses sorties. */
function lancer(racine: string, args: string[] = []): { code: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [SCRIPT, "--registre", join(racine, "out", "agents.json"), ...args], {
    cwd: racine,
    encoding: "utf8",
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

beforeEach(() => {
  travail = mkdtempSync(join(tmpdir(), "registre-agents-courant-"));
});

afterEach(() => {
  rmSync(travail, { recursive: true, force: true });
});

describe("le registre des agents en cours", () => {
  it("produit les quatre sections : en cours, abandons, reprises, coût", () => {
    const racine = temoin(REGISTRE_COMPLET);
    const r = lancer(racine);
    expect(r.code, r.stderr).toBe(0);

    const markdown = readFileSync(join(racine, "out", "registre-agents.md"), "utf8");
    expect(markdown).toContain("## Agents en cours (1)");
    expect(markdown).toContain("## Abandons (1)");
    expect(markdown).toContain("## Reprises manuelles (1)");
    expect(markdown).toContain("## Coût cumulé");
    expect(markdown).toContain("docs-methode");
    expect(markdown).toContain("vision-fige");
    expect(markdown).toContain("schema-reprise");
    rmSync(racine, { recursive: true, force: true });
  });

  it("annonce le quota nommé et sa raison", () => {
    const racine = temoin(REGISTRE_COMPLET);
    lancer(racine);
    const markdown = readFileSync(join(racine, "out", "registre-agents.md"), "utf8");
    expect(markdown).toContain("deux-par-lot");
    expect(markdown).toContain("2 agent(s) simultané(s)");
    rmSync(racine, { recursive: true, force: true });
  });

  it("cumule le temps de travail, le temps de reprise et les commits", () => {
    const racine = temoin(REGISTRE_COMPLET);
    lancer(racine);
    const markdown = readFileSync(join(racine, "out", "registre-agents.md"), "utf8");
    // 40 min (registre) + 15 min (abandonné) + 50 min (repris) = 105 min.
    expect(markdown).toContain("| Temps de travail | 105 min |");
    expect(markdown).toContain("| Temps de reprise manuelle | 20 min |");
    expect(markdown).toContain("| Reprises manuelles | 1 |");
    expect(markdown).toContain("| Abandons | 1 |");
    expect(markdown).toContain("| Commits produits | 2 |");
    rmSync(racine, { recursive: true, force: true });
  });

  it("refuse une entrée invalide en naming sa raison, et sort en code 1", () => {
    const racine = temoin({
      agents: [
        { nom: "bon", lot: "lot/a", fichiers: [], debut: "2026-11-12T09:00:00Z", statut: "en_cours", commits: [] },
        { nom: "mauvais", lot: "lot/a", fichiers: [], debut: "pas une date", statut: "en_cours", commits: [] },
      ],
    });
    const r = lancer(racine);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("« debut » absent ou illisible");
    expect(r.stderr).toContain("mauvais");

    const markdown = readFileSync(join(racine, "out", "registre-agents.md"), "utf8");
    expect(markdown).toContain("1 agent(s) retenu(s), 1 entrée(s) refusée(s)");
    expect(markdown).not.toContain("mauvais");
    rmSync(racine, { recursive: true, force: true });
  });

  it("sort en code 2 si le registre est illisible, sans rien écrire", () => {
    const racine = temoin({});
    writeFileSync(join(racine, "out", "agents.json"), "{ ce n'est pas du json");
    const r = lancer(racine);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("JSON illisible");
    rmSync(racine, { recursive: true, force: true });
  });

  it("sort en code 2 si le registre n'existe pas", () => {
    const r = lancer(travail);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("registre illisible");
  });

  it("est déterministe : deux runs, deux octets identiques", () => {
    const racine = temoin(REGISTRE_COMPLET);
    lancer(racine);
    const premier = readFileSync(join(racine, "out", "registre-agents.md"), "utf8");
    lancer(racine);
    expect(readFileSync(join(racine, "out", "registre-agents.md"), "utf8")).toBe(premier);
    rmSync(racine, { recursive: true, force: true });
  });

  it("n'écrit rien hors du dossier témoin", () => {
    const racine = temoin(REGISTRE_COMPLET);
    const avant = ["out"];
    lancer(racine);
    expect(readdirSync(racine).sort()).toEqual(avant);
    expect(readdirSync(join(racine, "out")).sort()).toEqual(["agents.json", "registre-agents.md"]);
    rmSync(racine, { recursive: true, force: true });
  });

  it("imprime le tableau sur la sortie standard avec --markdown", () => {
    const racine = temoin(REGISTRE_COMPLET);
    const r = lancer(racine, ["--markdown"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("# Registre des agents");
    expect(r.stdout).toContain("## Coût cumulé");
    rmSync(racine, { recursive: true, force: true });
  });
});
