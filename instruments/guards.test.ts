/**
 * Les gardes de `scripts/hooks/`, exécutées en ligne de commande
 * (cahier §14.3). Chaque garde est un processus : on lui donne une entrée
 * standard et un dossier courant, on lit son code de sortie.
 *
 * Les fixtures sont écrites dans un dossier temporaire jeté après le test :
 * aucune prise, aucun instrument, aucun journal ne touche le dépôt.
 * Aucun son, aucun réseau, aucun périphérique (AIR-N-02).
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const GARDES = join(RACINE, "scripts", "hooks");

interface Sortie {
  readonly code: number | null;
  readonly sortie: string;
  readonly erreur: string;
}

let bac = "";

beforeAll(() => {
  bac = mkdtempSync(join(tmpdir(), "thin-air-gardes-"));
  mkdirSync(join(bac, "instruments"), { recursive: true });
  mkdirSync(join(bac, "takes", "reference"), { recursive: true });
});

afterAll(() => {
  if (bac.startsWith(tmpdir())) rmSync(bac, { recursive: true, force: true });
});

/** Lance une garde avec une entrée standard et un dossier courant. */
function lancer(garde: string, { cwd = bac, entree = "" }: { cwd?: string; entree?: string } = {}): Sortie {
  const resultat = spawnSync(process.execPath, [join(GARDES, garde)], {
    cwd,
    input: entree,
    encoding: "utf8",
    timeout: 120_000,
  });
  return { code: resultat.status, sortie: resultat.stdout ?? "", erreur: resultat.stderr ?? "" };
}

/** La charge utile d'un hook `PreToolUse` sur l'outil `shell`. */
function charge(command: string, champ: "command" | "cmd" | "input" = "command", cwd = bac): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    cwd,
    session_id: "banc-a7",
    tool_name: "shell",
    tool_input: { [champ]: command },
  });
}

/**
 * Une prise conforme : des instants, des côtés, des scores, des points.
 * `chiffres` allonge les coordonnées (1 par défaut, comme une prise réelle
 * écrite par le codec) : c'est ce qui permet de fabriquer une prise trop
 * lourde sans inventer de clé.
 */
function priseValide({ images = 3, mains = 1, chiffres = 1 }: { images?: number; mains?: number; chiffres?: number } = {}): unknown {
  const coordonnee = (valeur: number, rang: number) =>
    chiffres <= 1 ? Number(valeur.toFixed(3)) : Number(`${valeur.toFixed(6)}${String(rang).padStart(chiffres, "7")}`);
  const points = Array.from({ length: 21 }, (_, index) => [
    coordonnee(0.4 + index / 1000, index),
    coordonnee(0.7, index + 1),
    coordonnee(0, index + 2),
  ]);
  const main = { side: "right", score: 0.97, points };
  return {
    format: "thin-air-take/1",
    fps: 30,
    frames: Array.from({ length: images }, (_, index) => ({
      t: index / 30,
      hands: Array.from({ length: mains }, () => main),
    })),
  };
}

describe("no-sound-guard — refus (AIR-N-02)", () => {
  it("refuse un lecteur audio", () => {
    const resultat = lancer("no-sound-guard.mjs", { entree: charge("aplay out/render.wav") });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/refusé/);
    expect(resultat.erreur).toMatch(/aplay/);
  });

  it("refuse un réglage de volume", () => {
    const resultat = lancer("no-sound-guard.mjs", { entree: charge("pactl set-sink-volume 0 80%") });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/volume/);
  });

  it("refuse osascript avec « volume »", () => {
    const resultat = lancer("no-sound-guard.mjs", { entree: charge('osascript -e "set volume 3"') });
    expect(resultat.code).toBe(1);
  });

  it("refuse un navigateur de test avec écran", () => {
    const resultat = lancer("no-sound-guard.mjs", { entree: charge("npx playwright test --headed") });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/écran/);
  });

  it("refuse un navigateur de test sans son coupé", () => {
    const resultat = lancer("no-sound-guard.mjs", { entree: charge("chromium --headless=new http://localhost:5173") });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/son coupé/);
  });

  it("accepte les trois formes du champ de commande (annexe D)", () => {
    for (const champ of ["command", "cmd", "input"] as const) {
      const resultat = lancer("no-sound-guard.mjs", { entree: charge("mpv x.wav", champ) });
      expect(resultat.code, `champ ${champ}`).toBe(1);
    }
  });
});

describe("no-sound-guard — acceptation et journal", () => {
  it("accepte une commande de banc, un test, un outil de build", () => {
    for (const commande of ["npx vitest run", "npm run bench -- events --take x.json", "npx tsc --noEmit"]) {
      const resultat = lancer("no-sound-guard.mjs", { entree: charge(commande) });
      expect(resultat.code, commande).toBe(0);
    }
  });

  it("accepte un navigateur sans écran et avec le son coupé", () => {
    const resultat = lancer("no-sound-guard.mjs", {
      entree: charge("chromium --headless=new --mute-audio http://localhost:5173"),
    });
    expect(resultat.code).toBe(0);
  });

  it("ne contrôle rien sans entrée standard (CI)", () => {
    const resultat = lancer("no-sound-guard.mjs");
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toMatch(/rien à contrôler/);
  });

  it("journalise ses refus dans out/hook-log.jsonl (recette §18)", () => {
    const journal = join(bac, "out", "hook-log.jsonl");
    expect(existsSync(journal)).toBe(true);
    const lignes = readFileSync(journal, "utf8").trim().split("\n").map((ligne) => JSON.parse(ligne) as Record<string, unknown>);
    const refus = lignes.filter((ligne) => ligne.evenement === "refus" && ligne.garde === "no-sound-guard");
    expect(refus.length).toBeGreaterThan(0);
    expect(refus[0]).toHaveProperty("at");
    expect(refus[0]).toHaveProperty("raison");
  });
});

