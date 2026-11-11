#!/usr/bin/env node
/**
 * Fuzz long — `node scripts/fuzz.mjs --runs N --seed S`.
 * Le corps est en TypeScript (`scripts/lib/fuzz-run.ts`) : ce lanceur ne fait
 * que l'exécuter sous `tsx`, comme la garde `render-check` le fait pour le
 * banc d'essai. Voir `docs/fuzz.md`.
 */
import { lancerTsx } from "./lib/lanceur.mjs";

process.exitCode = await lancerTsx("fuzz-run.ts", process.argv.slice(2));