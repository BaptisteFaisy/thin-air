/**
 * AIR-F-54 — Hors ligne : après une première visite, le système DOIT
 * fonctionner sans réseau. La preuve, dans le vrai Chromium de Playwright
 * (config partagée : `--mute-audio`, aucun son, AIR-N-02) :
 *
 * 1. première visite du site construit, servi sous `/thin-air/` ; on attend
 *    la fin de l'installation du service worker (actif, page contrôlée) ;
 * 2. on recharge une fois en ligne : la coquille et les assets passent par
 *    le worker et entrent dans le cache (comportement normal d'un worker :
 *    il ne contrôle la page qu'à partir du chargement suivant) ; pendant ce
 *    temps le modèle et son wasm sont préchauffés en arrière-plan ;
 * 3. on COUPE le réseau (`context.setOffline(true)`, émulation de
 *    coupure au niveau du navigateur) et on recharge : la page redémarre,
 *    le jeu au pointeur fonctionne, et le modèle comme le wasm sont servis
 *    depuis le cache — prouvé par l'en-tête `x-thin-air-source: cache`
 *    posé par le worker et par la taille complète des fichiers lus hors
 *    ligne ;
 * 4. tout le journal réseau de la visite reste sur l'origine du site
 *    (AIR-N-01). Preuve écrite : `out/e2e/hors-ligne.json`.
 *
 * Ce que cette spec ne prouve PAS : la détection de mains hors ligne (le
 * défaut connu de chemin du wasm, voir `README.md`, est indépendant du
 * cache) ni le comportement sur un vrai réseau lent.
 */
import { expect, test } from "@playwright/test";
import { ORIGINE, ecrisJson, journalise } from "./aide.js";

/** Le nom du cache, tel que versionné dans `public/sw.js`. */
const NOM_CACHE = "thin-air-v1";

/** Le modèle et l'un de ses fichiers d'exécution, sous la racine publiée. */
const MODELE = `${ORIGINE}/thin-air/models/hand_landmarker.task`;
const WASM = `${ORIGINE}/thin-air/models/wasm/vision_wasm_internal.wasm`;

/** Attend que le service worker soit installé, actif, et contrôle la page. */
async function attendWorkerActif(page: import("@playwright/test").Page): Promise<string> {
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const registre = await navigator.serviceWorker.getRegistration("/thin-air/");
        if (registre === undefined) return "absent";
        if (registre.active === null) return "installation";
        return navigator.serviceWorker.controller === null ? "actif-non-controle" : "actif";
      }),
    )
    .toBe("actif");
  return page.evaluate(async () => {
    const registre = await navigator.serviceWorker.getRegistration("/thin-air/");
    return registre?.scope ?? "";
  });
}

/** Compte, dans le cache nommé, combien des adresses données s'y trouvent. */
function compteEnCache(page: import("@playwright/test").Page, adresses: string[]): Promise<number> {
  return page.evaluate(
    async ([nomCache, liste]: [string, string[]]) => {
      if (!(await caches.has(nomCache))) return 0;
      const cache = await caches.open(nomCache);
      let trouves = 0;
      for (const adresse of liste) {
        if ((await cache.match(adresse)) !== undefined) trouves += 1;
      }
      return trouves;
    },
    [NOM_CACHE, adresses] as [string, string[]],
  );
}

/** Lit une adresse hors ligne et rapporte statut, origine déclarée et taille. */
function lisHorsLigne(page: import("@playwright/test").Page, adresse: string) {
  return page.evaluate(async (url) => {
    const reponse = await fetch(url);
    const octets = await reponse.arrayBuffer();
    return {
      statut: reponse.status,
      source: reponse.headers.get("x-thin-air-source"),
      octets: octets.byteLength,
    };
  }, adresse);
}

test("AIR-F-54 — après une première visite, la coquille, le modèle et le wasm redémarrent sans réseau", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const journal = journalise(page);

  // 1. Première visite : l'installation ne doit rien bloquer, la page s'affiche.
  await page.goto("./");
  await expect(page.locator("h1")).toHaveText("Thin Air");
  const portee = await attendWorkerActif(page);
  expect(portee).toBe(`${ORIGINE}/thin-air/`);

  // 2. Rechargement en ligne : coquille et assets passent par le worker et
  //    entrent dans le cache ; le modèle et le wasm sont préchauffés en
  //    arrière-plan (téléchargement unique, partagé par conception dans
  //    `sw.js` : une carte de promesses rendues à tous les demandeurs).
  journal.phase("prechauffage");
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Thin Air");

  const lourds = [
    MODELE,
    WASM,
    `${ORIGINE}/thin-air/models/wasm/vision_wasm_internal.js`,
    `${ORIGINE}/thin-air/models/wasm/vision_wasm_module_internal.js`,
    `${ORIGINE}/thin-air/models/wasm/vision_wasm_module_internal.wasm`,
  ];
  await expect.poll(() => compteEnCache(page, lourds), { timeout: 60_000 }).toBe(lourds.length);
  const coquille = await compteEnCache(page, [`${ORIGINE}/thin-air/`, `${ORIGINE}/thin-air/index.html`]);
  expect(coquille).toBe(2);

  // En ligne déjà, le modèle est servi depuis le cache, et l'en-tête le dit.
  const modeleEnLigne = await lisHorsLigne(page, MODELE);
  expect(modeleEnLigne.statut).toBe(200);
  expect(modeleEnLigne.source).toBe("cache");

  // 3. Coupure réseau totale, puis rechargement : tout doit repartir du cache.
  journal.phase("hors-ligne");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Thin Air");

  // Le jeu au pointeur démarre sans réseau (AIR-F-02, P6).
  await page.getByRole("button", { name: "Play without a camera" }).click();
  await expect(page.locator("main.stage")).toBeVisible();

  // Le modèle et le wasm sont servis depuis le cache, en entier.
  const modeleHorsLigne = await lisHorsLigne(page, MODELE);
  const wasmHorsLigne = await lisHorsLigne(page, WASM);
  expect(modeleHorsLigne.statut).toBe(200);
  expect(modeleHorsLigne.source).toBe("cache");
  expect(modeleHorsLigne.octets).toBeGreaterThan(7_000_000);
  expect(wasmHorsLigne.statut).toBe(200);
  expect(wasmHorsLigne.source).toBe("cache");
  expect(wasmHorsLigne.octets).toBeGreaterThan(10_000_000);

  // 4. Aucune requête hors de l'origine du site (AIR-N-01).
  const tierces = journal.entrees.filter((entree) => !entree.url.startsWith(ORIGINE));
  expect(tierces).toEqual([]);

  const preuve = ecrisJson("hors-ligne.json", {
    exigence: "AIR-F-54",
    porteeDuWorker: portee,
    cache: NOM_CACHE,
    modeleEnLigne,
    modeleHorsLigne,
    wasmHorsLigne,
    entreesDuJournal: journal.entrees.length,
    requetesTierces: tierces,
  });
  await context.setOffline(false);
  console.log(`preuve écrite : ${preuve}`);
});
