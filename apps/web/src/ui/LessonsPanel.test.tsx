// @vitest-environment happy-dom
/**
 * Les trois leçons : les deux modes, les deux langues, et le fait qu'aucun
 * nombre n'est inventé quand aucune séance n'a mesuré quoi que ce soit.
 * Le rendu statique passe par `react-dom/server` (pas de DOM, pas de son) et
 * le bouton est testé dans un vrai DOM (`happy-dom`) : c'est la seule façon de
 * vérifier que le passage d'un mode à l'autre marche (AIR-N-06).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonsPanel } from "./LessonsPanel.js";
import { lessonsFor } from "../i18n/index.js";
import { publierAnalyse, pousserAnalyse, reinitialiserAnalyse } from "../hooks/analysisStore.js";
import { publierNote, reinitialiserNote } from "../hooks/noteStore.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const en = lessonsFor("en");
const fr = lessonsFor("fr");

function rendre(lang: "en" | "fr" = "en", mode?: "direct" | "exemple"): string {
  const m = lang === "fr" ? fr : en;
  const html = renderToStaticMarkup(<LessonsPanel messages={m} mode={mode} magnet={1} amplitude={0.01} />);
  const texte = html.replace(/<[^>]+>/g, " ");
  // Le rendu statique échappe les apostrophes : on les relit telles quelles.
  return texte
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

beforeEach(() => {
  reinitialiserAnalyse();
  reinitialiserNote();
});

describe("LessonsPanel — mode direct (la séance)", () => {
  it("sans séance, aucun nombre n'est inventé", () => {
    const texte = rendre();
    expect(texte).toContain(en.live.noData);
    expect(texte).not.toMatch(/\d/);
  });

  it("sans séance, le bouton propose l'exemple", () => {
    expect(rendre()).toContain(en.live.showExample);
  });

  it("avec des images analysées, les nombres viennent de la séance", () => {
    pousserAnalyse({ inferenceMs: 12.5, frameIntervalMs: 33.3 }, "worker");
    publierAnalyse();
    const texte = rendre();
    expect(texte).toContain("12.5 ms — measured");
    expect(texte).toContain("33.3 ms — measured");
    expect(texte).toContain("50 ms — estimated");
    expect(texte).toContain("worker");
    expect(texte).toContain(en.live.modeLive);
  });

  it("la note jouée est celle de la séance", () => {
    pousserAnalyse({ inferenceMs: 12.5, frameIntervalMs: 33.3 }, "worker");
    publierAnalyse();
    publierNote({ note: "A4", midi: 69, frequencyHz: 440 });
    expect(rendre()).toContain("A4 · 440.00 Hz");
  });

  it("le mode direct ne montre jamais de nombre d'exemple", () => {
    const texte = rendre();
    expect(texte).not.toContain("48,000 samples");
    expect(texte).not.toContain(en.live.modeDemo);
  });
});

describe("LessonsPanel — mode exemple (prise de synthèse)", () => {
  it("affiche les trois leçons, étiquetées comme exemples", () => {
    const texte = rendre("en", "exemple");
    expect(texte).toContain(en.filter.title);
    expect(texte).toContain(en.cents.title);
    expect(texte).toContain(en.horloges.title);
    expect((texte.match(new RegExp(en.live.modeDemo, "g")) ?? []).length).toBe(3);
  });

  it("n'est jamais étiqueté « mesuré »", () => {
    const texte = rendre("en", "exemple");
    expect(texte).not.toContain(en.live.measured);
  });

  it("donne les nombres en texte, pas seulement en dessin", () => {
    const texte = rendre("en", "exemple");
    expect(texte).toContain("0.24"); // α à l'arrêt, tableau du §7.5
    expect(texte).toContain("0.58"); // α à une largeur de zone par seconde
    expect(texte).toContain("18 cents"); // §5.3
    expect(texte).toContain("48,000 samples"); // l'horloge du son
    expect(texte).toContain("1,600"); // échantillons entre deux images à 30 images/s
    expect(texte).toContain("20 ms"); // la rampe, jamais une marche (§7.9)
  });

  it("trace au moins une courbe par leçon, sans animation continue", () => {
    const html = renderToStaticMarkup(<LessonsPanel messages={en} mode="exemple" />);
    expect((html.match(/<polyline/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).not.toMatch(/<animate|requestAnimationFrame/);
    expect((html.match(/role="img"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("l'aimant à 1 annule l'écart à la gamme", () => {
    const texte = rendre("en", "exemple");
    expect(texte).toMatch(/0\.0 cents/);
  });
});

describe("LessonsPanel — les deux langues", () => {
  it("se rend en français, avec les nombres à la française", () => {
    const texte = rendre("fr", "exemple");
    expect(texte).toContain("Les trois leçons");
    expect(texte).toContain("48 000 échantillons");
    expect(texte).toContain("exemple — prise de synthèse");
    expect(texte).not.toContain("48,000 samples");
  });

  it("se rend en français en direct, mesures et mentions comprises", () => {
    pousserAnalyse({ inferenceMs: 12.5, frameIntervalMs: 33.3 }, "worker");
    publierAnalyse();
    const texte = rendre("fr");
    expect(texte).toContain("12,5 ms — mesuré");
    expect(texte).toContain("50 ms — estimé");
    expect(texte).toContain("direct — cette séance");
  });

  it("sans séance, le message « pas de données » est en français", () => {
    const texte = rendre("fr");
    expect(texte).toContain(fr.live.noData);
    expect(texte).not.toMatch(/\d/);
  });
});

describe("LessonsPanel — le bouton", () => {
  it("bascule du mode direct au mode exemple", async () => {
    const conteneur = document.createElement("div");
    document.body.appendChild(conteneur);
    const racine = createRoot(conteneur);
    await act(async () => {
      racine.render(<LessonsPanel messages={en} />);
    });
    expect(conteneur.textContent).toContain(en.live.noData);
    const bouton = conteneur.querySelector("button");
    expect(bouton?.textContent).toBe(en.live.showExample);
    await act(async () => {
      bouton?.click();
    });
    expect(conteneur.textContent).toContain(en.live.modeDemo);
    await act(async () => {
      racine.unmount();
    });
    conteneur.remove();
  });
});
