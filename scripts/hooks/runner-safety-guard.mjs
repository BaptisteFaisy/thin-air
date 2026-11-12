#!/usr/bin/env node
/**
 * Garde « runners » — le contrôle de `scripts/check-runner-safety.mjs`,
 * partie dépôt seulement.
 *
 * La CI n'a pas le droit de faire du réseau (AIR-N-01, docs/CONTRACT.md) :
 * cette garde n'interroge donc pas la machine des runners. Elle refuse
 * qu'une étape de workflow puisse effacer un dossier de runner — le reste
 * (les dossiers de runner eux-mêmes) se constate à la main :
 * `node scripts/check-runner-safety.mjs`.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..", "..");
const CONTROLE = join(RACINE, "scripts", "check-runner-safety.mjs");

const r = spawnSync(process.execPath, [CONTROLE, RACINE, "--hors-reseau"], {
  cwd: RACINE,
  encoding: "utf8",
});

if (r.status !== 0) {
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
}
process.exit(r.status ?? 1);
