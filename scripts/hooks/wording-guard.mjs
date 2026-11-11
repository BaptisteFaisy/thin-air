#!/usr/bin/env node
/**
 * Garde du vocabulaire (cahier §5.4, AIR-F-33, AIR-N-12).
 *
 * Ce qui est écrit          Ce qui est refusé
 * « retard estimé »         « temps réel », « real-time », « instantané »,
 * « retard mesuré »         « instant », « zero latency », « zéro latence »
 * « aimanté sur la gamme »  « toujours juste », « always in tune »
 *
 * Le contrôle porte sur les libellés : la page, ses textes, le README.
 * Les fichiers de garde eux-mêmes citent les mots interdits pour les
 * expliquer : ils sont exclus, comme les tests qui les vérifient.
 *
 * Usage CI : `node scripts/hooks/wording-guard.mjs` → 0 si aucun écart.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const RACINE = process.cwd();
const CIBLES = ["apps/web/src", "apps/web/index.html", "README.md", "instruments", "docs/user"];
const IGNORES = ["node_modules", "dist", ".git"];
const EXCLUS = ["wording-guard", "honest-latency", ".test.ts", ".test.tsx", "CAHIER", "journal.md"];

/** Motif → ce qu'il faut écrire à la place. */
const REGLES = [
  [/\breal[- ]?time\b/gi, "« estimated latency » / « measured latency »"],
  [/\btemps réel\b/gi, "« retard estimé »"],
  [/\binstantané/gi, "« retard mesuré »"],
  [/\binstant(aneous)?\b/gi, "« estimated latency »"],
  [/\bzero latency\b/gi, "« measured latency »"],
  [/\bzéro latence\b/gi, "« retard mesuré »"],
  [/\balways in tune\b/gi, "« notes snap to a scale »"],
  [/\btoujours just(e|es)\b/gi, "« aimanté sur la gamme »"],
];

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

async function* fichiers() {
  for (const cible of CIBLES) {
    const chemin = join(RACINE, cible);
    try {
      const info = await readdir(chemin);
      void info;
      yield* parcours(chemin);
    } catch {
      // Un fichier seul (README.md, index.html) : le traiter directement.
      try {
        const texte = await readFile(chemin, "utf8");
        void texte;
        yield chemin;
      } catch {
        /* absent : rien à contrôler */
      }
    }
  }
}

let ecarts = 0;
for await (const chemin of fichiers()) {
  if (EXCLUS.some((motif) => chemin.includes(motif))) continue;
  const texte = await readFile(chemin, "utf8");
  const lignes = texte.split("\n");
  lignes.forEach((ligne, index) => {
    for (const [regle, remplacement] of REGLES) {
      regle.lastIndex = 0;
      if (regle.test(ligne)) {
        process.stderr.write(
          `${relative(RACINE, chemin)}:${index + 1} vocabulaire refusé — écrire ${remplacement}\n`,
        );
        ecarts += 1;
      }
    }
  });
}
if (ecarts > 0) process.exit(1);
process.stdout.write("vocabulaire conforme (§5.4)\n");
