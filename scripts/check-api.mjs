#!/usr/bin/env node
/**
 * Garde du contrat d'API publique — `docs/api-surface.json` contre le code.
 *
 * La surface publique de `core`, `audio`, `schema` et `vision` est figée
 * (`docs/contract-api.md`) : ce script relit les `index.ts` des paquets, suit
 * leurs ré-exports, et compare ce qui sort réellement avec ce que le contrat
 * annonce. Il signale, en nommant le symbole :
 *
 *   - un export disparu (retiré ou renommé) ;
 *   - un export ajouté (présent dans le code, absent du contrat) ;
 *   - un type changé (signature, annotation, ou forme d'un type).
 *
 * Node pur, sans dépendance : les fichiers sont analysés, jamais compilés.
 *
 * Usage :
 *   node scripts/check-api.mjs                       # vérifie le dépôt
 *   node scripts/check-api.mjs --racine <dossier>     # autre dépôt (test)
 *   node scripts/check-api.mjs --surface <fichier>    # autre contrat
 *   node scripts/check-api.mjs --liste                # ce que les paquets exportent
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportsDuFichier, surfacePaquet, paquetsDuDepot } from "./lib/api-parse.mjs";

const RACINE_DEFAUT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------- comparaison */

/** Compare le contrat au code : la liste des écarts, texte prêt à afficher. */
function comparePaquet(nomPaquet, contrat, reel) {
  const ecarts = [];
  const attendus = contrat.exports ?? {};
  for (const [nom, attendu] of Object.entries(attendus)) {
    const trouve = reel.get(nom);
    if (!trouve) {
      ecarts.push(`${nomPaquet} : export disparu — \`${nom}\` n'est plus exporté (contrat : ${attendu.kind} ${attendu.type})`);
      continue;
    }
    if (trouve.kind !== attendu.kind || trouve.type !== attendu.type) {
      ecarts.push(
        `${nomPaquet} : type changé — \`${nom}\` : contrat « ${attendu.kind} ${attendu.type} » → code « ${trouve.kind} ${trouve.type} »`,
      );
    }
  }
  for (const nom of reel.keys()) {
    if (!(nom in attendus)) {
      ecarts.push(`${nomPaquet} : export ajouté — \`${nom}\` est exporté par le code mais absent du contrat`);
    }
  }
  return ecarts;
}

/* ------------------------------------------------------------------- sortie */

/** La commande, ses options, et le code de sortie. */
function main(argv) {
  const options = { racine: RACINE_DEFAUT, surface: null, liste: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--racine") options.racine = argv[++i];
    else if (argv[i] === "--surface") options.surface = argv[++i];
    else if (argv[i] === "--liste") options.liste = true;
  }
  const racine = options.racine;
  const surface = options.surface ?? join(racine, "docs", "api-surface.json");
  const cache = new Map();
  const paquets = paquetsDuDepot(racine);
  const reels = new Map();
  for (const nom of paquets) {
    const surfaceReelle = surfacePaquet(racine, nom, cache);
    if (surfaceReelle) reels.set(nom, surfaceReelle);
  }
  if (options.liste) {
    for (const [nom, exports] of reels) {
      for (const [symbole, d] of [...exports].sort((a, b) => a[0].localeCompare(b[0]))) {
        process.stdout.write([nom, symbole, d.kind, d.type, d.description].join("\t") + "\n");
      }
    }
    return 0;
  }
  if (!existsSync(surface)) {
    process.stderr.write(`contrat introuvable : ${surface}\n`);
    return 1;
  }
  const contrat = JSON.parse(readFileSync(surface, "utf8"));
  const ecarts = [];
  for (const nom of Object.keys(contrat.packages ?? {})) {
    if (!reels.has(nom)) {
      ecarts.push(`${nom} : paquet introuvable — le contrat annonce un paquet qui n'existe pas dans packages/`);
      continue;
    }
    ecarts.push(...comparePaquet(nom, contrat.packages[nom], reels.get(nom)));
  }
  for (const nom of reels.keys()) {
    if (!(nom in (contrat.packages ?? {}))) {
      ecarts.push(`${nom} : paquet non couvert — le contrat doit décrire la surface de ce paquet`);
    }
  }
  if (ecarts.length > 0) {
    for (const ecart of ecarts) process.stderr.write(`✗ ${ecart}\n`);
    process.stderr.write(`✗ contrat d'API : ${ecarts.length} écart(s) — voir docs/contract-api.md\n`);
    return 1;
  }
  const total = [...reels.values()].reduce((n, exports) => n + exports.size, 0);
  const detail = [...reels].map(([nom, exports]) => `${nom} ${exports.size}`).join(", ");
  process.stdout.write(`✓ contrat d'API : ${total} exports figés (${detail})\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
