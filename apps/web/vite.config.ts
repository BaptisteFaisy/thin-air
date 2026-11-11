import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("../..", import.meta.url));
const alias = (nom: string) => ({
  find: `@thin-air/${nom}`,
  replacement: `${racine}/packages/${nom}/src/index.ts`,
});

// Site statique : le modèle et ses fichiers d'exécution sont servis par le
// site lui-même, avec un cache long (cahier §11.9). Aucune requête tierce.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: [alias("core"), alias("schema"), alias("audio"), alias("vision")] },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
