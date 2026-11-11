/**
 * Le garde `no-sound-guard` testé comme Kiro l'emploie : en processus enfant,
 * la charge utile JSON sur l'entrée standard, le verdict dans le code de
 * sortie (cahier §14.3, AIR-N-02, preuve `docs/preuves/no-sound-guard.log`).
 *
 * Les charges sont celles de `guard-cases.ts` — la même liste que le journal
 * figé. AUCUNE commande n'est exécutée : ce sont des chaînes lues par le
 * garde, qui les refuse ou les accepte sans rien lancer. Aucun son n'est
 * émis : on teste le GARDE, pas le lecteur.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAS_ACCEPTES, CAS_REFUSES, chargeUtile } from "./guard-cases.js";
import { lancerGarde } from "./run-guard.js";

const racine = fileURLToPath(new URL("../../../..", import.meta.url));
const HOOK = `${racine}scripts/hooks/no-sound-guard.mjs`;

async function verdict(commande: string) {
  return lancerGarde(HOOK, chargeUtile(commande, racine));
}

describe("no-sound-guard — refus (§14.3, AIR-N-02)", () => {
  for (const cas of CAS_REFUSES) {
    it(`refuse : ${cas.nom}`, async () => {
      const reponse = await verdict(cas.commande);
      expect(reponse.code).not.toBe(0);
      expect(reponse.message).toContain("no-sound-guard");
    });
  }
});

describe("no-sound-guard — acceptations", () => {
  for (const cas of CAS_ACCEPTES) {
    it(`accepte : ${cas.nom}`, async () => {
      const reponse = await verdict(cas.commande);
      expect(reponse.code).toBe(0);
      expect(reponse.message).toContain("commande sans son");
    });
  }
});

describe("no-sound-guard — cas limites", () => {
  it("charge utile sans commande (CI, run-all-guards) : rien à contrôler, code 0", async () => {
    // `{}` n'a pas de `tool_input` : pas de commande à contrôler. C'est le
    // comportement attendu quand run-all-guards.mjs lance la garde à nu.
    const reponse = await lancerGarde(HOOK, {});
    expect(reponse.code).toBe(0);
    expect(reponse.message).toContain("aucune commande");
  });

  it("un lecteur audio caché derrière un tuyau est quand même refusé", async () => {
    const reponse = await verdict("cat bench-out/slow-rise.wav | aplay -");
    expect(reponse.code).not.toBe(0);
  });
});
