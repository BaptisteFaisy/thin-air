#!/usr/bin/env node
/**
 * Budget de performance — `node scripts/perf-budget.mjs`.
 * Mesure le temps de `processTake` et de `renderEvents` de la prise de
 * référence et les compare à `perf-budget.json` (dossier racine). Le corps est
 * en TypeScript (`scripts/lib/perf-run.ts`), lancé sous `tsx`.
 */
import { lancerTsx } from "./lib/lanceur.mjs";

process.exitCode = await lancerTsx("perf-run.ts", process.argv.slice(2));