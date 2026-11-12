/**
 * Niveau 3 de la preuve (cahier §13.1) : la page entière, dans un vrai
 * Chromium, avec un journal réseau et une fausse caméra. On lit le journal
 * des requêtes et le texte affiché, jamais le son : Chromium est lancé muet
 * (`--mute-audio`), aucun périphérique audio n'est ouvert côté test (AIR-N-02).
 *
 * Le jeu au pointeur est observé avec la harpe chargée par le fragment
 * d'adresse (P8) : c'est le seul instrument livrable dont chaque note pincée
 * a une fin observable à l'écran (voix `oneShot`, §7.6). Avec le thérémine
 * par défaut, la note affichée ne suit pas le pointeur : la hauteur glisse
 * par événements `control` et l'affichage ne lit que les `noteOn`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { HARP } from "../src/state/presets.js";
import { instrumentToFragment } from "@thin-air/schema";
import {
  ARGS,
  DOSSIER,
  ORIGINE,
  ecrisJson,
  genereVideo,
  installeSondes,
  journalise,
  lisSondes,
  noteAffichee,
} from "./aide.js";

/** La vidéo de la fausse caméra, écrite dans `out/e2e/` (jamais dans le dépôt). */
const VIDEO = genereVideo(join(DOSSIER, "fixtures", "fausse-camera.y4m"));

/**
 * L'adresse de la harpe : l'instrument du fragment (P8), lu au chargement.
 * Le lien est assemblé ici plutôt que via `shareLink` de
 * `src/state/instruments.ts` : ce module tire `library.ts`, dont l'appel
 * `import.meta.glob` de tête de module n'est résolu que par Vite et casse le
 * chargement des specs par Playwright. L'encodage du fragment reste celui du
 * lot A4 (`instrumentToFragment`) ; seul le marqueur `#i=` est recopié.
 */
const LIEN_HARPE = `${ORIGINE}/thin-air/#i=${instrumentToFragment(HARP)}`;

// `test.use` avec `launchOptions` doit être au niveau du fichier : tous les
// tests d'ici sont donc lancés avec la fausse caméra, ce qui ne change rien
// pour ceux qui ne la demandent jamais.
test.use({ launchOptions: { args: [...ARGS, `--use-file-for-fake-video-capture=${VIDEO}`] } });

test("aucun son : Chromium est lancé muet", () => {
  const config = readFileSync(new URL("../playwright.config.ts", import.meta.url), "utf8");
  expect(config).toContain("--mute-audio");
});

test("l'accueil propose les deux portes du cahier", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toHaveText("Thin Air");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play without a camera" })).toBeVisible();
});

test("P2 : le pointeur joue, la note est en texte, et le journal réseau reste vide", async ({ page }) => {
  const journal = journalise(page);
  await page.goto(LIEN_HARPE);
  await page.getByRole("button", { name: "Play without a camera" }).click();
  await expect(page.locator("main.stage")).toBeVisible();
  await expect(page.locator("p.pointer")).toBeVisible();
  await expect(page.locator("p.instrument")).toContainText("Harp");

  const notes = new Set<string>();
  await balaye(page, notes);
  expect(notes.size).toBeGreaterThan(2);

  journal.phase("jeu");
  await joueVingtSecondes(page, notes);
  expect(notes.size).toBeGreaterThan(3);

  journal.phase("sortie");
  await sorsDuPointeur(page);

  const pendantLeJeu = journal.entrees.filter((entree) => entree.phase === "jeu" || entree.phase === "sortie");
  const etrangeres = journal.entrees.filter((entree) => !entree.url.startsWith(ORIGINE));
  ecrisJson("reseau.json", {
    origine: ORIGINE,
    requetes: journal.entrees,
    total: journal.entrees.length,
    apresChargementPendantLeJeu: pendantLeJeu.length,
    horsOrigine: etrangeres.length,
    notesVues: [...notes],
  });
  expect(pendantLeJeu).toHaveLength(0);
  expect(etrangeres).toHaveLength(0);
});

/**
 * AIR-P-09 vu de l'écran : après la sortie du pointeur, plus aucune note ne
 * doit rester affichée. DÉFAUT PRODUIT CONNU à ce jour : la main virtuelle
 * reste active à sa dernière position (aucun `pointerleave` dans
 * `usePointerHands`) et la voix « lead » tient tant que la main est là — la
 * note reste donc affichée. Le test est marqué `test.fail` : il échoue comme
 * prévu, et le jour où le produit relâche vraiment la note à la sortie, il
 * passera de façon inattendue et Playwright exigera de retirer la marque.
 */
