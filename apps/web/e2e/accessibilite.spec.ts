/**
 * Accessibilité automatisée (cahier §12.4, AIR-N-06, WCAG 2.2 AA) : axe-core
 * sur les huit écrans du §12.1, parcours clavier de tous les contrôles,
 * annonce de la note en cours et des messages d'état, focus visible, et
 * respect du réglage « moins de mouvement » du système. Aucune exception
 * n'est tolérée : la moindre violation critique ou sérieuse fait échouer la
 * spec. Ce qui reste à vérifier à la main (lecteur d'écran réel) est écrit
 * dans `docs/accessibility-report.md`.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { contourFocus, ecrisJson, graves, identifiantActif, injecteAxe, nomAccessible, violationsAxe } from "./aide.js";

/** Les neuf réglages du panneau, par leur identifiant réel dans le DOM. */
const REGLAGES = [
  "setting-snap",
  "setting-left-handed",
  "setting-one-hand",
  "setting-hold",
  "setting-volume",
  "setting-reverb",
  "setting-camera-latency",
  "setting-filter",
  "setting-show-camera",
];

/** Les contrôles de l'éditeur d'instrument, toujours présents (§12.1). */
const EDITEUR = ["editor-scale", "editor-root", "editor-snap", "editor-engine"];

/** Ouvre le jeu sans caméra (P2) et attend la scène. */
async function ouvreLaScene(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Play without a camera" }).click();
  await expect(page.locator("main.stage")).toBeVisible();
}

/** La région étiquetée d'un panneau ouvert (le `section.panel` porte aria-label). */
function region(page: Page, nom: string): Locator {
  return page.getByRole("region", { name: nom });
}

/** Ouvre un panneau du §12.1 par la barre d'outils et attend sa région. */
async function ouvrePanneau(page: Page, bouton: string, titre: string): Promise<void> {
  await page.getByRole("button", { name: bouton, exact: true }).click();
  await expect(region(page, titre)).toBeVisible();
}

/**
 * Lance axe-core sur l'écran courant et écrit la preuve. Zéro exception :
 * toute violation critique ou sérieuse fait échouer le test (AIR-N-06).
 */
async function passeAxe(page: Page, ecran: string): Promise<void> {
  await injecteAxe(page);
  const violations = await violationsAxe(page);
  ecrisJson(`axe-${ecran}.json`, violations);
  expect(graves(violations), `violations critiques ou sérieuses sur ${ecran}`).toEqual([]);
}

/** Ouvre la scène puis un panneau, et passe axe sur la page entière. */
async function axePanneau(page: Page, bouton: string, titre: string, ecran: string): Promise<void> {
  await ouvreLaScene(page);
  await ouvrePanneau(page, bouton, titre);
  await passeAxe(page, ecran);
}

test("axe : l'écran d'accueil n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await page.goto("./");
  await passeAxe(page, "accueil");
});

test("axe : la scène n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await ouvreLaScene(page);
  await passeAxe(page, "scene");
});

test("axe : le tiroir d'instruments n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await axePanneau(page, "Open the instruments", "Instruments", "instruments");
});

test("axe : le panneau de la boucle n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await axePanneau(page, "Loop", "Loop", "boucle");
});

test("axe : le panneau de calibration n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await axePanneau(page, "Calibrate", "Calibrate the play area", "calibration");
});

test("axe : l'éditeur d'instrument n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await ouvreLaScene(page);
  await ouvrePanneau(page, "Open the instruments", "Instruments");
  await dupliqueEtOuvreEditeur(page);
  await passeAxe(page, "editeur");
});

test("axe : le panneau de physique n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await axePanneau(page, "Show the physics", "The physics", "physique");
});

test("axe : le panneau de réglages n'a aucune violation critique ou sérieuse", async ({ page }) => {
  await axePanneau(page, "Settings", "Settings", "reglages");
});

/**
 * Un instrument livré se duplique avant d'être modifié (AIR-F-44) :
 * « Duplicate » ajoute la copie à la bibliothèque et ouvre son éditeur.
 */
