/**
 * Le registre des preuves : le manifeste existe, chaque entrée est complète,
 * et le composant affiche une ligne par preuve.
 *
 * Le test lit les fichiers du dépôt (le manifeste et le dernier résultat) et
 * rend le panneau par `react-dom/server` — comme les autres panneaux : aucune
 * dépendance de test en plus, aucun DOM réel (AIR-N-06).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PreuvesPanel } from "./PreuvesPanel.js";

interface EntreeManifeste {
  readonly id: string;
  readonly titre: string;
  readonly commande: string;
  readonly attendu: string;
  readonly fichier: string;
}

interface PreuveResultat {
  readonly id: string;
  readonly ok: boolean;
  readonly code: number;
  readonly dureeMs: number;
  readonly date: string;
  readonly extrait: readonly string[];
  readonly mesure: number | null;
}

const RACINE = new URL("../../../../", import.meta.url);

/** Le manifeste des preuves, lu dans le dépôt. */
const manifeste = JSON.parse(readFileSync(new URL("docs/preuves.json", RACINE), "utf8")) as {
  readonly preuves: readonly EntreeManifeste[];
};

/** Le dernier résultat écrit par `scripts/verification.mjs`. */
const resultat = JSON.parse(
  readFileSync(new URL("docs/preuves-resultat.json", RACINE), "utf8"),
) as {
  readonly total: number;
  readonly ok: number;
  readonly ko: number;
  readonly preuves: readonly PreuveResultat[];
};

const html = renderToStaticMarkup(<PreuvesPanel />);

describe("Le manifeste des preuves", () => {
  it("existe et liste des preuves", () => {
    expect(Array.isArray(manifeste.preuves)).toBe(true);
    expect(manifeste.preuves.length).toBeGreaterThan(0);
  });

  it("donne à chaque preuve une commande et un attendu", () => {
    for (const preuve of manifeste.preuves) {
      expect(preuve.commande.trim(), `${preuve.id} sans commande`).not.toBe("");
      expect(preuve.attendu.trim(), `${preuve.id} sans attendu`).not.toBe("");
      expect(preuve.titre.trim(), `${preuve.id} sans titre`).not.toBe("");
      expect(preuve.fichier.trim(), `${preuve.id} sans fichier`).not.toBe("");
    }
  });

  it("n'a pas deux fois le même identifiant", () => {
    const identifiants = manifeste.preuves.map((preuve) => preuve.id);
    expect(new Set(identifiants).size).toBe(identifiants.length);
  });
});

describe("Le dernier résultat écrit", () => {
  it("existe et couvre chaque preuve du manifeste", () => {
    expect(resultat.total).toBe(manifeste.preuves.length);
    const mesures = new Set(resultat.preuves.map((preuve) => preuve.id));
    for (const preuve of manifeste.preuves) {
      expect(mesures.has(preuve.id), `${preuve.id} sans résultat`).toBe(true);
    }
  });

  it("donne à chaque preuve un état, une date, une durée et un extrait", () => {
    for (const preuve of resultat.preuves) {
      expect(typeof preuve.ok).toBe("boolean");
      expect(preuve.date.length).toBeGreaterThan(0);
      expect(preuve.dureeMs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(preuve.extrait)).toBe(true);
    }
  });
});

describe("Le panneau du site", () => {
  it("affiche une ligne par preuve", () => {
    const lignes = (html.match(/data-preuve="/g) ?? []).length;
    expect(lignes).toBe(manifeste.preuves.length);
  });

  it("donne l'état de chaque preuve en toutes lettres", () => {
    const etats = [...html.matchAll(/data-etat="([^"]+)"/g)].map((m) => m[1]);
    expect(etats.length).toBe(manifeste.preuves.length);
    for (const etat of etats) expect(["ok", "ko"]).toContain(etat);
  });

  it("affiche la date, la durée et l'extrait", () => {
    expect(html).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(html).toMatch(/\d+(\.\d+)? (ms|s|min)/);
    expect(html).toContain("data-preuve");
  });

  it("affiche la commande qui rejoue chaque preuve", () => {
    for (const preuve of manifeste.preuves) {
      expect(html, `${preuve.id} sans commande affichée`).toContain(preuve.commande.slice(0, 24));
    }
  });

  it("n'anime rien et expose le tableau aux lecteurs d'écran", () => {
    expect(html).not.toMatch(/<animate|requestAnimationFrame/);
    expect(html).toContain("<table>");
    expect((html.match(/scope="col"/g) ?? []).length).toBeGreaterThan(0);
  });
});
