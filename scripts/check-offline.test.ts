/**
 * Le contrôle du mode hors ligne (`scripts/check-offline.mjs`) éprouvé sur un
 * site témoin servi en local : ce que le service worker déclare garder en
 * cache est-il PUBLIÉ, le modèle et son moteur d'exécution sont-ils là en
 * entier, la coquille répond-elle ?
 *
 * Le serveur témoin ne sert que des en-têtes pour les fichiers lourds : le
 * contrôle les interroge en HEAD et lit la taille DÉCLARÉE, jamais le corps.
 * Aucun octet lourd n'est donc téléchargé, et le vrai modèle n'est jamais
 * touché (AIR-N-01).
 *
 *   npx vitest run --config scripts/vitest.scripts.config.ts scripts/check-offline.test.ts
 *
 * Aucun son, aucune requête hors de 127.0.0.1 : le témoin est local.
 */
import { createServer } from "node:http";
import { afterAll, describe, expect, it } from "vitest";

import { controleHorsLigne, listePprechauffage } from "./check-offline.mjs";

/** Les tailles que le témoin déclare pour les fichiers lourds. */
const TAILLE_MODELE = 7_819_105;
const TAILLE_WASM = 14_603_354;

/** La source du service worker témoin : la liste de préchauffage y est lisible. */
const SW = `const LOURDS = [
  "models/hand_landmarker.task",
  "models/wasm/vision_wasm_internal.js",
  "models/wasm/vision_wasm_internal.wasm",
].map((chemin) => new URL(chemin, self.location).href);
`;

/** Le site témoin : ce qui est servi, chemin par chemin. */
interface Temoin {
  /** Les chemins absents (404). */
  absents?: string[];
  /** Le service worker n'est pas publié. */
  sansWorker?: boolean;
  /** Le service worker est publié mais sa liste est illisible. */
  workerMuet?: boolean;
}

/** Démarre le site témoin, et rend son adresse de base. */
async function serveur(temoin: Temoin = {}): Promise<{ base: string; arrete: () => Promise<void> }> {
  const absents = new Set(temoin.absents ?? []);
  const http = createServer((requete, reponse) => {
    const chemin = decodeURIComponent(new URL(requete.url ?? "/", "http://localhost").pathname);
    const methode = requete.method ?? "GET";
    const plage = requete.headers.range;
    /** Répond à une demande de plage : 206 et la taille totale. */
    const repere = (corps: string, type: string, taille: number) => {
      if (plage !== undefined) {
        const borne = /^bytes=(\d+)-(\d*)$/.exec(plage);
        const debut = borne === null ? 0 : Number(borne[1]);
        const fin = borne !== null && borne[2] !== "" ? Number(borne[2]) : taille - 1;
        const morceau = corps.slice(debut, fin + 1);
        reponse.writeHead(206, {
          "content-type": type,
          "content-length": morceau.length,
          "content-range": `bytes ${debut}-${debut + morceau.length - 1}/${taille}`,
        });
        reponse.end(methode === "HEAD" ? undefined : morceau);
        return;
      }
      reponse.writeHead(200, { "content-type": type, "content-length": taille });
      reponse.end(methode === "HEAD" ? undefined : corps);
    };
    if (absents.has(chemin) || (chemin === "/sw.js" && temoin.sansWorker === true)) {
      reponse.writeHead(404, { "content-type": "text/plain" }).end("absent");
      return;
    }
    if (chemin === "/sw.js") {
      repere(temoin.workerMuet === true ? "const AUTRE = [];\n" : SW, "application/javascript; charset=utf-8", 1234);
      return;
    }
    if (chemin.endsWith("hand_landmarker.task")) {
      repere("modele", "application/octet-stream", TAILLE_MODELE);
      return;
    }
    if (chemin.endsWith(".wasm")) {
      repere("wasm", "application/wasm", TAILLE_WASM);
      return;
    }
    if (chemin.endsWith(".js")) {
      repere("// js", "application/javascript; charset=utf-8", 100);
      return;
    }
    repere("<!doctype html><html></html>", "text/html; charset=utf-8", 100);
  });
  await new Promise<void>((resoudre) => http.listen(0, "127.0.0.1", () => resoudre()));
  const port = (http.address() as { port: number }).port;
  return {
    base: `http://127.0.0.1:${port}/`,
    arrete: () => new Promise<void>((resoudre) => http.close(() => resoudre())),
  };
}

const serveurs: (() => Promise<void>)[] = [];

afterAll(async () => {
  for (const arrete of serveurs) await arrete();
});

describe("le mode hors ligne, depuis l'adresse publiée", () => {
  it("un site complet est hors ligne opérationnel", async () => {
    const site = await serveur();
    serveurs.push(site.arrete);
    const resultat = await controleHorsLigne(site.base);
    expect(resultat.verdict, resultat.anomalies.join(" · ")).toBe(true);
    expect(resultat.anomalies).toEqual([]);
  });

  it("la liste de préchauffage est lue dans le service worker", async () => {
    const site = await serveur();
    serveurs.push(site.arrete);
    const resultat = await controleHorsLigne(site.base);
    expect(resultat.precache.map((entree) => entree.chemin)).toEqual([
      "models/hand_landmarker.task",
      "models/wasm/vision_wasm_internal.js",
      "models/wasm/vision_wasm_internal.wasm",
    ]);
  });

  it("un modèle absent est nommé, et le verdict tombe", async () => {
    const site = await serveur({ absents: ["/models/hand_landmarker.task"] });
    serveurs.push(site.arrete);
    const resultat = await controleHorsLigne(site.base);
    expect(resultat.verdict).toBe(false);
    expect(resultat.anomalies.join(" ")).toContain("modele");
  });

  it("un service worker absent est nommé", async () => {
    const site = await serveur({ sansWorker: true });
    serveurs.push(site.arrete);
    const resultat = await controleHorsLigne(site.base);
    expect(resultat.verdict).toBe(false);
    expect(resultat.anomalies.join(" ")).toContain("service worker");
  });

  it("une liste de préchauffage illisible est dite, pas devinée", () => {
    expect(listePprechauffage("const AUTRE = [];\n")).toBeNull();
    expect(listePprechauffage(SW)).toHaveLength(3);
  });
});
