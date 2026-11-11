#!/usr/bin/env -S tsx
/**
 * Le banc d'essai en ligne de commande (cahier §11.6).
 * Aucune de ces commandes n'émet un son : tout passe par des fichiers.
 */
import { todo } from "@thin-air/core/internal";

export async function main(argv: readonly string[]): Promise<number> {
  void argv;
  return todo("bench.cli", "A4");
}

const directRun = import.meta.url === `file://${process.argv[1]}`;
if (directRun) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exit(1);
    },
  );
}
