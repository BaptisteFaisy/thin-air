/**
 * Lanceur partagé : exécute un module TypeScript sous `tsx` depuis `node`,
 * en héritant des entrées/sorties et du code de sortie. C'est le même motif
 * que la garde `render-check` (`node --import tsx …`) : le banc et la chaîne
 * du dépôt sont écrits en TypeScript, et `node scripts/<…>.mjs` doit marcher
 * sans étape de compilation.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Racine du dépôt depuis ce fichier (scripts/lib/ → ../..). */
export function racine() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/**
 * Lance `scriptTs` avec les arguments donnés, rend une promesse résolue au
 * code de sortie. `tsx` résout les `import type` et les chemins `.ts` du dépôt.
 */
export function lancerTsx(scriptTs, args, timeoutMs = 300_000) {
  const chemin = join(racine(), "scripts", "lib", scriptTs);
  return new Promise((resoudre) => {
    const enfant = spawn(process.execPath, ["--import", "tsx", chemin, ...args], {
      cwd: racine(),
      stdio: "inherit",
    });
    const minuteur = setTimeout(() => enfant.kill("SIGKILL"), timeoutMs);
    minuteur.unref?.();
    enfant.on("error", () => {
      clearTimeout(minuteur);
      resoudre(1);
    });
    enfant.on("close", (code) => {
      clearTimeout(minuteur);
      resoudre(code ?? 1);
    });
  });
}