async function dupliqueEtOuvreEditeur(page: Page): Promise<void> {
  const tiroir = region(page, "Instruments");
  await tiroir.getByRole("button", { name: "Duplicate" }).first().click();
  await expect(region(page, "Instrument editor")).toBeVisible();
}

test("annonce de la note en cours : région live polie, sans hacher le jeu", async ({ page }) => {
  await ouvreLaScene(page);
  const note = page.locator("p.note");
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute("aria-live", "polite");

  // Messages d'état : l'annonce porte sur la région enveloppante, la liste
  // garde sa sémantique implicite (correctif de la règle axe `listitem`).
  const annonces = page.locator("div.notices-region[role='status'][aria-live='polite']");
  await expect(annonces).toHaveCount(1);
  await expect(annonces.locator("ul.notices")).toHaveCount(1);
  await expect(page.locator("ul.notices")).not.toHaveAttribute("role", "status");
});

test("focus visible : l'anneau apparaît pendant le parcours clavier", async ({ page }) => {
  await ouvreLaScene(page);
  let controles = 0;
  for (let pas = 0; pas < 12 && controles < 3; pas += 1) {
    await page.keyboard.press("Tab");
    if ((await nomAccessible(page)) === "") continue;
    expect(await contourFocus(page), "anneau de focus visible").toBeGreaterThanOrEqual(2);
    controles += 1;
  }
  expect(controles, "au moins trois contrôles atteints au clavier").toBeGreaterThanOrEqual(3);
});

test("parcours clavier : l'accueil, la barre d'outils et tous les réglages", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  expect(await nomAccessible(page)).toBe("Start");
  await page.keyboard.press("Tab");
  expect(await nomAccessible(page)).toBe("Play without a camera");
  await page.keyboard.press("Enter");
  await expect(page.locator("main.stage")).toBeVisible();

  const outils = ["Open the instruments", "Loop", "Calibrate", "Settings", "Show the physics"];
  const nomsVus = await parcours(page, 40);
  for (const outil of outils) expect(nomsVus.has(outil), `outil ${outil} atteignable`).toBe(true);

  await page.getByRole("button", { name: "Settings" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("section.panel")).toBeVisible();

  const atteints = await parcours(page, 60);
  for (const reglage of REGLAGES) {
    expect(atteints.has(reglage), `réglage ${reglage} atteignable`).toBe(true);
    expect((atteints.get(reglage) ?? "").length, `nom de ${reglage}`).toBeGreaterThan(0);
  }

  await page.focus("#setting-volume");
  const avant = await page.getAttribute("#setting-volume", "aria-valuetext");
  await page.keyboard.press("ArrowRight");
  expect(await page.getAttribute("#setting-volume", "aria-valuetext")).not.toBe(avant);

  await page.focus("#setting-left-handed");
  const coche = await page.isChecked("#setting-left-handed");
  await page.keyboard.press("Space");
  expect(await page.isChecked("#setting-left-handed")).toBe(!coche);

  await page.focus("#setting-show-camera");
  await page.keyboard.press("Shift+Tab");
  expect(await identifiantActif(page)).toBe("setting-filter");
});

test("parcours clavier : le tiroir d'instruments puis l'éditeur", async ({ page }) => {
  await ouvreLaScene(page);
  await ouvrePanneau(page, "Open the instruments", "Instruments");

  const tiroir = await parcours(page, 40);
  for (const nom of ["Play this one", "Duplicate", "Copy the link", "Close"]) {
    expect(tiroir.has(nom), `${nom} atteignable au clavier`).toBe(true);
  }
  for (const id of ["instrument-file", "share-link"]) {
    expect(tiroir.has(id), `${id} atteignable au clavier`).toBe(true);
    expect((tiroir.get(id) ?? "").length, `libellé de ${id}`).toBeGreaterThan(0);
  }

  await dupliqueEtOuvreEditeur(page);
  const editeur = await parcours(page, 60);
  for (const id of EDITEUR) {
    expect(editeur.has(id), `${id} atteignable au clavier`).toBe(true);
    expect((editeur.get(id) ?? "").length, `libellé de ${id}`).toBeGreaterThan(0);
  }
  await page.focus("#editor-root");
  const avant = await page.getAttribute("#editor-root", "aria-valuetext");
  await page.keyboard.press("ArrowRight");
  expect(await page.getAttribute("#editor-root", "aria-valuetext")).not.toBe(avant);
});

