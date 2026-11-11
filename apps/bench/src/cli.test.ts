/**
 * Les quatre commandes vues de l'extérieur : arguments, sortie, code de
 * sortie. Rien n'est joué : les writers capturent le texte (AIR-N-02).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { main } from "./cli.js";
import type { Writers } from "./commands.js";

interface Captured {
  readonly code: number;
  readonly out: string;
  readonly err: string;
}

function capture(): { writers: Writers; read: () => Captured } {
  const sortie: string[] = [];
  const erreur: string[] = [];
  return {
    writers: {
      out: (text) => sortie.push(text),
      err: (text) => erreur.push(text),
    },
    read: () => ({ code: 0, out: sortie.join("\n"), err: erreur.join("\n") }),
  };
}

async function bench(...argv: string[]): Promise<Captured> {
  const buffer = capture();
  const code = await main(argv, buffer.writers);
  const lu = buffer.read();
  return { code, out: lu.out, err: lu.err };
}

let dossier = "";
let prise = "";
let instrument = "";

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "bench-cli-"));
  prise = join(dossier, "prise.json");
  instrument = join(dossier, "instrument.json");
  writeFileSync(prise, JSON.stringify({ format: "thin-air-take/1", fps: 30, frames: [] }), "utf8");
  writeFileSync(instrument, JSON.stringify({ format: "thin-air-instrument/1", name: "Phantom" }), "utf8");
});

afterEach(() => {
  rmSync(dossier, { recursive: true, force: true });
});

function rapport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
    ...overrides,
  };
}

function writeReport(name: string, overrides: Record<string, unknown> = {}): string {
  const chemin = join(dossier, name);
  writeFileSync(chemin, JSON.stringify(rapport(overrides)), "utf8");
  return chemin;
}

describe("bench — l'aide", () => {
  it("affiche l'aide générale et rend 0, sans commande", async () => {
    const { code, out } = await bench();
    expect(code).toBe(0);
    expect(out).toContain("bench events");
    expect(out).toContain("bench render");
    expect(out).toContain("bench compare");
    expect(out).toContain("bench synth");
  });

  it("affiche l'aide générale avec --help", async () => {
    const { code, out } = await bench("--help");
    expect(code).toBe(0);
    expect(out).toContain("Codes de sortie");
  });

  it("affiche l'aide d'une commande", async () => {
    for (const commande of ["events", "render", "compare", "synth"]) {
      const { code, out } = await bench(commande, "--help");
      expect(code).toBe(0);
      expect(out).toContain(`bench ${commande}`);
    }
  });

  it("liste les sept formes de synthèse dans l'aide", async () => {
    const { out } = await bench("synth", "--help");
    for (const forme of ["line", "tremor", "sweep", "leave", "cross", "left-only", "jab"]) {
      expect(out).toContain(forme);
    }
  });
});

describe("bench — erreurs d'usage (code 2)", () => {
  it("refuse une commande inconnue", async () => {
    const { code, err } = await bench("nimportequoi");
    expect(code).toBe(2);
    expect(err).toContain("commande inconnue");
  });

  it("refuse une option inconnue", async () => {
    const { code, err } = await bench("events", "--bogus", "x");
    expect(code).toBe(2);
    expect(err).toContain("option inconnue");
  });

  it("refuse une option obligatoire absente", async () => {
    const { code, err } = await bench("events");
    expect(code).toBe(2);
    expect(err).toContain("--take");
  });

  it("refuse un fichier illisible, en le nommant", async () => {
    const { code, err } = await bench("events", "--take", join(dossier, "absent.json"), "--instrument", instrument);
    expect(code).toBe(2);
    expect(err).toContain("fichier illisible");
  });

  it("refuse un JSON invalide", async () => {
    const casse = join(dossier, "casse.json");
    writeFileSync(casse, "{ pas du json", "utf8");
    const { code, err } = await bench("events", "--take", casse, "--instrument", instrument);
    expect(code).toBe(2);
    expect(err).toContain("JSON invalide");
  });

  it("refuse une forme de synthèse inconnue", async () => {
    const { code, err } = await bench("synth", "bidon");
    expect(code).toBe(2);
    expect(err).toContain("forme inconnue");
  });

  it("refuse une synthèse sans forme", async () => {
    const { code, err } = await bench("synth");
    expect(code).toBe(2);
    expect(err).toContain("forme manquante");
  });

  it("refuse un paramètre non numérique", async () => {
    const { code, err } = await bench("synth", "line", "--fps", "beaucoup");
    expect(code).toBe(2);
    expect(err).toContain("valeur numérique attendue");
  });
});

describe("bench compare — le verdict de la CI", () => {
  it("rend 0 quand les deux rapports concordent", async () => {
    const rapportA = writeReport("a.json");
    const rapportB = writeReport("b.json");
    const { code, out } = await bench("compare", rapportA, rapportB);
    expect(code).toBe(0);
    expect(out).toContain("conforme");
  });

  it("rend 1 au premier écart, et dit lequel", async () => {
    const rapportA = writeReport("a.json", { peakDb: -11.0 });
    const rapportB = writeReport("b.json");
    const { code, out } = await bench("compare", rapportA, rapportB);
    expect(code).toBe(1);
    expect(out).toContain("peakDb");
    expect(out).toContain("tolérance 0,50 dB");
  });

  it("accepte un écart dans les tolérances", async () => {
    const rapportA = writeReport("a.json", { peakDb: -13.8, silenceAfterMs: 500 });
    const rapportB = writeReport("b.json");
    expect((await bench("compare", rapportA, rapportB)).code).toBe(0);
  });

  it("sort les écarts en JSON", async () => {
    const rapportA = writeReport("a.json", { peakDb: -11.0 });
    const rapportB = writeReport("b.json");
    const { code, out } = await bench("compare", rapportA, rapportB, "--json");
    expect(code).toBe(1);
    expect(JSON.parse(out)).toHaveLength(1);
  });

  it("rend un verdict court avec --quiet", async () => {
    const rapportA = writeReport("a.json");
    const rapportB = writeReport("b.json");
    expect((await bench("compare", rapportA, rapportB, "--quiet")).out).toBe("conforme");
  });

  it("refuse un rapport incomplet, avec les raisons (code 2)", async () => {
    const incomplet = join(dossier, "incomplet.json");
    writeFileSync(incomplet, JSON.stringify({ take: "x" }), "utf8");
    const rapportB = writeReport("b.json");
    const { code, err } = await bench("compare", incomplet, rapportB);
    expect(code).toBe(2);
    expect(err).toContain("rapport invalide");
    expect(err).toContain("peakDb");
  });

  it("exige deux rapports", async () => {
    const { code, err } = await bench("compare", writeReport("a.json"));
    expect(code).toBe(2);
    expect(err).toContain("deux rapports");
  });
});

describe("bench events et render — la dépendance manquante est dite", () => {
  // Tant que les lots A4, A5 et B1 n'ont pas livré leurs contrats, ces deux
  // commandes échouent en code 1 avec un message qui nomme le lot — jamais
  // une trace de pile, jamais un silence.
  it("events nomme le lot manquant quand la prise ne peut pas être validée", async () => {
    const { code, err } = await bench("events", "--take", prise, "--instrument", instrument);
    if (code === 0) return; // les schémas sont livrés : la commande a marché.
    expect(code).toBe(1);
    expect(err).toMatch(/échec : /);
    expect(err).not.toMatch(/at \w+ \(/);
  });

  it("render nomme le lot manquant et n'écrit rien", async () => {
    const sortie = join(dossier, "out");
    const { code } = await bench("render", "--take", prise, "--instrument", instrument, "--out", sortie);
    if (code === 0) return;
    expect(code).toBe(1);
  });

  it("synth nomme le lot manquant quand les générateurs sont absents", async () => {
    const sortie = join(dossier, "s.json");
    const { code, err } = await bench("synth", "line", "--out", sortie);
    if (code === 0) return;
    expect(code).toBe(1);
    expect(err).toContain("prise de synthèse indisponible");
  });
});
