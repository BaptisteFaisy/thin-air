/**
 * Le banc de l'exemple « premier instrument » : il exécute `index.ts` pour de
 * vrai — comme le ferait un tiers — et vérifie les trois nombres imprimés,
 * l'écriture du WAV, et qu'aucun son ni aucun fichier hors de `out/` n'a lieu.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) : ce banc vit dans
 * `exemples/` et n'est ramassé que par le projet `exemples` déclaré dans
 * `vitest.workspace.ts`, sans rien modifier d'autre.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeWav } from "@thin-air/audio";

const RACINE = fileURLToPath(new URL("../..", import.meta.url));
const EXEMPLE = join(RACINE, "exemples", "premier-instrument", "index.ts");
const SOURCES = readFileSync(EXEMPLE, "utf8");

/** Le `cli.mjs` de tsx, résolu dans le `node_modules` du dépôt. */
function cheminTsx(): string {
  const paquet = createRequire(import.meta.url).resolve("tsx/package.json");
  return join(dirname(paquet), "dist", "cli.mjs");
}

/** Les fichiers d'un dossier, sous forme de chemins relatifs triés. */
function liste(dossier: string): string[] {
  const sortie: string[] = [];
  const parcourir = (courant: string) => {
    for (const entree of readdirSync(courant, { withFileTypes: true })) {
      const chemin = join(courant, entree.name);
      sortie.push(chemin.slice(dossier.length + 1));
      if (entree.isDirectory()) parcourir(chemin);
    }
  };
  parcourir(dossier);
  return sortie.sort();
}

/** Les trois nombres de la sortie, dans l'ordre d'impression. */
function troisNombres(sortie: string): { hz: number; cents: number; db: number } {
  const chercher = (libelle: string) => {
    const trouve = sortie.match(new RegExp(`${libelle}\\s*:\\s*(-?[0-9.]+)`));
    if (!trouve) throw new Error(`ligne « ${libelle} » absente de la sortie :\n${sortie}`);
    return Number(trouve[1]);
  };
  return { hz: chercher("fréquence"), cents: chercher("écart"), db: chercher("niveau") };
}

/** L'exemple exécuté dans un dossier vierge : on garde tout ce qu'il fait. */
function executeDansUnDossierVierge(): { sortie: string; fichiers: string[]; dossier: string } {
  const dossier = mkdtempSync(join(tmpdir(), "premier-instrument-"));
  const lance = spawnSync(process.execPath, [cheminTsx(), EXEMPLE], { cwd: dossier, encoding: "utf8" });
  expect(lance.status, `${lance.stdout}\n${lance.stderr}`).toBe(0);
  return { sortie: lance.stdout, fichiers: liste(dossier), dossier };
}

describe("premier instrument — l'exemple exécuté pour de vrai", () => {
  it("imprime les trois nombres attendus : fréquence, écart, niveau", () => {
    const { sortie, dossier } = executeDansUnDossierVierge();
    try {
      const { hz, cents, db } = troisNombres(sortie);
      expect(hz).toBeCloseTo(440, 2);
      expect(cents).toBeCloseTo(0, 2);
      expect(db).toBeCloseTo(-13.92, 1);
      expect(sortie).toContain("aucun son émis");
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("écrit le WAV dans out/ et nulle part ailleurs", () => {
    const { sortie, fichiers, dossier } = executeDansUnDossierVierge();
    try {
      expect(fichiers).toEqual(["out", "out/premier-instrument.wav"]);
      const decodé = decodeWav(new Uint8Array(readFileSync(join(dossier, "out", "premier-instrument.wav"))));
      expect(decodé.sampleRate).toBe(48_000);
      expect(decodé.samples.length).toBeGreaterThan(0);
      expect(sortie).toContain("WAV écrit");
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("n'appelle aucune API d'émission : aucun son ne peut sortir", () => {
    for (const interdit of ["AudioContext", "createOscillator", "AudioWorklet", ".play(", "aplay", "ffplay"]) {
      expect(SOURCES, `la source mentionne « ${interdit} »`).not.toContain(interdit);
    }
  });

  it("laisse le dossier témoin vide après le nettoyage", () => {
    const { dossier } = executeDansUnDossierVierge();
    rmSync(dossier, { recursive: true, force: true });
    expect(existsSync(dossier)).toBe(false);
  });
});