#!/usr/bin/env node
/**
 * Télécharge le modèle de suivi des mains et ses fichiers d'exécution dans
 * `public/models/`, pour que le site les serve lui-même : aucune dépendance à
 * un tiers, et le site fonctionne hors ligne après la première visite
 * (AIR-N-01, cahier §7.3 et §11.9).
 *
 * Les fichiers ne sont PAS versionnés (voir .gitignore) : ils pèsent plusieurs
 * mégaoctets et le poids exact est à mesurer puis à noter dans docs/latency.md.
 *
 * Usage : npm run fetch-model
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const cible = join(racine, "public", "models");

const MODELE =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

async function telecharger(url, fichier) {
  const chemin = join(cible, fichier);
  try {
    const deja = await stat(chemin);
    if (deja.size > 0) {
      process.stdout.write(`déjà présent : ${fichier} (${deja.size} octets)\n`);
      return deja.size;
    }
  } catch {
    /* absent : on télécharge */
  }
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
  const octets = new Uint8Array(await reponse.arrayBuffer());
  await writeFile(chemin, octets);
  process.stdout.write(`téléchargé : ${fichier} (${octets.byteLength} octets)\n`);
  return octets.byteLength;
}

await mkdir(cible, { recursive: true });
const poids = await telecharger(MODELE, "hand_landmarker.task");
// Les fichiers d'exécution (wasm) sont copiés depuis le paquet installé :
// la version sertie dans le dépôt est celle que les tests utilisent.
process.stdout.write(`poids du modèle : ${(poids / 1e6).toFixed(2)} Mo — à noter dans docs/latency.md\n`);
