/**
 * Le contrôle de sécurité des runners (`scripts/check-runner-safety.mjs`),
 * sur des fixtures : un motif de nettoyage dangereux, un motif sain, un
 * runner déclaré mais absent.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance donc explicitement, comme
 * `scripts/pack-check.test.ts` —
 * `npx vitest run --config <config incluant scripts/**> scripts/check-runner-safety.test.ts`
 * — et le contrôle lui-même reste exécutable sans vitest :
 * `node scripts/check-runner-safety.mjs`.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface Runner {
  nom: string;
  depot: string;
  machine: string;
  dossier: string;
}

interface Contexte {
  repertoire?: string;
  maison?: string;
}

interface Verdict {
  refus: { motif: string; raison: string }[];
  avis: { motif: string; raison: string }[];
  motifs: string[];
}

interface Depot {
  etapes: { fichier: string; nom: string; commande: string }[];
  refus: string[];
  avis: string[];
}

// Le script est du Node pur (`.mjs`) : pas de déclarations de types.
const controle = (await import("./check-runner-safety.mjs")) as unknown as {
  INVENTAIRE: Runner[];
  analyserCommandeNettoyage: (commande: string, contexte?: Contexte) => Verdict;
  analyserDepot: (racine: string) => Depot;
  verifierDossiersRunners: (
    inventaire: Runner[],
    base: string,
  ) => { presents: string[]; manquants: string[] };
};

/** Un dépôt témoin : un seul workflow, le contenu donné. */
function temoin(workflow: string): string {
  const racine = mkdtempSync(join(tmpdir(), "runner-safety-"));
  mkdirSync(join(racine, ".github", "workflows"), { recursive: true });
  writeFileSync(join(racine, ".github", "workflows", "ci.yml"), workflow);
  return racine;
}

/** Un dossier de runner : `run.sh` et `.runner` selon le besoin. */
function runner(base: string, dossier: string, pieces: { run?: boolean; identite?: boolean } = {}): void {
  mkdirSync(join(base, dossier), { recursive: true });
  if (pieces.run !== false) writeFileSync(join(base, dossier, "run.sh"), "#!/bin/bash\n");
  if (pieces.identite !== false) writeFileSync(join(base, dossier, ".runner"), "{}\n");
}

const WORKFLOW_DANGEREUX = `name: ci
on: [push]
jobs:
  ci:
    runs-on: [self-hosted, linux, x64, thin-air-worker]
    steps:
      - name: Nettoyage
        run: git clean -ffdx
`;

const WORKFLOW_SAIN = `name: ci
on: [push]
jobs:
  ci:
    runs-on: [self-hosted, linux, x64, thin-air-worker]
    steps:
      - name: Nettoyage
        run: git clean -ffdx -e node_modules -e 'actions-runner-*'
`;

describe("check-runner-safety.mjs — les motifs de nettoyage", () => {
  it("refuse un `git clean -ffdx` sans exclusion", () => {
    const v = controle.analyserCommandeNettoyage("git clean -ffdx");
    expect(v.refus).toHaveLength(1);
    expect(v.refus[0]?.raison).toMatch(/aucune exclusion/);
  });

  it("accepte un `git clean` avec exclusion, hors dossier de runner", () => {
    const v = controle.analyserCommandeNettoyage("git clean -ffdx -e node_modules", {
      repertoire: "apps/web",
    });
    expect(v.refus).toHaveLength(0);
  });

  it("refuse une exclusion qui protège les dossiers de runner", () => {
    const v = controle.analyserCommandeNettoyage("git clean -ffdx -e node_modules -e 'actions-runner-*'");
    expect(v.refus).toHaveLength(0);
    expect(v.avis).toHaveLength(0);
  });

  it("refuse un `rm -rf` qui vise un dossier de runner", () => {
    const v = controle.analyserCommandeNettoyage("rm -rf ~/actions-runner-thin-air-04");
    expect(v.refus).toHaveLength(1);
    expect(v.refus[0]?.raison).toMatch(/dossier de runner/);
  });

  it("refuse un `rm -rf` qui vise la maison (où vivent les runners)", () => {
    const v = controle.analyserCommandeNettoyage("rm -rf $HOME/actions-runner-*");
    expect(v.refus.length).toBeGreaterThan(0);
  });

  it("laisse passer un `rm -rf` relatif au workspace", () => {
    const v = controle.analyserCommandeNettoyage("rm -rf repo");
    expect(v.refus).toHaveLength(0);
  });
});

describe("check-runner-safety.mjs — le dépôt", () => {
  it("signale un workflow dont le nettoyage peut effacer un runner", () => {
    const d = controle.analyserDepot(temoin(WORKFLOW_DANGEREUX));
    expect(d.refus.length).toBeGreaterThan(0);
    expect(d.refus[0]).toMatch(/ci\.yml/);
  });

  it("accepte un workflow qui exclut les dossiers de runner", () => {
    const d = controle.analyserDepot(temoin(WORKFLOW_SAIN));
    expect(d.refus).toHaveLength(0);
    expect(d.avis).toHaveLength(0);
  });

  it("liste les étapes de nettoyage qu'il a vues", () => {
    const d = controle.analyserDepot(temoin(WORKFLOW_SAIN));
    expect(d.etapes).toHaveLength(1);
    expect(d.etapes[0]?.nom).toBe("Nettoyage");
  });
});

describe("check-runner-safety.mjs — les runners", () => {
  const inventaire: Runner[] = [
    {
      nom: "r630-thin-air-04",
      depot: "BaptisteFaisy/thin-air",
      machine: "r630",
      dossier: "actions-runner-thin-air-04",
    },
  ];

  it("signale un runner déclaré mais absent", () => {
    const base = mkdtempSync(join(tmpdir(), "runner-safety-"));
    const r = controle.verifierDossiersRunners(inventaire, base);
    expect(r.presents).toHaveLength(0);
    expect(r.manquants).toHaveLength(1);
    expect(r.manquants[0]).toMatch(/r630-thin-air-04/);
  });

  it("signale un runner dont le `run.sh` a disparu", () => {
    const base = mkdtempSync(join(tmpdir(), "runner-safety-"));
    runner(base, "actions-runner-thin-air-04", { run: false });
    const r = controle.verifierDossiersRunners(inventaire, base);
    expect(r.manquants).toHaveLength(1);
    expect(r.manquants[0]).toMatch(/run\.sh/);
  });

  it("accepte un runner complet (run.sh et .runner)", () => {
    const base = mkdtempSync(join(tmpdir(), "runner-safety-"));
    runner(base, "actions-runner-thin-air-04");
    const r = controle.verifierDossiersRunners(inventaire, base);
    expect(r.manquants).toHaveLength(0);
    expect(r.presents).toEqual(["r630-thin-air-04"]);
  });

  it("inventorie le runner de ce dépôt", () => {
    expect(controle.INVENTAIRE.map((r) => r.dossier)).toContain("actions-runner-thin-air-04");
    expect(controle.INVENTAIRE[0]?.depot).toBe("BaptisteFaisy/thin-air");
  });
});
