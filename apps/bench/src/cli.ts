#!/usr/bin/env -S tsx
/**
 * Le banc d'essai en ligne de commande (cahier §11.6).
 * Aucune de ces commandes n'émet un son : tout passe par des fichiers.
 *
 *   bench events  --take <prise> --instrument <fichier>
 *   bench render  --take <prise> --instrument <fichier> --out <dossier>
 *   bench compare <rapport> <référence>
 *   bench synth   <forme> [paramètres]
 *   bench tune    [--take <prise>]
 *
 * Codes de sortie : 0 conforme · 1 écart ou échec · 2 erreur d'usage.
 */
import { COMMANDS, PROCESS_WRITERS } from "./commands.js";
import { runTune } from "./tuning-mesure.js";
import type { Writers } from "./commands.js";
import { BenchError, UsageError, describeError } from "./errors.js";
import { GENERAL_HELP } from "./help.js";

/** Les commandes sont-elles nommées dans ce que l'utilisateur a tapé ? */
function knownCommand(argv: readonly string[]): string | undefined {
  const premiere = argv[0];
  if (premiere === undefined) return undefined;
  if (premiere === "tune") return premiere; // ajout du lot W7 : voir tuning-mesure.ts
  return Object.prototype.hasOwnProperty.call(COMMANDS, premiere) ? premiere : undefined;
}

function usageOf(error: UsageError, writers: Writers): number {
  writers.err(`usage : ${error.message}`);
  if (error.hint !== undefined) for (const ligne of error.hint.split("\n")) writers.err(`  - ${ligne}`);
  return 2;
}

/**
 * Point d'entrée testable : rend le code de sortie, n'appelle jamais
 * `process.exit`. La sortie passe par `writers`, donc un test lit le texte.
 */
export async function main(argv: readonly string[], writers: Writers = PROCESS_WRITERS): Promise<number> {
  const commande = knownCommand(argv);
  if (commande === undefined) {
    const demande = argv[0];
    if (demande === undefined || demande === "--help" || demande === "--aide" || demande === "help" || demande === "aide") {
      writers.out(GENERAL_HELP);
      return 0;
    }
    writers.err(`usage : commande inconnue : « ${demande} »`);
    writers.err(`  - commandes : ${Object.keys(COMMANDS).join(", ")}`);
    return 2;
  }
  const run = commande === "tune" ? runTune : COMMANDS[commande];
  if (run === undefined) return 2;
  try {
    return await run(argv.slice(1), writers);
  } catch (error) {
    if (error instanceof UsageError) return usageOf(error, writers);
    if (error instanceof BenchError) {
      writers.err(`échec : ${error.message}`);
      return 1;
    }
    writers.err(`échec inattendu : ${describeError(error)}`);
    return 1;
  }
}

const directRun = import.meta.url === `file://${process.argv[1]}`;
if (directRun) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`${describeError(error)}\n`);
      process.exit(1);
    },
  );
}
