// @vitest-environment happy-dom
/**
 * L'éditeur rendu hors navigateur (AIR-F-44) : `renderToStaticMarkup` ne monte
 * aucune caméra et n'ouvre aucun moteur audio (AIR-N-02). On y vérifie la
 * validation en direct : enregistrement désactivé tant que le schéma refuse,
 * raisons affichées près du champ concerné.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Instrument } from "@thin-air/core";
import { en } from "../i18n/en.js";
import { builtInByName } from "../state/library.js";
import { duplicate } from "../state/instruments.js";
import { InstrumentEditor } from "./InstrumentEditor.js";

const ferme = () => undefined;
const copie = () => duplicate(builtInByName("Harp")!, (nom) => `${nom} (copy)`);

function rendu(instrument: Instrument, readOnly = false): string {
  return renderToStaticMarkup(
    <InstrumentEditor m={en} instrument={instrument} readOnly={readOnly} onSave={ferme} onClose={ferme} />,
  );
}

describe("éditeur d'instrument (cahier §12.1, AIR-F-44)", () => {
  it("une copie valide s'enregistre : le bouton est actif", () => {
    const html = rendu(copie());
    expect(html).toContain(en.editor.title);
    expect(html).toContain(en.editor.save);
    expect(html).not.toContain("disabled");
  });

  it("un nom vide est refusé en direct : raisons près du champ, enregistrement désactivé", () => {
    const html = rendu({ ...copie(), name: "" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("name:");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*Save/);
  });

  it("un aimant hors bornes est refusé en direct, jamais réparé", () => {
    const html = rendu({ ...copie(), snap: 3 });
    expect(html).toContain('role="alert"');
    expect(html).toContain("snap:");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("les huit gammes du §7.7 et les moteurs sont proposés", () => {
    const html = rendu(copie());
    for (const gamme of ["wholeTone", "chromatic", "harmonicMinor", "majorPentatonic"]) {
      expect(html).toContain(gamme);
    }
    for (const moteur of ["osc", "pluck", "fm", "drum"]) {
      expect(html).toContain(moteur);
    }
  });

  it("un instrument livré est en lecture seule : dupliquer d'abord (AIR-F-44)", () => {
    const html = rendu(builtInByName("Harp")!, true);
    expect(html).toContain(en.editor.duplicateFirst);
    expect(html).toContain("<fieldset disabled");
  });

  it("chaque champ porte un libellé lisible par un lecteur d'écran (§12.4)", () => {
    const html = rendu(copie());
    for (const id of ["editor-name", "editor-scale", "editor-root", "editor-snap", "editor-engine", "editor-count"]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });
});
