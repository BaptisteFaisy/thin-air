#!/usr/bin/env node
/**
 * Garde des versions de formats (docs/versions-formats.md, cahier §11.4).
 *
 * Elle délègue tout au contrôleur `scripts/check-format-versions.mjs` : une
 * seule implémentation de la règle, exécutée ici dans la file des gardes,
 * donc dans la CI. Le contrôleur est déterministe et ne lit que trois
 * fichiers, aucun réseau, aucun son (AIR-N-01, AIR-N-02).
 *
 * Usage CI : `node scripts/hooks/format-versions-guard.mjs` → 0 si les
 * formats sont documentés et datés, 1 sinon.
 */
import { controler } from "../check-format-versions.mjs";
import { accepter, journaliser, racine, lireChargeUtile, refuser } from "./lib/io.mjs";

const NOM = "format-versions-guard";
const base = racine(await lireChargeUtile());

const ecarts = controler(base);
if (ecarts.length === 0) {
  accepter(`${NOM} — formats documentés et datés`);
}
for (const ecart of ecarts) process.stderr.write(`✗ ${ecart}\n`);
refuser(`${NOM} — ${ecarts.length} écart(s) sur les versions de formats`);