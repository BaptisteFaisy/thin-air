/**
 * Le contrôle des versions de formats, testé (cahier §11.4, annexe B).
 *
 * `node --test scripts/check-format-versions.test.mjs` — Node pur, comme le
 * script testé. Le contrôleur est importé (`controler`) plutôt que relancé :
 * une seule implémentation, appelée ici avec des dépôts témoins écrits dans
 * un dossier temporaire.
 *
 * Chaque cas ferme une obligation de la politique `docs/versions-formats.md` :
 * une constante sans ligne de registre, une ligne sans constante, un format
 * absent du journal, une dépréciation sans date. Aucune requête réseau, aucun
 * son (AIR-N-01, AIR-N-02).
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { controler } from "./check-format-versions.mjs";

/** Un vocabulaire témoin : les constantes de format qu'on y déclare. */
const vocabulaire = (constantes) => `export const ${constantes.map((c) => `${c[0]} = "${c[1]}"`).join(";\nexport const ")};\n`;

/** La politique témoin : la fenêtre, la date, et les sections de registre. */
const politique = (sections) => `# Politique témoin

Fenêtre de lecture : **6 mois**

Politique en vigueur depuis le 2026-11-12.

${sections.filter(Boolean).join("\n\n")}
`;

/** Une section de registre, avec ses champs. */
const section = (format, champs) => `### \`${format}\`

${champs.map(([cle, valeur]) => `- ${cle} : ${valeur}`).join("\n")}`;

const depot = ({ constantes = [], sections = [], journal = "" }) => {
  const racine = mkdtempSync(join(tmpdir(), "formats-"));
  mkdirSync(join(racine, "packages", "schema", "src"), { recursive: true });
  mkdirSync(join(racine, "docs"), { recursive: true });
  writeFileSync(join(racine, "packages", "schema", "src", "vocab.ts"), vocabulaire(constantes));
  writeFileSync(join(racine, "docs", "versions-formats.md"), politique(sections));
  writeFileSync(join(racine, "CHANGELOG.md"), journal);
  return racine;
};

after(() => {
  // Les dossiers témoins vivent dans le répertoire temporaire du système :
  // ils seront ramassés par lui. Rien d'autre n'a été écrit.
});

describe("les versions de formats sont documentées et datées", () => {
  it("refuse une constante de format absente du registre", () => {
    const racine = depot({
      constantes: [
        ["TAKE_FORMAT", "thin-air-take/1"],
        ["SESSION_FORMAT", "thin-air-session/1"],
      ],
      sections: [section("thin-air-take/1", [["Statut", "actuel"]])],
      journal: "thin-air-take/1 ; thin-air-session/1",
    });
    const ecarts = controler(racine);
    assert.ok(ecarts.some((e) => e.includes("thin-air-session/1") && e.includes("absent de")),
      `le manque attendu n'est pas signalé : ${ecarts.join(" | ")}`);
  });

  it("refuse une ligne de registre sans format vivant dans le vocabulaire", () => {
    const racine = depot({
      constantes: [["TAKE_FORMAT", "thin-air-take/1"]],
      sections: [
        section("thin-air-take/1", [["Statut", "actuel"]]),
        section("thin-air-session/1", [["Statut", "actuel"]]),
      ],
      journal: "thin-air-take/1",
    });
    const ecarts = controler(racine);
    assert.ok(ecarts.some((e) => e.includes("thin-air-session/1") && e.includes("absent du vocabulaire")),
      `la ligne orpheline n'est pas signalée : ${ecarts.join(" | ")}`);
  });

  it("refuse un format absent du journal des versions", () => {
    const racine = depot({
      constantes: [["TAKE_FORMAT", "thin-air-take/1"]],
      sections: [section("thin-air-take/1", [["Statut", "actuel"]])],
      journal: "rien à voir",
    });
    const ecarts = controler(racine);
    assert.ok(ecarts.some((e) => e.includes("thin-air-take/1") && e.includes("absent de CHANGELOG.md")),
      `l'absence au journal n'est pas signalée : ${ecarts.join(" | ")}`);
  });

  it("refuse une dépréciation sans date, et une dépréciation trop courte", () => {
    const sansDate = depot({
      constantes: [
        ["TAKE_FORMAT", "thin-air-take/1"],
        ["TAKE_FORMAT_2", "thin-air-take/2"],
      ],
      sections: [
        section("thin-air-take/1", [["Statut", "deprecie"]]),
        section("thin-air-take/2", [["Statut", "actuel"]]),
      ],
      journal: "thin-air-take/1 ; thin-air-take/2",
    });
    assert.ok(controler(sansDate).some((e) => e.includes("thin-air-take/1") && e.includes("sans date")),
      "la dépréciation sans date n'est pas signalée");

    const tropCourte = depot({
      constantes: [
        ["TAKE_FORMAT", "thin-air-take/1"],
        ["TAKE_FORMAT_2", "thin-air-take/2"],
      ],
      sections: [
        section("thin-air-take/1", [
          ["Statut", "deprecie"],
          ["Déprécié le", "2027-02-15"],
          ["Fin de lecture", "2027-03-01"],
        ]),
        section("thin-air-take/2", [["Statut", "actuel"]]),
      ],
      journal: "thin-air-take/1 ; thin-air-take/2 ; 2027-02-15",
    });
    assert.ok(controler(tropCourte).some((e) => e.includes("avant les 6 mois")),
      "la fenêtre trop courte n'est pas signalée");
  });

  it("accepte un dépôt dont la dépréciation est datée et complète", () => {
    const racine = depot({
      constantes: [
        ["TAKE_FORMAT", "thin-air-take/1"],
        ["TAKE_FORMAT_2", "thin-air-take/2"],
      ],
      sections: [
        section("thin-air-take/1", [
          ["Statut", "deprecie"],
          ["Déprécié le", "2027-02-15"],
          ["Fin de lecture", "2027-08-15"],
        ]),
        section("thin-air-take/2", [["Statut", "actuel"]]),
      ],
      journal: "thin-air-take/1 ; thin-air-take/2 ; 2027-02-15 — déprécié",
    });
    assert.deepEqual(controler(racine), [], "un dépôt complet ne devrait avoir aucun écart");
  });
});
