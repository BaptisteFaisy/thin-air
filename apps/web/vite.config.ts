import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("../..", import.meta.url));
const PAQUETS = ["core", "schema", "audio", "vision"] as const;

/** Un sous-chemin (`@thin-air/core/internal`) pointe vers le fichier du paquet. */
const sousChemin = (nom: string) => ({
  find: new RegExp(`^@thin-air/${nom}/`),
  replacement: `${racine}/packages/${nom}/src/`,
});

/** Le paquet lui-même (`@thin-air/core`) pointe vers son contrat public. */
const paquet = (nom: string) => ({
  find: `@thin-air/${nom}`,
  replacement: `${racine}/packages/${nom}/src/index.ts`,
});

// Les sous-chemins d'abord : sinon `@thin-air/core/internal` serait remplacé
// par `…/index.ts/internal`, qui n'existe pas.
const alias = PAQUETS.flatMap((nom) => [sousChemin(nom), paquet(nom)]);

// Site statique : le modèle et ses fichiers d'exécution sont servis par le
// site lui-même, avec un cache long (cahier §11.9). Aucune requête tierce,
// aucun CDN, aucune mesure d'audience (AIR-N-01).
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
