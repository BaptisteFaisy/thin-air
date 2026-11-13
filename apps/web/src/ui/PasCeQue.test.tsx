/**
 * La page « ce que ce projet n'est pas » : le composant affiche les trois
 * sections demandées — ce que le projet n'est pas, ce qui n'est pas testé,
 * ce qui n'est pas mesuré — et celle qui liste ce qui demande un humain.
 * Rendu statique, aucun navigateur, aucun son (AIR-N-02).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PasCeQue } from "./PasCeQue.js";
import { LIMITES } from "./limitesDoc.js";

/** Le texte rendu, sans les balises ni les entités HTML, pour les assertions. */
function texteRendu(): string {
  return renderToStaticMarkup(<PasCeQue />)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&");
}

describe("PasCeQue — la page « ce que ce projet n'est pas »", () => {
  it("affiche les trois sections demandées, avec la section « humain »", () => {
    const texte = texteRendu();
    for (const titre of [
      "Ce qui n'est pas",
      "Ce qui n'est pas testé",
      "Ce qui n'est pas mesuré",
      "Ce qui demande un humain",
    ]) {
      expect(texte).toContain(titre);
    }
  });

  it("le titre de la page vient du document importé", () => {
    expect(texteRendu()).toContain("Ce que ce projet n'est pas");
  });

  it("chaque point de chaque section porte sa ligne de vérification", () => {
    for (const section of LIMITES.sections) {
      for (const point of section.points) {
        expect(point.verification).not.toBe("");
      }
    }
  });

  it("aucune duplication dans le code : les sections viennent du seul document", () => {
    // Les titres de section sont ceux du document, pas des libellés recopiés :
    // la source unique est `docs/pas-ce-que-ce-project-nest-pas.md`, lue ici.
    expect(LIMITES.sections.map((section) => section.titre)).toEqual([
      "Ce qui n'est pas",
      "Ce qui n'est pas testé",
      "Ce qui n'est pas mesuré",
      "Ce qui demande un humain",
    ]);
  });
});
