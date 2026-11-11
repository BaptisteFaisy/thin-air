/**
 * Le script d'ingestion des prises réelles (lot N7), testé en processus
 * enfant — la commande exacte du non-développeur :
 *
 *   npx tsx scripts/prises-reelles.mjs <dossier> --machine <nom> --date <jour> --out <dossier>
 *
 * Quatre fixtures, les quatre cas du brief : une prise valide (rangée, nom
 * normalisé, mesure de côté levée), une prise invalide, une prise avec un
 * champ interdit, une prise trop lourde (refusée par le plafond de la garde
 * `take-privacy-guard`). Aucun son, aucun réseau : des fichiers et des codes
 * de sortie.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leftHandOnlyTake } from "@thin-air/core";
import type { Take } from "@thin-air/core";

const RACINE = process.cwd();
const SCRIPT = join(RACINE, "scripts", "prises-reelles.mjs");

function lancer(dossier: string, sortie: string): { status: number | null; stdout: string } {
  const resultat = spawnSync("npx", ["tsx", SCRIPT, dossier, "--machine", "test-fixture", "--date", "2026-11-12", "--out", sortie], {
    cwd: RACINE,
    encoding: "utf8",
    timeout: 120_000,
  });
  return { status: resultat.status, stdout: `${resultat.stdout ?? ""}${resultat.stderr ?? ""}` };
}

function priseValide(): Take {
  return leftHandOnlyTake({ durationS: 3, fps: 30 });
}

/** Une prise de forme valide mais trop lourde : le plafond de la garde parle. */
function priseTropLourde(): Take {
  const mainLourde = () => ({
    side: "left" as const,
    score: 0.9,
    points: Array.from({ length: 21 }, (_, i) => [
      0.123456789012345678 + i * 1e-9,
      0.987654321098765432 - i * 1e-9,
      0.111111111111111111 + i * 1e-9,
    ]) as [number, number, number][],
  });
  const frames = Array.from({ length: 30 }, (_, i) => ({
    t: i / 30,
    // Six mains : forme acceptée par le schéma, poids ≈ 227 Ko/s > plafond 150 Ko/s.
    hands: [mainLourde(), mainLourde(), mainLourde(), mainLourde(), mainLourde(), mainLourde()],
  }));
  return { format: "thin-air-take/1", fps: 30, frames };
}

describe("scripts/prises-reelles.mjs — l'ingestion en une commande (lot N7)", () => {
  it("dossier mélangé : la valide est rangée, les trois autres refusées avec leurs raisons", () => {
    const dossier = mkdtempSync(join(tmpdir(), "prises-melange-"));
    const sortie = mkdtempSync(join(tmpdir(), "prises-sortie-"));
    try {
      writeFileSync(join(dossier, "left-hand-only-take.json"), JSON.stringify(priseValide()));
      writeFileSync(join(dossier, "left-hand-only-cassee.json"), JSON.stringify({ ...priseValide(), fps: -5 }));
      writeFileSync(join(dossier, "reach-avec-image.json"), JSON.stringify({ ...priseValide(), image: "data:image/png;base64,AAAA" }));
      writeFileSync(join(dossier, "tremor-lourde.json"), JSON.stringify(priseTropLourde()));

      const { status, stdout } = lancer(dossier, sortie);
      expect(status).toBe(1); // des refus : le script le dit par son code
      // La valide : rangée sous le nom normalisé, et la mesure de côté levée.
      expect(existsSync(join(sortie, "left-hand-only-test-fixture-2026-11-12.json"))).toBe(true);
      expect(stdout).toContain("MESURE côté (§7.3)");
      expect(stdout).toContain("le modèle annonce « left »");
      // Les trois refus, chacun avec sa raison.
      expect(stdout).toContain("left-hand-only-cassee.json — prise invalide");
      expect(stdout).toContain("reach-avec-image.json — prise invalide");
      expect(stdout).toContain("tremor-lourde.json — garde take-privacy");
      expect(stdout).toContain("plafond 150000");
      expect(readdirSync(sortie).length).toBe(1);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
      rmSync(sortie, { recursive: true, force: true });
    }
  }, 120_000);

  it("une seule prise valide : code 0, contenu intact, nom normalisé", () => {
    const dossier = mkdtempSync(join(tmpdir(), "prises-seule-"));
    const sortie = mkdtempSync(join(tmpdir(), "prises-sortie2-"));
    try {
      mkdirSync(dossier, { recursive: true });
      writeFileSync(join(dossier, "tremor-take.json"), JSON.stringify(priseValide()));
      const { status, stdout } = lancer(dossier, sortie);
      expect(status).toBe(0);
      expect(stdout).toContain("1 prise(s) rangée(s), 0 refus");
      const rangee = JSON.parse(readFileSync(join(sortie, "tremor-test-fixture-2026-11-12.json"), "utf8")) as Take;
      expect(rangee.frames.length).toBe(priseValide().frames.length);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
      rmSync(sortie, { recursive: true, force: true });
    }
  }, 120_000);

  it("un fichier qui n'est pas une prise du mode : refus clair, pas de devinette", () => {
    const dossier = mkdtempSync(join(tmpdir(), "prises-inconnu-"));
    const sortie = mkdtempSync(join(tmpdir(), "prises-sortie3-"));
    try {
      writeFileSync(join(dossier, "notes-de-reunion.json"), JSON.stringify({ texte: "rien à voir" }));
      const { status, stdout } = lancer(dossier, sortie);
      expect(status).toBe(1);
      expect(stdout).toContain("nom illisible");
      expect(readdirSync(sortie).length).toBe(0);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
      rmSync(sortie, { recursive: true, force: true });
    }
  }, 120_000);
});
