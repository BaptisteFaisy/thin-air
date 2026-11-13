/**
 * Le rapport de défaut en un clic (cahier §7.11, §16) : il se relit, il ne
 * porte ni image ni donnée personnelle, et le rejouer donne le même rapport.
 *
 * Deux étages :
 *   - en mémoire, pour lire le rapport et le vérifier clé par clé ;
 *   - hors process, pour lancer `scripts/rapport-defaut.mjs`, écrire le
 *     fichier, et vérifier que la commande de rejeu rejoue le même rapport.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { effectiveSettings } from "./events.js";
import { readInstrumentFile, readTakeFile } from "./load.js";
import {
  RAPPORT_DEFAUT_FORMAT,
  parseDefectReport,
  renderDefectReport,
  replayCommand,
} from "./rapport-defaut.js";

const RACINE = join(import.meta.dirname, "..", "..", "..");
const TSU = join(RACINE, "node_modules", ".bin", "tsx");
const SCRIPT = join(RACINE, "scripts", "rapport-defaut.mjs");

/** La version et la date sont figées pour un rapport rejouable au bit près. */
const VERSION = "test-commit (test-tag)";
const DATE = "2026-11-12T00:00:00.000Z";

/** Les entrées du rapport : la prise et l'instrument de référence du banc. */
async function entrer() {
  const prise = await readTakeFile(join(RACINE, "takes/reference/slow-rise.json"));
  const instrument = await readInstrumentFile(join(RACINE, "instruments/phantom.json"));
  const reglages = effectiveSettings(instrument);
  const chemins = {
    prise: "takes/reference/slow-rise.json",
    instrument: "instruments/phantom.json",
    sortie: "out/rapport-defaut",
  };
  return { prise, instrument, reglages, chemins };
}

async function construire() {
  const { prise, instrument, reglages, chemins } = await entrer();
  return renderDefectReport({ prise, instrument, reglages, version: VERSION, date: DATE, chemins });
}

/* — Le rapport se relit et porte les clés attendues. — */

describe("rapport de défaut — forme", () => {
  it("se relit et contient les clés attendues", async () => {
    const rapport = await construire();
    const relu = await parseDefectReport(rapport);
    expect(relu.format).toBe(RAPPORT_DEFAUT_FORMAT);
    for (const cle of ["prise", "instrument", "reglages", "rapport", "retard", "chemins"]) {
      expect(relu, `clé ${cle}`).toHaveProperty(cle);
    }
    expect(relu.date).toBe(DATE);
    expect(relu.version).toBe(VERSION);
    expect(relu.rejeu).toContain("scripts/rapport-defaut.mjs");
    expect(relu.resume).toContain("rejeu");
    expect(relu.prise.format).toBe("thin-air-take/1");
    expect(relu.rapport.sampleRate).toBe(48_000);
  });

  it("écrit la commande de rejeu qui reprend les mêmes entrées", async () => {
    const { chemins } = await entrer();
    expect(replayCommand(chemins)).toBe(
      "npx tsx scripts/rapport-defaut.mjs --prise takes/reference/slow-rise.json --instrument instruments/phantom.json --out out/rapport-defaut",
    );
  });
});

/* — Aucune image, aucune donnée personnelle, vérifié clé par clé. — */

const CLES_INTERDITES = new Set([
  "image", "images", "photo", "video", "thumbnail", "vignette", "email", "mail",
  "telephone", "nom", "prenom", "utilisateur", "user", "username", "password",
  "secret", "token",
]);

const MOTIFS_INTERDITS = [
  /data:image/i,
  /base64/i,
  /^\/(home|Users|tmp|var)\//,
  /[A-Za-z]:\\/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
];

