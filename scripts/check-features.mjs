#!/usr/bin/env node
/**
 * La liste figée des fonctionnalités promises, contrôlée contre le code.
 *
 * Usage :
 *   node scripts/check-features.mjs            # contrôle : sort 1 et nomme le manque
 *   node scripts/check-features.mjs --markdown # régénère docs/features.md
 *
 * Le contrôle est bidirectionnel : chaque fonctionnalité de la liste doit
 * être atteignable dans le code (composant exporté qui existe, route
 * réellement lue) et avoir une preuve qui la cite ; chaque route lue et
 * chaque composant livré par le front doit être revendiqué par un écran de
 * la liste. Le détail des règles est dans `scripts/lib/features-liste.mjs`.
 *
 * Aucune requête réseau, aucun son : lecture de fichiers seulement.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHEMIN_DOCUMENT,
  CHEMIN_LISTE,
  controler,
  lireListe,
  markdown,
} from "./lib/features-liste.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Les options de la ligne de commande. */
function options(argv) {
  const vues = { markdown: false, liste: CHEMIN_LISTE };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--markdown") vues.markdown = true;
    else if (argument === "--liste") index += 1, (vues.liste = argv[index] ?? CHEMIN_LISTE);
  }
  return vues;
}

/** Écrit le document lisible, dérivé de la liste. */
function ecrireMarkdown(donnees) {
  const chemin = join(RACINE, CHEMIN_DOCUMENT);
  writeFileSync(chemin, markdown(RACINE, donnees), "utf8");
  process.stdout.write(`${CHEMIN_DOCUMENT} régénéré depuis ${CHEMIN_LISTE}\n`);
}

/** Le point d'entrée : contrôle ou régénération. */
function main() {
  const vues = options(process.argv.slice(2));
  const donnees = lireListe(RACINE, vues.liste);
  if (donnees === null) {
    process.stderr.write(`la liste ${vues.liste} est introuvable ou illisible\n`);
    return 1;
  }
  if (vues.markdown) {
    ecrireMarkdown(donnees);
    return 0;
  }
  const problemes = controler(RACINE, donnees);
  if (problemes.length === 0) {
    process.stdout.write(`les ${donnees.fonctionnalites.length} fonctionnalités promises sont dans le code\n`);
    return 0;
  }
  for (const probleme of problemes) process.stderr.write(`manque : ${probleme}\n`);
  process.stderr.write(`${problemes.length} manque(s) entre la liste et le code\n`);
  return 1;
}

process.exit(main());
