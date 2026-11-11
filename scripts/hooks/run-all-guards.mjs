#!/usr/bin/env node
/**
 * Lance toutes les gardes du dépôt, dans l'ordre, et rend un code non nul dès
 * que l'une refuse. C'est l'étape « Gardes du projet » de la CI, et le miroir
 * des hooks Kiro (`.kiro/hooks/hooks.json`) : la même règle est vérifiée par
 * l'agent pendant l'écriture et par la CI après le push (cahier §14.3).
 */
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const dossier = join(process.cwd(), "scripts", "hooks");
const gardes = (await readdir(dossier))
  .filter((nom) => nom.endsWith("-guard.mjs") && nom !== "run-all-guards.mjs")
  .sort();

function lancer(garde) {
  return new Promise((resoudre) => {
    const enfant = spawn(process.execPath, [join(dossier, garde)], { stdio: "inherit" });
    enfant.on("close", (code) => resoudre(code ?? 1));
    enfant.on("error", () => resoudre(1));
  });
}

if (gardes.length === 0) {
  process.stdout.write("aucune garde trouvée dans scripts/hooks/\n");
  process.exit(0);
}

let echecs = 0;
for (const garde of gardes) {
  const code = await lancer(garde);
  if (code !== 0) {
    process.stderr.write(`✗ ${garde} (code ${code})\n`);
    echecs += 1;
  } else {
    process.stdout.write(`✓ ${garde}\n`);
  }
}
process.exit(echecs === 0 ? 0 : 1);
