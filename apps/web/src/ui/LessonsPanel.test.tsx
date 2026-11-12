/**
 * Le panneau se rend-il, avec les nombres en texte ? Le rendu passe par
 * `react-dom/server` : aucune dépendance de test en plus, aucun DOM réel, et
 * c'est suffisant pour vérifier ce qui est écrit à l'écran (AIR-N-06).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonsPanel } from "./LessonsPanel.js";

const html = renderToStaticMarkup(<LessonsPanel magnet={1} amplitude={0.01} />);
const texte = html.replace(/<[^>]+>/g, " ");

describe("LessonsPanel — les trois leçons sont visibles", () => {
  it("affiche les trois leçons", () => {
    expect(texte).toMatch(/Filtering a trembling hand/);
    expect(texte).toMatch(/Aiming in tune/);
    expect(texte).toMatch(/Stitching two clocks together/);
  });

  it("donne les nombres en texte, pas seulement en dessin", () => {
    expect(texte).toContain("0.24"); // α à l'arrêt, tableau du §7.5
    expect(texte).toContain("0.58"); // α à une largeur de zone par seconde
    expect(texte).toContain("18 cents"); // §5.3
    expect(texte).toContain("48,000 samples"); // l'horloge du son
    expect(texte).toContain("1,600"); // échantillons entre deux images à 30 images/s
    expect(texte).toContain("20 ms"); // la rampe, jamais une marche (§7.9)
  });

  it("trace au moins une courbe par leçon", () => {
    expect((html.match(/<polyline/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("n'anime rien en continu et expose les tracés aux lecteurs d'écran", () => {
    expect(html).not.toMatch(/<animate|requestAnimationFrame/);
    expect((html.match(/role="img"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("sans séance en cours, aucun nombre de retard n'est inventé", () => {
    // Aucune image analysée dans l'environnement de test : le panneau doit le
    // dire, et ne pas afficher de temps d'analyse « mesuré » sorti de nulle part.
    expect(texte).toMatch(/No live data yet/);
    expect(texte).not.toMatch(/Analysis, mean/);
  });

  it("les leçons sur prise de synthèse sont étiquetées comme exemples", () => {
    expect((texte.match(/example — synthetic take/g) ?? []).length).toBe(2);
  });

  it("l'aimant à 1 annule l'écart à la gamme", () => {
    const aimante = renderToStaticMarkup(<LessonsPanel magnet={1} />).replace(/<[^>]+>/g, " ");
    expect(aimante).toMatch(/0\.0 cents/);
  });
});
