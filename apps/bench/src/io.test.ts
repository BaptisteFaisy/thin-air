/**
 * Les fichiers du banc : lecture, écriture, dossiers créés s'il manque, et
 * refus qui disent pourquoi (code 2, jamais de valeur par défaut).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UsageError } from "./errors.js";
import { ensureDir, fileExists, fileSize, readJsonFile, readTextFile, writeBytesFile, writeJsonFile, writeTextFile } from "./io.js";
import { readSettingsFile, parseSettingsJson } from "./load.js";
import { formatNote, formatReport, parseReport } from "./report.js";

/** Les raisons d'un refus sont dans `hint` : le message reste court. */
function hintOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof UsageError ? (error.hint ?? "") : "";
  }
  throw new Error("le refus aurait dû lever");
}

let dossier = "";

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "bench-io-"));
});

afterEach(() => {
  rmSync(dossier, { recursive: true, force: true });
});

describe("lecture et écriture de fichiers", () => {
  it("écrit puis relit un texte", () => {
    const chemin = writeTextFile(join(dossier, "a.txt"), "bonjour\n");
    expect(readTextFile(chemin)).toBe("bonjour\n");
  });

  it("écrit et relit un objet JSON avec sa nouvelle ligne finale", () => {
    const chemin = writeJsonFile(join(dossier, "a.json"), { a: 1 });
    expect(readTextFile(chemin)).toBe('{\n  "a": 1\n}\n');
    expect(readJsonFile(chemin)).toEqual({ a: 1 });
  });

  it("crée le dossier manquant", () => {
    const chemin = writeJsonFile(join(dossier, "sous", "encore", "a.json"), [1, 2]);
    expect(fileExists(chemin)).toBe(true);
  });

  it("écrit des octets bruts", () => {
    const chemin = writeBytesFile(join(dossier, "a.bin"), new Uint8Array([1, 2, 3]));
    expect(fileSize(chemin)).toBe(3);
  });

  it("rend un dossier absolu, même déjà présent", () => {
    const dir = ensureDir(join(dossier, "out"));
    expect(dir.startsWith("/")).toBe(true);
    expect(ensureDir(dir)).toBe(dir);
  });

  it("refuse un fichier illisible en disant le chemin", () => {
    expect(() => readTextFile(join(dossier, "absent.json"))).toThrow(UsageError);
    expect(() => readTextFile(join(dossier, "absent.json"))).toThrow(/fichier illisible/);
  });

  it("refuse un JSON invalide en disant le chemin", () => {
    const chemin = writeTextFile(join(dossier, "casse.json"), "{ pas du json");
    expect(() => readJsonFile(chemin)).toThrow(/JSON invalide/);
  });
});

describe("réglages — --settings", () => {
  it("accepte les clés connues, avec le bon type", () => {
    expect(parseSettingsJson({ graceMs: 200, oneHand: true }, "s.json")).toEqual({ graceMs: 200, oneHand: true });
  });

  it("accepte l'aimant à null (aimant de l'instrument)", () => {
    expect(parseSettingsJson({ magnet: null }, "s.json")).toEqual({ magnet: null });
  });

  it("refuse une clé inconnue, en la nommant", () => {
    try {
      parseSettingsJson({ inconnu: 1 }, "s.json");
    } catch (error) {
      expect((error as UsageError).hint).toContain("inconnu : réglage inconnu");
      return;
    }
    throw new Error("le refus aurait dû lever");
  });

  it("refuse un type faux", () => {
    expect(hintOf(() => parseSettingsJson({ graceMs: "beaucoup" }, "s.json"))).toContain("graceMs : number attendu");
    expect(hintOf(() => parseSettingsJson({ oneHand: 1 }, "s.json"))).toContain("oneHand : boolean attendu");
  });

  it("refuse un fichier qui n'est pas un objet", () => {
    expect(hintOf(() => parseSettingsJson([], "s.json"))).toBe("un objet JSON est attendu");
  });

  it("lit un fichier de réglages", () => {
    const chemin = writeJsonFile(join(dossier, "s.json"), { tempo: 120 });
    expect(readSettingsFile(chemin)).toEqual({ tempo: 120 });
  });
});

describe("rapport de rendu — validation et forme", () => {
  const valide = {
    take: "slow-rise",
    instrument: "Phantom",
    sampleRate: 48_000,
    samples: 144_000,
    durationS: 3,
    notes: [{ t: 0, midi: 55, expectedHz: 196.0, measuredHz: 196.02, cents: 0.2 }],
    peakDb: -13.4,
    rmsDb: -20.5,
    maxVoices: 1,
    silenceAfterMs: 410,
  };

  it("accepte un rapport complet", () => {
    expect(parseReport(valide, "r.json").take).toBe("slow-rise");
  });

  it("refuse un champ manquant, en le nommant", () => {
    expect(hintOf(() => parseReport({ ...valide, peakDb: undefined }, "r.json"))).toContain("peakDb");
  });

  it("refuse un rapport qui n'est pas un objet", () => {
    expect(hintOf(() => parseReport(42, "r.json"))).toBe("un objet JSON est attendu");
  });

  it("refuse une note incomplète, en nommant son rang", () => {
    expect(hintOf(() => parseReport({ ...valide, notes: [{ t: 0, midi: 55 }] }, "r.json"))).toContain(
      "notes[0].expectedHz",
    );
  });

  it("refuse des notes qui ne sont pas un tableau", () => {
    expect(hintOf(() => parseReport({ ...valide, notes: {} }, "r.json"))).toContain("notes : un tableau est attendu");
  });

  it("met une note en forme, avec virgule décimale", () => {
    const ligne = formatNote(valide.notes[0] ?? { t: 0, midi: 0, expectedHz: 0, measuredHz: 0, cents: 0 });
    expect(ligne).toContain("0,000 s");
    expect(ligne).toContain("midi 55");
    expect(ligne).toContain("196,00 Hz");
    expect(ligne).toContain("0,20 cents");
  });

  it("met le rapport entier en forme, sans date", () => {
    const texte = formatReport(valide);
    expect(texte).toContain("prise      slow-rise");
    expect(texte).toContain("instrument Phantom");
    expect(texte).toContain("144000 échantillons");
    expect(texte).toContain("−13,40 dB");
    expect(texte).toContain("notes (1)");
    expect(texte).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
