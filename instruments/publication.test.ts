/**
 * Les trois manifests publiables du moteur (`@thin-air/core`, `@thin-air/audio`,
 * `@thin-air/schema`) : JSON lisible, champs obligatoires présents, et chaque
 * sous-chemin d'`exports` résolvable vers un fichier qui existe (docs/publication.md).
 *
 * Ce banc lit le dépôt, il n'écrit rien : aucun fichier, aucun son, aucun
 * réseau (AIR-N-01, AIR-N-02). Il double la garde `scripts/pack-check.mjs`
 * côté Vitest, pour qu'un manifeste cassé échoue aussi dans `npm test`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const PAQUETS = ["core", "audio", "schema"] as const;

/** Les champs obligatoires pour qu'un paquet soit publiable. */
const CHAMPS_REQUIS = [
  "name",
  "version",
  "description",
  "license",
  "type",
  "repository",
  "keywords",
  "files",
  "sideEffects",
  "exports",
] as const;

interface Manifeste {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly license: string;
  readonly type: string;
  readonly repository: { readonly type: string; readonly url: string; readonly directory: string };
  readonly keywords: readonly string[];
  readonly sideEffects: boolean;
  readonly files: readonly string[];
  readonly exports: Readonly<Record<string, string>>;
}

/** Lit et type le `package.json` d'un paquet ; échoue net s'il est illisible. */
function lireManifeste(paquet: string): Manifeste {
  const chemin = join(RACINE, "packages", paquet, "package.json");
  expect(existsSync(chemin), `package.json présent pour ${paquet}`).toBe(true);
  return JSON.parse(readFileSync(chemin, "utf8")) as Manifeste;
}

/** Le fichier visé par une cible d'`exports`, motif `*` résolu par `index.ts`. */
function fichierCible(cible: string): string {
  return cible.includes("*") ? cible.replace("*", "index.ts") : cible;
}

describe.each(PAQUETS)("packages/%s/package.json", (paquet) => {
  const dossier = join(RACINE, "packages", paquet);
  const m = lireManifeste(paquet);

  it("est un JSON lisible avec tous les champs obligatoires", () => {
    for (const champ of CHAMPS_REQUIS) {
      expect(m[champ], `champ « ${champ} » présent`).toBeDefined();
    }
  });

  it("porte le nom, la version, la licence et le type attendus", () => {
    expect(m.name).toBe(`@thin-air/${paquet}`);
    expect(m.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(m.license).toBe("MIT");
    expect(m.type).toBe("module");
    expect(m.sideEffects).toBe(false);
    expect(m.description.length).toBeGreaterThan(20);
    expect(m.keywords.length).toBeGreaterThan(0);
  });

  it("décrit un dépôt git avec le sous-dossier du paquet", () => {
    expect(m.repository.type).toBe("git");
    expect(m.repository.url).toContain("github.com/Tradoooo/thin-air");
    expect(m.repository.directory).toBe(`packages/${paquet}`);
  });

  it("liste dans « files » des chemins qui existent", () => {
    expect(Array.isArray(m.files) && m.files.length > 0).toBe(true);
    for (const entree of m.files) {
      expect(existsSync(join(dossier, entree)), `« files » : ${entree} existe`).toBe(true);
    }
  });

  it("a un « exports » dont chaque cible pointe vers un fichier existant", () => {
    expect(typeof m.exports).toBe("object");
    expect(m.exports["."], "exports[\".\"] déclaré").toBeDefined();
    for (const [cle, cible] of Object.entries(m.exports)) {
      expect(typeof cible, `exports["${cle}"] est une chaîne`).toBe("string");
      expect(cible.startsWith("./"), `exports["${cle}"] est un chemin relatif`).toBe(true);
      const fichier = join(dossier, fichierCible(cible));
      expect(existsSync(fichier), `exports["${cle}"] → ${cible} existe`).toBe(true);
    }
  });

  it("garde le verrou « private » tant qu'aucune publication n'est décidée", () => {
    const brut = JSON.parse(readFileSync(join(dossier, "package.json"), "utf8")) as { private?: boolean };
    expect(brut.private, "aucun paquet n'est publiable par accident").toBe(true);
  });
});
