/**
 * Les gardes de Kiro, exécutées comme des processus enfants (cahier §14.3).
 *
 * Chaque garde lit du texte et rend un code de sortie : rien ne sonne, rien
 * ne sort de la machine (AIR-N-02, AIR-N-01). Les fixtures de refus vivent
 * dans un dossier temporaire, jeté à la fin ; les contrôles d'acceptation
 * tournent sur le dépôt réel.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const HOOKS = join(RACINE, "scripts", "hooks");

interface Resultat {
  readonly code: number | null;
  readonly sortie: string;
  readonly erreur: string;
}

/** Lance une garde ; `entree` est le JSON que Kiro déposerait sur stdin. */
function lancer(garde: string, { cwd = RACINE, entree = "" }: { cwd?: string; entree?: string } = {}): Resultat {
  const resultat = spawnSync(process.execPath, [join(HOOKS, garde)], {
    cwd,
    input: entree,
    encoding: "utf8",
    timeout: 120_000,
  });
  return { code: resultat.status, sortie: resultat.stdout ?? "", erreur: resultat.stderr ?? "" };
}

/** La charge utile d'un hook `PreToolUse` sur l'outil `shell`. */
function commandeShell(commande: string, champ: "command" | "cmd" | "input", cwd: string): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    cwd,
    session_id: "banc-a7",
    tool_name: "shell",
    tool_input: { [champ]: commande },
  });
}

let temporaire = "";

beforeAll(() => {
  temporaire = mkdtempSync(join(tmpdir(), "thin-air-gardes-"));
  mkdirSync(join(temporaire, "instruments"), { recursive: true });
  mkdirSync(join(temporaire, "takes"), { recursive: true });
});

afterAll(() => {
  if (temporaire) rmSync(temporaire, { recursive: true, force: true });
});

/** Une prise conforme : des instants, des côtés, des scores, des points. */
function priseValide(images = 3, mains = 1, precision = 4): string {
  const point = (): [number, number, number] => {
    const arrondi = (x: number): number => Number(x.toFixed(precision));
    return [arrondi(0.4123), arrondi(0.7211), arrondi(-0.0032)];
  };
  const main = (cote: "left" | "right") => ({
    side: cote,
    score: 0.97,
    points: Array.from({ length: 21 }, point),
  });
  return JSON.stringify({
    format: "thin-air-take/1",
    fps: 30,
    frames: Array.from({ length: images }, (_, index) => ({
      t: index / 30,
      hands: Array.from({ length: mains }, () => main("right")),
    })),
  });
}

