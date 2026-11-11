#!/usr/bin/env node
/**
 * Propriétés du `core` (cahier §14.3, §13.2 : AIR-P-01 à 12).
 *
 * Déclenchée à l'enregistrement d'un fichier de `packages/core/**`, elle
 * lance le banc Vitest du paquet : le calcul pur, dans Node, sans
 * navigateur ni périphérique audio (AIR-N-02).
 *
 * Repli explicite : tant qu'aucun fichier de test n'existe dans
 * `packages/core/src/` — les lots A1, A2, A3, B1 et B2 ne sont pas mergés —
 * la garde sort 0 et dit pourquoi. Un test qui échoue, lui, sort non nul.
 *
 * Usage : `node scripts/hooks/core-properties.mjs` → 0 si les propriétés
 * passent, ou si aucune n'est encore écrite.
 */
import { estAbsent, estEnChantier, lancer } from "./lib/lancer.mjs";
import { accepter, fichiersSous, journaliser, lireChargeUtile, racine, refuser } from "./lib/io.mjs";

const NOM = "core-properties";
const CIBLE = "packages/core/src";
const PROPRIETES = "AIR-P-01 à 12";

/** Sortie propre et journalisée quand une dépendance d'un autre lot manque. */
async function repli(base, raison) {
  await journaliser(base, { garde: NOM, evenement: "repli", raison });
  accepter(`${NOM} — repli : ${raison}`);
}

const chargeUtile = await lireChargeUtile();
const base = racine(chargeUtile);

let bancs = 0;
for await (const chemin of fichiersSous(`${base}/${CIBLE}`)) {
  if (chemin.endsWith(".test.ts")) bancs += 1;
}
if (bancs === 0) {
  await repli(base, `aucun banc dans ${CIBLE}/ : les propriétés ${PROPRIETES} ne sont pas encore écrites`);
}

const resultat = await lancer("npx", ["vitest", "run", CIBLE, "--reporter=dot"], { cwd: base });
if (estEnChantier(resultat) || estAbsent(resultat)) {
  await repli(base, `banc non exécutable (lots amont) : ${(resultat.erreur || resultat.sortie).split("\n")[0] ?? ""}`.slice(0, 300));
}
if (resultat.code !== 0) {
  await journaliser(base, { garde: NOM, evenement: "refus", bancs, code: resultat.code });
  process.stderr.write(resultat.sortie.slice(-2000));
  process.stderr.write(resultat.erreur.slice(-2000));
  refuser(`${NOM} : les propriétés ${PROPRIETES} ne passent pas (code ${resultat.code})`);
}
await journaliser(base, { garde: NOM, evenement: "acceptation", bancs });
accepter(`${NOM} : ${bancs} banc(s) du core passent — propriétés ${PROPRIETES}`);
