/**
 * La page « prise réelle » rendue hors navigateur : `renderToStaticMarkup`
 * n'ouvre aucune caméra et aucun moteur audio (AIR-F-01, AIR-N-02). Les
 * textes viennent du catalogue (AIR-N-14), l'anglais est la langue par défaut.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../i18n/en.js";
import { RealTakePage } from "./RealTake.js";

function rendu(): string {
  return renderToStaticMarkup(<RealTakePage />);
}

describe("page prise réelle (lot N7)", () => {
  it("le titre, la consigne de confidentialité et le bouton caméra sont là", () => {
    const html = rendu();
    expect(html).toContain(en.realTake.title);
    expect(html).toContain("never the image");
    expect(html).toContain(en.realTake.openCamera);
  });

  it("avant la caméra, aucun scénario n'est proposé (AIR-F-01 : rien avant le clic)", () => {
    expect(rendu()).not.toContain(en.realTake.choose);
  });

  it("aucun texte en dur : tout vient des libellés (AIR-N-14)", () => {
    const html = rendu();
    for (const texte of [en.realTake.intro, en.realTake.privacy, en.realTake.back]) {
      expect(html).toContain(texte);
    }
  });

  it("§5.4 — aucun vocabulaire interdit dans les libellés du mode", () => {
    const html = rendu().toLowerCase();
    expect(html).not.toContain("real-time");
    expect(html).not.toContain("zero latency");
  });
});