describe("no-sound-guard — aucun son, jamais (AIR-N-02)", () => {
  const refus = [
    ["un lecteur audio", "aplay out/render.wav"],
    ["un lecteur macOS", "afplay prise.wav"],
    ["un lecteur multimédia", "mpv --no-video bench-out/render.wav"],
    ["un test de haut-parleur", "speaker-test -c 2"],
    ["un réglage de volume ALSA", "amixer set Master 80%"],
    ["un réglage de volume PipeWire", "wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.8"],
    ["un réglage de volume PulseAudio", "pactl set-sink-volume 0 80%"],
    ["un réglage de volume macOS", "osascript -e 'set volume output volume 50'"],
    ["un navigateur de test avec écran", "npx playwright test --headed"],
    ["un navigateur sans son coupé", "chromium --headless=new https://exemple.test"],
  ] as const;

  it.each(refus)("refuse %s", (_etiquette, commande) => {
    const resultat = lancer("no-sound-guard.mjs", {
      cwd: temporaire,
      entree: commandeShell(commande, "command", temporaire),
    });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toContain("refusé");
  });

  it.each(["command", "cmd", "input"] as const)(
    "lit la commande dans tool_input.%s (annexe D : champ à vérifier)",
    (champ) => {
      const resultat = lancer("no-sound-guard.mjs", {
        cwd: temporaire,
        entree: commandeShell("paplay x.wav", champ, temporaire),
      });
      expect(resultat.code).toBe(1);
    },
  );

  const acceptes = [
    "npx vitest run packages/core/src",
    "node scripts/hooks/run-all-guards.mjs",
    "npm run bench -- events --take takes/reference/slow-rise.json",
    "chromium --headless=new --mute-audio --use-fake-device-for-media-stream",
  ] as const;

  it.each(acceptes)("accepte « %s »", (commande) => {
    const resultat = lancer("no-sound-guard.mjs", {
      cwd: temporaire,
      entree: commandeShell(commande, "command", temporaire),
    });
    expect(resultat.erreur).toBe("");
    expect(resultat.code).toBe(0);
  });

  it("recette §18 — chaque invocation est journalisée dans out/hook-log.jsonl", () => {
    lancer("no-sound-guard.mjs", {
      cwd: temporaire,
      entree: commandeShell("aplay refus.wav", "command", temporaire),
    });
    lancer("no-sound-guard.mjs", {
      cwd: temporaire,
      entree: commandeShell("npx tsc --noEmit", "command", temporaire),
    });
    const journal = join(temporaire, "out", "hook-log.jsonl");
    expect(existsSync(journal)).toBe(true);
    const lignes = readFileSync(journal, "utf8")
      .trim()
      .split("\n")
      .map((ligne) => JSON.parse(ligne) as Record<string, unknown>);
    const refusJournalises = lignes.filter((ligne) => ligne.evenement === "refus");
    expect(refusJournalises.length).toBeGreaterThan(0);
    expect(refusJournalises.at(-1)).toMatchObject({ garde: "no-sound-guard", commande: "aplay refus.wav" });
    expect(lignes.at(-1)).toMatchObject({ evenement: "acceptation", commande: "npx tsc --noEmit" });
  });

  it("sans entrée standard (CI), il n'y a rien à contrôler : code 0", () => {
    const resultat = lancer("no-sound-guard.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("rien à contrôler");
  });
});

describe("take-privacy-guard — une prise ne contient que des points (§7.11)", () => {
  it("accepte une prise conforme", () => {
    writeFileSync(join(temporaire, "takes", "conforme.json"), priseValide());
    const resultat = lancer("take-privacy-guard.mjs", { cwd: temporaire });
    expect(resultat.erreur).toBe("");
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("1 prise(s) conforme(s)");
  });

  it("refuse une prise qui transporte autre chose que des points", () => {
    const prise = JSON.parse(priseValide()) as Record<string, unknown>;
    prise.image = "data:image/jpeg;base64,/9j/4AAQ";
    writeFileSync(join(temporaire, "takes", "image.json"), JSON.stringify(prise));
    const resultat = lancer("take-privacy-guard.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toContain("image");
    rmSync(join(temporaire, "takes", "image.json"));
  });

  it("refuse une main qui n'a pas 21 points de trois coordonnées", () => {
    const prise = JSON.parse(priseValide(1)) as { frames: { hands: { points: unknown[] }[] }[] };
    prise.frames[0]!.hands[0]!.points = [[0.4, 0.7, 0]];
    writeFileSync(join(temporaire, "takes", "incomplete.json"), JSON.stringify(prise));
    const resultat = lancer("take-privacy-guard.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toContain("21 points attendus");
    rmSync(join(temporaire, "takes", "incomplete.json"));
  });

  it("refuse une prise au-dessus du plafond de poids par seconde", () => {
    // 30 images à 30 par seconde : une seconde de prise, dix mains par image,
    // coordonnées non arrondies. Le poids trahit ce qui n'est pas annoncé.
    writeFileSync(join(temporaire, "takes", "lourde.json"), priseValide(30, 10, 16));
    const resultat = lancer("take-privacy-guard.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toContain("plafond");
    rmSync(join(temporaire, "takes", "lourde.json"));
  });

  it("sort proprement quand il n'y a encore aucune prise (lot B3)", () => {
    const vide = mkdtempSync(join(tmpdir(), "thin-air-prises-vide-"));
    const resultat = lancer("take-privacy-guard.mjs", { cwd: vide });
    rmSync(vide, { recursive: true, force: true });
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("0 prise(s)");
  });
});

describe("instrument-schema-guard — un instrument est un fichier valide (AIR-F-43)", () => {
  it("valide les six instruments du dépôt", () => {
    const resultat = lancer("instrument-schema-guard.mjs");
    expect(resultat.erreur).toBe("");
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("6 instrument(s) conforme(s)");
  });

  it("refuse un fichier au mauvais format, en entier et avec ses raisons", () => {
    ecrireInstrumentTemporaire("mauvais.json", {
      format: "air-instrument/1",
      name: "Mauvais",
      pointer: "palm",
      scale: { root: 50, steps: [0, 2] },
      range: { low: 81, high: 45 },
      snap: 1.5,
      voices: 0,
      sound: { engine: "orgue" },
      couleur: "bleu",
    });
    const resultat = lancer("instrument-schema-guard.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toContain("couleur");
    expect(resultat.erreur).toContain("thin-air-instrument/1");
    expect(resultat.erreur).toContain("snap");
    expect(resultat.erreur).toContain("voices");
    expect(resultat.erreur).toContain("engine");
    rmSync(join(temporaire, "instruments", "mauvais.json"));
  });

  it("refuse une zone dont le rectangle est à l'envers", () => {
    ecrireInstrumentTemporaire("zones.json", {
      format: "thin-air-instrument/1",
      name: "Zones",
      pointer: "palm",
      scale: { root: 50, steps: [0, 3, 7] },
      zones: { zones: [{ id: "z0", u0: 0.8, u1: 0.2, v0: 0, v1: 1, degree: 0 }] },
      snap: 1,
      voices: 1,
      sound: { engine: "osc", wave: "sine" },
    });
    const resultat = lancer("instrument-schema-guard.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toContain("u0 doit être inférieur à u1");
    rmSync(join(temporaire, "instruments", "zones.json"));
  });

  it("refuse l'absence d'un des six instruments du §7.8", () => {
    const resultat = lancer("instrument-schema-guard.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(1);
    expect(resultat.erreur).toContain("absent");
  });

  function ecrireInstrumentTemporaire(nom: string, contenu: unknown): void {
    writeFileSync(join(temporaire, "instruments", nom), JSON.stringify(contenu, null, 2));
  }
});

describe("render-check et core-properties — repli explicite, aucune fausse preuve", () => {
  it("render-check sort 0 et dit « repli » sans prise de référence (lot B3)", () => {
    const resultat = lancer("render-check.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("repli");
    expect(resultat.sortie).toContain("takes/reference/");
  });

  it("core-properties sort 0 et dit « repli » sans banc dans packages/core (lots A1 à B2)", () => {
    const resultat = lancer("core-properties.mjs", { cwd: temporaire });
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("repli");
    expect(resultat.sortie).toContain("AIR-P-01 à 12");
  });

  it("core-properties lance les propriétés du dépôt et les fait passer", () => {
    const resultat = lancer("core-properties.mjs");
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("banc(s) du core passent");
  }, 120_000);
});

describe("les gardes déjà écrites passent sur ce dépôt", () => {
  it("wording-guard — le vocabulaire des six instruments respecte §5.4", () => {
    const resultat = lancer("wording-guard.mjs");
    expect(resultat.erreur).toBe("");
    expect(resultat.code).toBe(0);
  });

  it("no-audio-asset-guard — aucun fichier sonore dans le dépôt", () => {
    const resultat = lancer("no-audio-asset-guard.mjs");
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain("aucun fichier sonore");
  });

  it("run-all-guards.mjs — la chaîne des gardes sort 0", () => {
    const resultat = spawnSync(process.execPath, [join(HOOKS, "run-all-guards.mjs")], {
      cwd: RACINE,
      input: "",
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(resultat.stderr).toBe("");
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain("instrument-schema-guard.mjs");
    expect(resultat.stdout).toContain("no-sound-guard.mjs");
    expect(resultat.stdout).toContain("take-privacy-guard.mjs");
  }, 120_000);
});