test("AIR-P-09 à l'écran : aucune note ne reste après la sortie du pointeur", async ({ page }) => {
  test.fail(true, "défaut produit : la main virtuelle du pointeur ne se relâche jamais (voir docs/accessibility-report.md)");
  await page.goto(LIEN_HARPE);
  await page.getByRole("button", { name: "Play without a camera" }).click();
  await expect(page.locator("main.stage")).toBeVisible();
  await balaye(page, new Set<string>());
  await sorsDuPointeur(page);
  await expect(page.locator("p.note")).toContainText("silence", { timeout: 5000 });
});

test.describe("fausse caméra (niveau 3)", () => {
  test("la caméra est demandée sans audio, le moteur s'ouvre, l'écran passe par « modèle en chargement »", async ({ page }) => {
    await installeSondes(page);
    const journal = journalise(page);
    await page.goto("./");
    await page.getByRole("button", { name: "Start", exact: true }).click();

    await page.waitForFunction(
      () => {
        const sondes = (window as unknown as { __sondes?: { etats: string[] } }).__sondes;
        return (sondes?.etats ?? []).some((texte) => texte.includes("Loading the hand model"));
      },
      undefined,
      { timeout: 25000 },
    );

    const sondes = await lisSondes(page);
    expect(sondes.contraintes.length).toBeGreaterThan(0);
    const contrainte = sondes.contraintes[0] as { video?: unknown; audio?: unknown } | null;
    expect(contrainte?.video).toBeTruthy();
    expect(contrainte?.audio).toBeFalsy();
    expect(sondes.audio).toBeGreaterThan(0);

    // Le défaut connu de chemin du wasm est corrigé (lot vision) : le modèle
    // charge depuis le site, l'analyse des mains est mesurée et le retard est
    // dit (§5.2) — la séance ne replie plus au pointeur (pas de cameraDenied).
    await expect(page.locator("section.latency p.line")).toContainText("measured", { timeout: 20000 });
    await expect(page.locator(".notice-cameraDenied")).toHaveCount(0);

    // Le modèle et son wasm sont désormais tirés dans le worker d'analyse
    // (lot vision) : leurs requêtes sont invisibles du journal de la page.
    // Leur chargement depuis le site est prouvé par l'analyse mesurée
    // affichée ci-dessus (MODEL_URL et WASM_ROOT dérivent de BASE_URL), et
    // le journal prouve toujours zéro requête vers une origine tierce
    // (AIR-N-01).
    expect(journal.entrees.filter((entree) => !entree.url.startsWith(ORIGINE))).toHaveLength(0);

    ecrisJson("camera.json", {
      contraintes: sondes.contraintes,
      moteurAudioConstruit: sondes.audio,
      etatsVus: sondes.etats,
      requetes: journal.entrees,
    });
  });
});

/** Balaye les cordes de la harpe et note les textes de note vus. */
async function balaye(page: Page, notes: Set<string>): Promise<void> {
  const boite = await page.locator("canvas.scene").boundingBox();
  if (boite === null) throw new Error("la scène n'a pas de boîte");
  for (let pas = 0; pas < 10; pas += 1) {
    await page.mouse.move(boite.x + boite.width * (0.1 + pas * 0.08), boite.y + boite.height * 0.5);
    await page.waitForTimeout(140);
    notes.add(await noteAffichee(page));
  }
}

/** Vingt secondes de jeu au pointeur, sans une seule requête hors du site. */
async function joueVingtSecondes(page: Page, notes: Set<string>): Promise<void> {
  const boite = await page.locator("canvas.scene").boundingBox();
  if (boite === null) throw new Error("la scène n'a pas de boîte");
  for (let pas = 0; pas < 40; pas += 1) {
    const x = boite.x + boite.width * (0.12 + 0.76 * ((pas * 7) % 11) / 10);
    await page.mouse.move(x, boite.y + boite.height * (0.35 + (pas % 3) * 0.1));
    await page.waitForTimeout(470);
    notes.add(await noteAffichee(page));
  }
}

/** Le pointeur sort de la fenêtre : plus aucun mouvement n atteint la page. */
async function sorsDuPointeur(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: -40, y: -40 });
}
