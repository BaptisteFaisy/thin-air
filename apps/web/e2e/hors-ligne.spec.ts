/**
 * AIR-F-54 — Hors ligne : après une première visite, le système DOIT
 * fonctionner sans réseau. La preuve, dans le vrai Chromium de Playwright
 * (config partagée : `--mute-audio`, aucun son, AIR-N-02), est prise DEUX
 * fois, avec le même code de parcours (`parcoursHorsLigne`) :
 *
 * 1. sur le site construit, servi sous `/thin-air/` (le cas local, d'origine) ;
 * 2. sur l'adresse PUBLIQUE `https://tradoooo.github.io/thin-air/` (le
 *    cas nouveau de ce lot) : c'est là que le service worker est publié, et
 *    c'est là que le visiteur se trouve. Le service worker est livré tel
 *    quel — aucune ligne de `public/sw.js` n'est touchée — il reste à le
 *    prouver tel quel.
 *
 * Dans les deux cas, le parcours est le même :
 *
 * 1. première visite du site ; on attend la fin de l'installation du service
 *    worker (actif, page contrôlée) ;
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
 *    (AIR-N-01).
 *
 * Le cas public ne s'invente pas de vert : si l'adresse publique ne répond
 * pas depuis l'environnement de test, le test est SAUTÉ avec la raison
 * exacte — jamais un faux vert. La preuve écrite est
 * `out/e2e/hors-ligne.json` (local) et `out/e2e/hors-ligne-public.json`
 * (public).
 *
 * Ce que ces specs ne prouvent PAS : la détection de mains hors ligne (le
 * défaut connu de chemin du wasm, voir `README.md`, est indépendant du
 * cache) ni le comportement sur un vrai réseau lent.
 */
import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import {
  BASE_LOCALE,
  BASE_PUBLIQUE,
  MODELE,
  NOM_CACHE,
  WASM,
  adressesLourdes,
  attendWorkerActif,
  compteEnCache,
  ecrisJson,
  journalise,
  lisAdresse,
  nomsDeCache,
  type Mesure,
} from "./aide.js";

/** Ce qu'un parcours hors ligne laisse comme preuve. */
interface Preuve {
  readonly exigence: string;
  readonly base: string;
  readonly porteeDuWorker: string;
  readonly cache: string;
  readonly modeleEnLigne: Mesure;
  readonly modeleHorsLigne: Mesure;
  readonly wasmHorsLigne: Mesure;
  readonly entreesDuJournal: number;
  readonly requetesHorsOrigine: readonly string[];
}

/** Le parcours unique : un site publié, n'importe lequel, se prove comme ça. */
async function parcoursHorsLigne(page: Page, context: BrowserContext, base: string): Promise<Preuve> {
  const origine = new URL(base).origin;
  const journal = journalise(page);

  // 1. Première visite : l'installation ne doit rien bloquer, la page s'affiche.
  await page.goto(base);
  await expect(page.locator("h1")).toHaveText("Thin Air");
  const portee = await attendWorkerActif(page);
  expect(portee).toBe(base);

  // 2. Rechargement en ligne : coquille et assets passent par le worker et
  //    entrent dans le cache ; le modèle et le wasm sont préchauffés en
  //    arrière-plan (téléchargement unique, partagé par conception dans
  //    `sw.js` : une carte de promesses rendues à tous les demandeurs).
  journal.phase("prechauffage");
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Thin Air");

  // Le modèle et le wasm publiés : une seule variante de wasm est
  // préchauffée, celle que le site demande (`vision_wasm_internal.*`). La
  // variante module n'est demandée par aucun chemin du site (preuve :
  // docs/poids-publication.md) : la compter ici ferait échouer le test.
  const lourds = adressesLourdes(base);
  await expect.poll(() => compteEnCache(page, lourds), { timeout: 120_000 }).toBe(lourds.length);
  const coquille = await compteEnCache(page, [base, `${base}index.html`]);
  expect(coquille).toBe(2);
  expect(await nomsDeCache(page)).toContain(NOM_CACHE);

  // En ligne déjà, le modèle est servi depuis le cache, et l'en-tête le dit.
  const modeleEnLigne = await lisAdresse(page, new URL(MODELE, base).toString());
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
  const modeleHorsLigne = await lisAdresse(page, new URL(MODELE, base).toString());
  const wasmHorsLigne = await lisAdresse(page, new URL(WASM, base).toString());
  expect(modeleHorsLigne.statut).toBe(200);
  expect(modeleHorsLigne.source).toBe("cache");
  expect(modeleHorsLigne.octets).toBeGreaterThan(7_000_000);
  expect(wasmHorsLigne.statut).toBe(200);
  expect(wasmHorsLigne.source).toBe("cache");
  expect(wasmHorsLigne.octets).toBeGreaterThan(10_000_000);

  // 4. Aucune requête hors de l'origine du site (AIR-N-01).
  const tierces = journal.entrees.filter((entree) => !entree.url.startsWith(origine));
  expect(tierces).toEqual([]);

  await context.setOffline(false);
  return {
    exigence: "AIR-F-54",
    base,
    porteeDuWorker: portee,
    cache: NOM_CACHE,
    modeleEnLigne,
    modeleHorsLigne,
    wasmHorsLigne,
    entreesDuJournal: journal.entrees.length,
    requetesHorsOrigine: tierces,
  };
}

/** L'adresse publique répond-elle depuis cet environnement ? */
async function testeJoignable(url: string): Promise<{ joignable: boolean; raison: string }> {
  try {
    const reponse = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
    if (reponse.ok) return { joignable: true, raison: "" };
    return { joignable: false, raison: `HTTP ${reponse.status}` };
  } catch (erreur) {
    return { joignable: false, raison: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}

test("AIR-F-54 — après une première visite, la coquille, le modèle et le wasm redémarrent sans réseau", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  const preuve = await parcoursHorsLigne(page, context, BASE_LOCALE);
  const chemin = ecrisJson("hors-ligne.json", preuve);
  console.log(`preuve écrite : ${chemin}`);
});

test("AIR-F-54 — depuis l'adresse publique, la page redémarre sans réseau et le modèle vient du cache", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);

  // 0. L'adresse publique doit répondre depuis cet environnement. Sinon le
  //    test est SAUTÉ, avec la raison exacte : un saut motivé, jamais un
  //    faux vert qui dirait « hors ligne opérationnel » sans l'avoir vu.
  const etat = await testeJoignable(BASE_PUBLIQUE);
  if (!etat.joignable) {
    const chemin = ecrisJson("hors-ligne-public.json", {
      exigence: "AIR-F-54",
      base: BASE_PUBLIQUE,
      verifie: false,
      raison: `adresse publique injoignable depuis l'environnement de test : ${etat.raison}`,
    });
    console.log(`preuve écrite (saut motivé) : ${chemin}`);
    test.skip(true, `adresse publique injoignable depuis l'environnement de test : ${etat.raison}`);
  }

  const preuve = await parcoursHorsLigne(page, context, BASE_PUBLIQUE);
  const chemin = ecrisJson("hors-ligne-public.json", { ...preuve, verifie: true });
  console.log(`preuve écrite : ${chemin}`);
});
