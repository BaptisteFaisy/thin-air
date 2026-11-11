/**
 * L'écran d'accueil rendu hors navigateur : `renderToStaticMarkup` ne monte
 * aucune caméra et n'ouvre aucun moteur audio (AIR-F-01, AIR-N-02).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../i18n/en.js";
import { Home } from "./Home.js";

function rendu(): string {
  return renderToStaticMarkup(
    <Home m={en} onStart={() => undefined} onPointer={() => undefined} />,
  );
}

describe("écran d'accueil (cahier §12.1, AIR-N-01)", () => {
  it("les deux portes et la ligne de confidentialité sont là", () => {
    const html = rendu();
    expect(html).toContain(en.home.start);
    expect(html).toContain(en.home.playWithoutCamera);
    expect(html).toContain(en.home.privacyLine);
  });

  it("§5.4 — la promesse dit POURQUOI rien ne quitte le navigateur", () => {
    expect(rendered0()).toContain("inside this tab");
  });

  it("les boutons sont de vrais boutons, atteignables au clavier (AIR-N-06)", () => {
    const html = rendu();
    expect(html.match(/<button type="button"/g)?.length).toBe(2);
    expect(html).toContain("<h1>");
  });

  it("aucun texte en dur : tout vient des libellés (AIR-N-14)", () => {
    const html = rendu();
    for (const texte of [en.home.audioNote, en.home.latencyNote, en.home.keyboardHint]) {
      expect(html).toContain(texte);
    }
  });
});

function rendered0(): string {
  return rendu();
}
