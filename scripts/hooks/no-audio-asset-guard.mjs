#!/usr/bin/env node
/**
 * Garde « aucun fichier sonore » (AIR-F-25, AIR-N-11, recette §18).
 *
 * Tout est synthétisé : le dépôt ne contient aucun échantillon. Les rendus du
 * banc d'essai vont dans des dossiers ignorés (`out/`, `bench-out/`, `dist/`).
 *
 * Usage CI : `node scripts/hooks/no-audio-asset-guard.mjs` → 0 si rien.
 */
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const RACINE = process.cwd();
const EXTENSIONS = new Set([".wav", ".mp3", ".ogg", ".oga", ".flac", ".m4a", ".aac", ".opus", ".aiff", ".caf"]);
const IGNORES = ["node_modules", ".git", "out", "bench-out", "dist", "coverage"];

async function* parcours(dossier) {
  let entrees;
  try {
    entrees = await readdir(dossier, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entree of entrees) {
    if (IGNORES.includes(entree.name)) continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) yield* parcours(chemin);
    else if (entree.isFile()) yield chemin;
  }
}

let trouves = 0;
for await (const chemin of parcours(RACINE)) {
  const ext = chemin.slice(chemin.lastIndexOf("."));
  if (EXTENSIONS.has(ext.toLowerCase())) {
    const info = await stat(chemin);
    process.stderr.write(`fichier sonore refusé : ${relative(RACINE, chemin)} (${info.size} octets)\n`);
    trouves += 1;
  }
}
if (trouves > 0) {
  process.stderr.write(`${trouves} fichier(s) sonore(s) : tout doit être synthétisé (AIR-F-25).\n`);
  process.exit(1);
}
process.stdout.write("aucun fichier sonore dans le dépôt\n");
