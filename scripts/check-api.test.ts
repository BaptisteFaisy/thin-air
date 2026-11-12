/**
 * Le contrat d'API publique, sur une fixture.
 *
 * `scripts/check-api.mjs` compare `docs/api-surface.json` à ce que les paquets
 * exportent vraiment. Ce test ne touche pas le dépôt : il fabrique un dépôt
 * témoin dans le dossier temporaire, y met un paquet et un contrat, puis
 * vérifie que la garde dit ce qu'elle doit dire.
 *
 * Trois écarts doivent être vus : un export retiré, un export ajouté, un type
 * modifié. Un contrat qui colle doit passer sans bruit.
 *
 * Lancement : `npx vitest run --config vitest.scripts.config.ts`
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");
const SCRIPT = join(RACINE, "scripts", "check-api.mjs");

/** Le paquet témoin : une interface, une fonction, une constante. */
const CODE = `export interface Volume {
  readonly gain: number;
}

export function mixer(volume: Volume): number {
  return volume.gain;
}

export const MAX_GAIN = 1;
`;

/** Le contrat qui colle avec le paquet témoin. */
const CONTRAT = {
  version: 1,
  packages: {
    demo: {
      description: "Un paquet témoin.",
      exports: {
        MAX_GAIN: { kind: "const", type: "number", description: "Le gain maximal." },
        Volume: {
          kind: "interface",
          type: "interface Volume { readonly gain: number }",
          description: "Le volume d'un canal.",
        },
        mixer: {
          kind: "function",
          type: "(volume: Volume) : number",
          description: "Mélange un volume.",
        },
      },
    },
  },
};

/** Un dépôt témoin : un paquet `demo` et son contrat. */
function temoin(code: string, contrat: unknown): string {
  const racine = mkdtempSync(join(tmpdir(), "check-api-"));
  const src = join(racine, "packages", "demo", "src");
  mkdirSync(src, { recursive: true });
  mkdirSync(join(racine, "docs"), { recursive: true });
  writeFileSync(join(src, "index.ts"), code);
  writeFileSync(join(racine, "docs", "api-surface.json"), JSON.stringify(contrat, null, 2));
  return racine;
}

/** La garde, sur le dépôt témoin : son code de sortie et ce qu'elle dit. */
function verifie(racine: string): { code: number | null; sortie: string } {
  const r = spawnSync(process.execPath, [SCRIPT, "--racine", racine], {
    cwd: RACINE,
    encoding: "utf8",
  });
  return { code: r.status, sortie: `${r.stdout}\n${r.stderr}` };
}

/** Un contrat où un symbole a le type announced. */
function contratAvecType(nom: string, type: string): unknown {
  const copie = structuredClone(CONTRAT);
  (copie.packages.demo.exports as Record<string, { type: string }>)[nom]!.type = type;
  return copie;
}

describe("contrat d'API publique", () => {
  it("un contrat qui colle passe sans bruit", () => {
    const { code, sortie } = verifie(temoin(CODE, CONTRAT));
    expect(code).toBe(0);
    expect(sortie).toContain("3 exports figés");
  });

  it("un export retiré est détecté, et nommé", () => {
    const sansMixer = CODE.replace(/export function mixer[\s\S]*?\n}\n/, "");
    const { code, sortie } = verifie(temoin(sansMixer, CONTRAT));
    expect(code).toBe(1);
    expect(sortie).toContain("mixer");
    expect(sortie).toContain("disparu");
  });

  it("un export ajouté est détecté, et nommé", () => {
    const contrat = structuredClone(CONTRAT) as Record<string, unknown>;
    delete (contrat.packages as Record<string, Record<string, unknown>>).demo.exports.mixer;
    const { code, sortie } = verifie(temoin(CODE, contrat));
    expect(code).toBe(1);
    expect(sortie).toContain("mixer");
    expect(sortie).toContain("ajouté");
  });

  it("un type modifié est signalé, et nommé", () => {
    const { code, sortie } = verifie(
      temoin(CODE.replace(": number {", ": string {"), contratAvecType("mixer", "(volume: Volume) : number")),
    );
    expect(code).toBe(1);
    expect(sortie).toContain("mixer");
    expect(sortie).toContain("type changé");
  });
});
