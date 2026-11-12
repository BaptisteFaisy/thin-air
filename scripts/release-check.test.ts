/**
 * Le contrat de release (`scripts/release-check.mjs`) sur des témoins.
 *
 * Aucun réseau, aucun son, aucun dépôt touché : le monde (tags, changelog,
 * disque, site public) est injecté, donc chaque cas est une fixture lisible.
 *
 * Les cinq refus du contrat sont vérifiés ici : tag absent, tag hors main,
 * changelog manquant, bundle public différent — et le cas où tout va bien.
 *
 * `vitest.config.ts` est gelé (docs/CONTRACT.md) et ne ramasse que
 * `packages/*|apps/*` : ce fichier se lance explicitement —
 * `npx vitest run --config vitest.scripts.config.ts scripts/release-check.test.ts`
 */
import { describe, expect, it } from "vitest";
import {
  ecartsBundle,
  normaliseVersion,
  referencesHtml,
  sectionDuChangelog,
  verifieRelease,
} from "./release-check.mjs";

const SHA_TAG = "a1b2c3d4e5f6".padEnd(40, "0");
const SHA_AUTRE = "9f8e7d6c5b4a".padEnd(40, "0");
const VERSION = "v0.1.0";

const CHANGELOG = `# Changelog

## 0.1.0 — 2026-11-12

- Le premier bundle public.
`;

const BUNDLE = [
  { chemin: "index.html", sha256: "aa".repeat(32) },
  { chemin: "assets/index-abc.js", sha256: "bb".repeat(32) },
];

const SERVI = {
  fichiers: BUNDLE.map((fichier) => ({ chemin: fichier.chemin, sha256: fichier.sha256 })),
  references: ["assets/index-abc.js", "index.html"],
};

/** Un monde qui passe tout, que chaque cas vient casser à sa façon. */
function monde(surcharge: Record<string, unknown> = {}) {
  return {
    listerTags: async () => [{ nom: VERSION, sha: SHA_TAG }],
    tagEstDansMain: async () => true,
    lireChangelog: async () => CHANGELOG,
    lireBundleLocal: async () => BUNDLE,
    lireBundlePublic: async () => SERVI,
    lireCommitLocal: async () => SHA_TAG,
    ...surcharge,
  };
}

describe("le contrat de release", () => {
  it("un tag absent est un refus", async () => {
    const resultat = await verifieRelease(monde({ listerTags: async () => [] }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toContain("tag");
  });

  it("un tag hors main est un refus", async () => {
    const resultat = await verifieRelease(monde({ tagEstDansMain: async () => false }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toContain("main");
  });

  it("un changelog absent est un refus", async () => {
    const resultat = await verifieRelease(monde({ lireChangelog: async () => null }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toContain("CHANGELOG");
  });

  it("un changelog sans section pour la version est un refus", async () => {
    const resultat = await verifieRelease(
      monde({ lireChangelog: async () => "# Changelog\n\n## 0.2.0 — 2026-11-12\n\n- Autre version.\n" }),
      VERSION,
    );
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toContain("section");
  });

  it("un bundle public différent est un refus, avec l'écart nommé", async () => {
    const different = {
      fichiers: SERVI.fichiers.map((fichier) =>
        fichier.chemin === "assets/index-abc.js" ? { ...fichier, sha256: "cc".repeat(32) } : fichier,
      ),
      references: SERVI.references,
    };
    const resultat = await verifieRelease(monde({ lireBundlePublic: async () => different }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toContain("bundle");
    expect(resultat.details.join("\n")).toContain("assets/index-abc.js");
  });

  it("un fichier absent du site public est un refus", async () => {
    const absent = {
      fichiers: SERVI.fichiers.map((fichier) =>
        fichier.chemin === "assets/index-abc.js" ? { ...fichier, sha256: null } : fichier,
      ),
      references: SERVI.references,
    };
    const resultat = await verifieRelease(monde({ lireBundlePublic: async () => absent }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.details.join("\n")).toContain("absent du site public");
  });

  it("une page publique qui référence un fichier absent du bundle est un refus", async () => {
    const etranger = {
      fichiers: SERVI.fichiers,
      references: [...SERVI.references, "assets/index-ancien.js"],
    };
    const resultat = await verifieRelease(monde({ lireBundlePublic: async () => etranger }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.details.join("\n")).toContain("assets/index-ancien.js");
  });

  it("un bundle construit absent est un refus", async () => {
    const resultat = await verifieRelease(monde({ lireBundleLocal: async () => [] }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toContain("bundle construit absent");
  });

  it("un bundle construit qui n'est pas celui du tag est un refus", async () => {
    const resultat = await verifieRelease(monde({ lireCommitLocal: async () => SHA_AUTRE }), VERSION);
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toContain("commit");
  });

  it("tout va bien : tag sur main, changelog, bundle public identique", async () => {
    const resultat = await verifieRelease(monde(), VERSION);
    expect(resultat.ok).toBe(true);
    expect(resultat.details).toEqual([]);
  });
});

describe("les morceaux du contrat", () => {
  it("une version se normalise, avec ou sans préfixe", () => {
    expect(normaliseVersion("v0.1.0")).toBe("0.1.0");
    expect(normaliseVersion("0.1.0 — 2026-11-12")).toBe("0.1.0");
    expect(normaliseVersion("[0.1.0]")).toBe("0.1.0");
    expect(normaliseVersion("1.2.3-rc.1")).toBe("1.2.3-rc.1");
  });

  it("une section de changelog compte quand elle a un contenu", () => {
    expect(sectionDuChangelog(CHANGELOG, "0.1.0")).toBe(true);
    expect(sectionDuChangelog(CHANGELOG, "v0.1.0")).toBe(true);
    expect(sectionDuChangelog(CHANGELOG, "0.2.0")).toBe(false);
    expect(sectionDuChangelog("## 0.1.0\n\n## 0.2.0\n\n- Autre.\n", "0.1.0")).toBe(false);
  });

  it("les références de la page publique sont relatives au site", () => {
    const html = '<script src="/thin-air/assets/index-abc.js"></script><link href="/thin-air/a.css">';
    expect(referencesHtml(html, "https://baptistefaisy.github.io/thin-air/")).toEqual([
      "a.css",
      "assets/index-abc.js",
    ]);
  });

  it("les écarts nomment le fichier et les deux empreintes", () => {
    const ecarts = ecartsBundle(BUNDLE, {
      fichiers: [{ chemin: "index.html", sha256: "aa".repeat(32) }, { chemin: "assets/index-abc.js", sha256: "cc".repeat(32) }],
      references: [],
    });
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("assets/index-abc.js");
  });
});
