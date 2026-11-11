#!/usr/bin/env node
/**
 * Rappel de journal de bord (cahier §14.3, §17.3, recette §18).
 *
 * Déclenchée après une tâche de spec, elle ajoute une ligne au journal :
 * ce que les mesures ne prouvent pas (§13.4) — la séance d'écoute humaine,
 * les réglages qui en découlent — doit y être noté avec sa date. La garde
 * ne juge rien : elle écrit le rappel et sort 0, sauf si le journal est
 * illisible.
 *
 * Usage : JSON de Kiro sur l'entrée standard (optionnel) → la ligne cite la
 * tâche ; sans entrée, la ligne reste générique.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { accepter, journaliser, lireChargeUtile, racine, refuser } from "./lib/io.mjs";

const NOM = "journal-reminder";
const JOURNAL = "docs/journal.md";
const TITRE = "# Journal de bord\n";

function tacheDe(chargeUtile) {
  const entree = chargeUtile && typeof chargeUtile === "object" ? chargeUtile : {};
  const candidat = entree.spec_name ?? entree.task ?? entree.task_name ?? entree.tool_name;
  const texte = typeof candidat === "string" ? candidat.trim() : "";
  return texte || "tâche de spec";
}

const chargeUtile = await lireChargeUtile();
const base = racine(chargeUtile);
const chemin = join(base, JOURNAL);
const tache = tacheDe(chargeUtile);
const ligne = `- ${new Date().toISOString().slice(0, 10)} — ${tache} : à noter au journal (mesures, séances d'écoute, réglages).\n`;

try {
  await mkdir(dirname(chemin), { recursive: true });
  let texte = TITRE;
  try {
    texte = await readFile(chemin, "utf8");
  } catch {
    await writeFile(chemin, texte, "utf8");
  }
  if (!texte.endsWith("\n")) texte += "\n";
  await appendFile(chemin, ligne, "utf8");
} catch (erreur) {
  await journaliser(base, { garde: NOM, evenement: "refus", tache, raison: String(erreur) });
  refuser(`${NOM} : impossible d'écrire ${JOURNAL} — ${String(erreur)}`);
}
await journaliser(base, { garde: NOM, evenement: "acceptation", tache });
accepter(`${NOM} : ligne ajoutée à ${JOURNAL} pour « ${tache} »`);