test("parcours clavier : le panneau de la boucle", async ({ page }) => {
  await ouvreLaScene(page);
  await ouvrePanneau(page, "Loop", "Loop");

  const vus = await parcours(page, 30);
  expect(vus.has("loop-tempo"), "curseur de tempo atteignable").toBe(true);
  expect((vus.get("loop-tempo") ?? "").length, "libellé du tempo").toBeGreaterThan(0);
  expect(vus.has("Record a layer"), "bouton d'enregistrement atteignable").toBe(true);

  await page.focus("#loop-tempo");
  const avant = await page.getAttribute("#loop-tempo", "aria-valuetext");
  await page.keyboard.press("ArrowRight");
  expect(await page.getAttribute("#loop-tempo", "aria-valuetext")).not.toBe(avant);

  // Mesures : un groupe de boutons radio natif — les flèches changent le choix.
  const mesures = page.locator("input[name='loop-bars']");
  expect(await mesures.count()).toBeGreaterThan(1);
  const cocheAvant = await indiceCoche(mesures);
  await mesures.first().focus();
  await page.keyboard.press("ArrowRight");
  expect(await indiceCoche(mesures), "les flèches changent la mesure").not.toBe(cocheAvant);
});

test("parcours clavier : calibration et physique", async ({ page }) => {
  await ouvreLaScene(page);
  await ouvrePanneau(page, "Calibrate", "Calibrate the play area");
  const vus = await parcours(page, 20);
  for (const nom of ["Calibrate the play area", "Start again", "Close"]) {
    expect(vus.has(nom), `${nom} atteignable au clavier`).toBe(true);
  }
  await region(page, "Calibrate the play area").getByRole("button", { name: "Close" }).click();
  await expect(region(page, "Calibrate the play area")).toHaveCount(0);

  // Physique : le bouton de la barre d'outils est un interrupteur
  // (aria-pressed), atteignable et activable au clavier.
  await page.getByRole("button", { name: "Show the physics", exact: true }).click();
  const bouton = page.getByRole("button", { name: "Hide the physics" });
  await expect(bouton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /Waveform/ })).toBeVisible();
  await expect(page.locator("dl.physics dd[aria-live='polite']")).toHaveCount(1);
  await bouton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Show the physics", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test.describe("moins de mouvement (prefers-reduced-motion: reduce)", () => {
  test.use({ reducedMotion: "reduce" });

  test("la scène expose l'état réduit : plus de traîne, plus de vibration", async ({ page }) => {
    await ouvreLaScene(page);
    await expect(page.locator("p.reduced")).toBeVisible();
    await expect(page.locator("p.reduced")).toContainText("less motion");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("p.help[role='status']")).toBeVisible();
  });
});

test("sans préférence du système, rien n'est annoncé", async ({ page }) => {
  await ouvreLaScene(page);
  await expect(page.locator("p.reduced")).toHaveCount(0);
});

/** Tabule `fois` fois et note ce qui reçoit le focus : noms et identifiants. */
async function parcours(page: Page, fois: number): Promise<Map<string, string>> {
  const vus = new Map<string, string>();
  for (let pas = 0; pas < fois; pas += 1) {
    await page.keyboard.press("Tab");
    const nom = await nomAccessible(page);
    const identifiant = await identifiantActif(page);
    if (nom !== "") vus.set(nom, identifiant);
    if (identifiant !== "") vus.set(identifiant, nom);
  }
  return vus;
}

/** L'indice de la case cochée dans un groupe de radios (-1 si aucune). */
async function indiceCoche(groupe: Locator): Promise<number> {
  return groupe.evaluateAll((elements) =>
    elements.findIndex((element) => (element as HTMLInputElement).checked),
  );
}
