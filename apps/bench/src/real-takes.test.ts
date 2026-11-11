/**
 * Les mesures sur prises RÉELLES (lot N7, cahier §7.3, annexe D).
 *
 * Deux lectures de la même convention de côté, et ce que chacune prouve :
 * - `recipes.test.ts` (prise SYNTHÉTIQUE `left-hand-only`) prouve que la
 *   CHAÎNE DE TRAITEMENT respecte la convention : ce qui entre « left »
 *   ressort « left », sans voix coincée. La prise y est une formule — elle
 *   ne dit rien du modèle devant une vraie caméra.
 * - le test ci-dessous (prise RÉELLE `takes/real/left-hand-only-…`) prouve
 *   que le MODÈLE annonce « left » pour une vraie main gauche sur l'image
 *   brute d'une vraie caméra : c'est le point « convention de côté sur image
 *   en miroir » de l'annexe D, et lui seul.
 *
 * Les prises réelles sont des données corporelles : elles ne sont PAS
 * versionnées (`takes/real/` est ignoré, §7.11). Sans prise réelle déposée,
 * ce banc est sauté — ce n'est pas un `it.skip` silencieux : la procédure
 * d'enregistrement qui produit la prise est écrite dans `docs/prises-reelles.md`,
 * et le script d'ingestion refait la même vérification à chaque ingestion.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTake } from "@thin-air/schema";

const DOSSIER = join(process.cwd(), "takes", "real");

function prisesReelles(prefixe: string): readonly string[] {
  if (!existsSync(DOSSIER)) return [];
  return readdirSync(DOSSIER)
    .filter((nom) => nom.startsWith(prefixe) && nom.endsWith(".json"))
    .sort()
    .map((nom) => join(DOSSIER, nom));
}

const gaucheFichiers = prisesReelles("left-hand-only");

describe.skipIf(gaucheFichiers.length === 0)("convention de côté sur prises réelles (§7.3, annexe D)", () => {
  for (const fichier of gaucheFichiers) {
    it(`le modèle annonce « left » sur ${fichier.slice(fichier.lastIndexOf("/") + 1)}`, () => {
      const resultat = parseTake(JSON.parse(readFileSync(fichier, "utf8")));
      expect(resultat.ok).toBe(true);
      if (!resultat.ok) return;
      const cotes = new Set(resultat.value.frames.flatMap((image) => image.hands.map((main) => main.side)));
      expect([...cotes]).toEqual(["left"]);
      expect(resultat.value.frames.length).toBeGreaterThan(0);
    });
  }
});

describe("le harnais de prise réelle est en place (lot N7)", () => {
  it("le script d'ingestion et la procédure existent", () => {
    expect(existsSync(join(process.cwd(), "scripts", "prises-reelles.mjs"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "prises-reelles.md"))).toBe(true);
  });

  it("les prises réelles ne sont pas versionnées (donnée corporelle, §7.11)", () => {
    const ignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toContain("takes/real/");
  });
});