function inspecter(valeur: unknown, chemin: string, ecarts: string[]): void {
  if (valeur === null || typeof valeur !== "object") {
    if (typeof valeur === "string" && MOTIFS_INTERDITS.some((motif) => motif.test(valeur))) {
      ecarts.push(`${chemin} : valeur interdite ${JSON.stringify(valeur)}`);
    }
    return;
  }
  for (const [cle, enfant] of Object.entries(valeur)) {
    if (CLES_INTERDITES.has(cle.toLowerCase())) ecarts.push(`${chemin}.${cle} : clé interdite`);
    inspecter(enfant, `${chemin}.${cle}`, ecarts);
  }
}

/** La prise ne porte que des points : ses clés, et seulement celles-là. */
function clesDePrise(prise: unknown): string[] {
  const ensemble = new Set<string>();
  const voir = (valeur: unknown): void => {
    if (valeur === null || typeof valeur !== "object") return;
    if (Array.isArray(valeur)) {
      for (const enfant of valeur) voir(enfant);
      return;
    }
    for (const [cle, enfant] of Object.entries(valeur)) {
      ensemble.add(cle);
      voir(enfant);
    }
  };
  voir(prise);
  return [...ensemble];
}

describe("rapport de défaut — vie privée", () => {
  it("ne contient aucune image ni donnée personnelle, clé par clé", async () => {
    const rapport = await construire();
    const ecarts: string[] = [];
    inspecter(rapport, "rapport", ecarts);
    expect(ecarts).toEqual([]);
  });

  it("la prise ne porte que des points : format, cadence, images, mains", async () => {
    const rapport = await construire();
    const autorisees = ["format", "fps", "frames", "t", "hands", "side", "score", "points"];
    const extra = clesDePrise(rapport.prise).filter((cle) => !autorisees.includes(cle));
    expect(extra).toEqual([]);
  });
});

/* — Le rejouer donne le même rapport. — */

describe("rapport de défaut — rejeu", () => {
  it("le même couple, la même version, la même date : le même rapport", async () => {
    const premier = await construire();
    const second = await construire();
    expect(second).toEqual(premier);
  });

  it("la commande écrite dans le fichier rejoue le même rapport", async () => {
    // `out/` est ignoré par git : rien ne pollue le dépôt, et le chemin reste
    // relatif, donc rejouable et sans donnée personnelle.
    const dossier = join(RACINE, "out", "rapport-defaut-test", String(Date.now() & 0xffff));
    mkdirSync(dossier, { recursive: true });
    try {
      execFileSync(process.execPath, [TSU, SCRIPT, "--prise", "takes/reference/slow-rise.json", "--instrument", "instruments/phantom.json", "--out", dossier], {
        cwd: RACINE,
        stdio: "pipe",
      });
      const fichier = join(dossier, "rapport-defaut.json");
      const premier = JSON.parse(readFileSync(fichier, "utf8")) as Record<string, unknown>;
      expect(premier["format"]).toBe(RAPPORT_DEFAUT_FORMAT);
      expect(String(premier["rejeu"])).toMatch(/^npx tsx scripts\/rapport-defaut\.mjs /);

      // Rejoue la commande écrite dans le fichier, avec le binaire local.
      const rejeu = String(premier["rejeu"]).replace(/^npx tsx /, `${TSU} `);
      execFileSync("sh", ["-c", rejeu], { cwd: RACINE, stdio: "pipe" });
      const second = JSON.parse(readFileSync(fichier, "utf8")) as Record<string, unknown>;

      const { date: premiereDate } = premier;
      const { date: secondeDate } = second;
      // La date vit aussi dans le résumé : hors d'elle, le rapport est identique.
      expect(projetDeterministe(second)).toEqual(projetDeterministe(premier));
      expect(secondeDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(premiereDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      rmSync(join(RACINE, "out", "rapport-defaut-test"), { recursive: true, force: true });
    }
  });
});

/** Le rapport hors date : la date UTC est la seule part qui change d'un rejeu à l'autre. */
function projetDeterministe(rapport: Record<string, unknown>): unknown {
  const { date, resume, ...reste } = rapport;
  const resumeFixe = typeof resume === "string" && typeof date === "string" ? resume.replace(date, "<date>") : resume;
  return { ...reste, resume: resumeFixe };
}