describe("take-privacy-guard — une prise ne contient que des points (§7.11)", () => {
  const dossier = () => join(bac, "takes", "reference");

  it("accepte une prise conforme", () => {
    writeFileSync(join(dossier(), "conforme.json"), JSON.stringify(priseValide()));
    const resultat = lancer("take-privacy-guard.mjs");
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toMatch(/conforme/);
  });

  it("refuse une prise qui porte autre chose que des points", () => {
    writeFileSync(
      join(dossier(), "triche.json"),
      JSON.stringify({ ...(priseValide() as object), image: "data:image/png;base64,AAAA" }),
    );
    const resultat = lancer("take-privacy-guard.mjs");
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/image/);
    rmSync(join(dossier(), "triche.json"));
  });

  it("refuse une main sans ses 21 points", () => {
    const prise = priseValide() as { frames: { hands: { points: unknown }[] }[] };
    prise.frames[0]!.hands[0]!.points = [[0.4, 0.7, 0]];
    writeFileSync(join(dossier(), "tronquee.json"), JSON.stringify(prise));
    const resultat = lancer("take-privacy-guard.mjs");
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/21 points/);
    rmSync(join(dossier(), "tronquee.json"));
  });

  it("refuse une prise au-dessus du plafond de poids par seconde", () => {
    // Douze mains : ce n'est plus une prise, c'est un conteneur. Le poids
    // trahit ce que les clés n'avouent pas (§7.11 : 26 Ko/s attendus).
    writeFileSync(join(dossier(), "lourde.json"), JSON.stringify(priseValide({ images: 30, mains: 12, chiffres: 12 })));
    const resultat = lancer("take-privacy-guard.mjs");
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/plafond/);
    rmSync(join(dossier(), "lourde.json"));
  });
});

describe("instrument-schema-guard — un instrument est un fichier valide (AIR-F-43)", () => {
  const dossier = () => join(bac, "instruments");

  it("valide les six instruments du dépôt copiés dans les fixtures", () => {
    for (const nom of ["phantom", "harp", "choir", "bells", "drone", "grid-drums"]) {
      cpSync(join(RACINE, "instruments", `${nom}.json`), join(dossier(), `${nom}.json`));
    }
    const resultat = lancer("instrument-schema-guard.mjs");
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toMatch(/6 instrument/);
  });

  it("refuse un fichier au mauvais format, avec ses raisons", () => {
    const mauvais = {
      format: "air-instrument/1",
      name: "Faux",
      pointer: "palm",
      scale: { root: 50, steps: [0, 2, 3] },
      range: { low: 80, high: 40 },
      snap: 1.4,
      voices: 0,
      sound: { engine: "orgue" },
      couleur: "bleu",
    };
    writeFileSync(join(dossier(), "faux.json"), JSON.stringify(mauvais));
    const resultat = lancer("instrument-schema-guard.mjs");
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/couleur/);
    expect(resultat.erreur).toMatch(/thin-air-instrument\/1/);
    expect(resultat.erreur).toMatch(/low doit être strictement inférieur/);
    rmSync(join(dossier(), "faux.json"));
  });

  it("refuse un instrument dont les zones se chevauchent ou s'inversent", () => {
    const zones = {
      format: "thin-air-instrument/1",
      name: "Zones",
      pointer: "palm",
      scale: { root: 50, steps: [0, 3, 7] },
      zones: { zones: [{ id: "a", u0: 0.7, u1: 0.2, v0: 0, v1: 1, degree: 0 }] },
      snap: 1,
      voices: 1,
      sound: { engine: "osc", wave: "sine" },
    };
    writeFileSync(join(dossier(), "zones.json"), JSON.stringify(zones));
    const resultat = lancer("instrument-schema-guard.mjs");
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toMatch(/u0 doit être inférieur à u1/);
    rmSync(join(dossier(), "zones.json"));
  });
});

describe("render-check et core-properties — repli explicite", () => {
  it("render-check sort 0 et dit son repli quand il n'y a rien à rendre", () => {
    const vide = mkdtempSync(join(tmpdir(), "thin-air-vide-"));
    mkdirSync(join(vide, "instruments"), { recursive: true });
    const resultat = lancer("render-check.mjs", { cwd: vide });
    rmSync(vide, { recursive: true, force: true });
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toMatch(/repli|aucun/);
  });

  it("core-properties sort 0 et dit son repli quand aucun banc n'existe", () => {
    const vide = mkdtempSync(join(tmpdir(), "thin-air-vide-"));
    const resultat = lancer("core-properties.mjs", { cwd: vide });
    rmSync(vide, { recursive: true, force: true });
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toMatch(/repli/);
  });
});

describe("la chaîne des gardes, sur le dépôt réel", () => {
  it("run-all-guards.mjs sort 0 et couvre les trois nouvelles gardes", () => {
    const resultat = lancer("run-all-guards.mjs", { cwd: RACINE });
    expect(resultat.code).toBe(0);
    for (const garde of ["no-sound-guard", "take-privacy-guard", "instrument-schema-guard"]) {
      expect(resultat.sortie).toMatch(new RegExp(`${garde}\\.mjs`));
    }
  }, 180_000);
});
