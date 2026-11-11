// @vitest-environment happy-dom
/**
 * Le tiroir d'instruments rendu hors navigateur (§12.1) : aucune caméra, aucun
 * moteur audio (AIR-N-02). On y vérifie les deux listes, les métadonnées de
 * chaque entrée et le lien de partage (AIR-F-45).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Instrument } from "@thin-air/core";
import { en } from "../i18n/en.js";
import { BUILT_IN, builtInByName } from "../state/library.js";
import { duplicate, edit, shareLink } from "../state/instruments.js";
import { InstrumentsDrawer } from "./InstrumentsDrawer.js";

const rien = () => undefined;

function rendu(library: readonly Instrument[], courant: Instrument): string {
  return renderToStaticMarkup(
    <InstrumentsDrawer
      m={en}
      library={library}
      current={courant}
      link={shareLink(courant, "https://exemple.test/thin-air/")}
      onUse={rien}
      onDuplicate={rien}
      onEdit={rien}
      onImport={rien}
      onClose={rien}
    />,
  );
}

describe("tiroir d'instruments (cahier §12.1, AIR-F-43, 45)", () => {
  it("les deux listes : les livrés et les tiens, avec dupliquer partout", () => {
    const copie = duplicate(builtInByName("Harp")!, (nom) => `${nom} (copy)`);
    const html = rendu([...BUILT_IN, copie], copie);
    expect(html).toContain(en.instruments.builtIn);
    expect(html).toContain(en.instruments.yours);
    for (const nom of ["Phantom", "Harp", "Choir", "Bells", "Drone", "Harp (copy)"]) {
      expect(html).toContain(nom);
    }
    expect(html.match(/Duplicate/g)?.length).toBe(BUILT_IN.length + 1);
  });

  it("chaque entrée dit son moteur et son aimant", () => {
    const html = rendu(BUILT_IN, builtInByName("Phantom")!);
    expect(html).toContain("pluck");
    expect(html).toContain("osc");
    expect(html).toContain("0.6");
    expect(html).toContain(`aria-label="${en.editor.engine}"`);
    expect(html).toContain(`aria-label="${en.editor.snap}"`);
  });

  it("l'entrée en cours est marquée pour le lecteur d'écran (§12.4)", () => {
    const html = rendu(BUILT_IN, builtInByName("Phantom")!);
    expect(html).toContain('aria-current="true"');
  });

  it("le lien de partage est visible et copiable, fragment compris (AIR-F-45)", () => {
    const phantom = builtInByName("Phantom")!;
    const html = rendu(BUILT_IN, phantom);
    expect(html).toContain(en.instruments.copyLink);
    expect(html).toContain("#i=");
    expect(html).toContain(en.instruments.shareHint);
  });

  it("sans instrument à toi, le tiroir le dit et propose de dupliquer", () => {
    const html = rendu(BUILT_IN, builtInByName("Phantom")!);
    expect(html).toContain(en.instruments.emptyMine);
  });

  it("un instrument à toi se modifie, un livré non (AIR-F-44)", () => {
    const copie = edit(duplicate(builtInByName("Harp")!, (nom) => `${nom} (copy)`), { count: 12 });
    const html = rendu([...BUILT_IN, copie], copie);
    expect(html).toContain(en.instruments.edit);
    expect(html.match(new RegExp(en.instruments.edit, "g"))?.length).toBe(1);
  });
});
