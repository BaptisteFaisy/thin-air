/**
 * Les deux familles d'échec du banc d'essai, et leurs codes de sortie
 * (cahier §11.6) :
 *
 *   0  conforme
 *   1  écart constaté, ou échec de calcul
 *   2  erreur d'usage : argument inconnu, fichier illisible, schéma refusé
 *
 * Une erreur d'usage dit toujours pourquoi : jamais de valeur par défaut
 * silencieuse.
 */

/** Erreur d'usage : code de sortie 2. */
export class UsageError extends Error {
  readonly code = 2;

  constructor(
    message: string,
    /** Ce qu'il fallait écrire à la place, quand c'est connu. */
    readonly hint?: string,
  ) {
    super(message);
    this.name = "UsageError";
  }
}

/** Échec de calcul : code de sortie 1. */
export class BenchError extends Error {
  readonly code = 1;

  constructor(message: string) {
    super(message);
    this.name = "BenchError";
  }
}

/** Une dépendance d'un autre lot n'est pas encore livrée (`todo(...)`). */
export function isPendingDependency(error: unknown): boolean {
  return error instanceof Error && /^TODO\(/.test(error.message);
}

/**
 * Un contrat d'un autre lot n'est pas joignable depuis ce contexte.
 *
 * Deux causes, même conséquence pour l'appelant : le corps est encore un
 * `todo(...)`, ou le paquet n'est pas résolvable ici — `@thin-air/schema` et
 * `@thin-air/audio` importent `@thin-air/core/internal`, que l'alias de
 * `vitest.config.ts` ne couvre pas (il n'alias que `@thin-air/core`). Le banc
 * le dit, avec le lot concerné, au lieu de laisser filer une trace de pile.
 */
export function isUnavailableContract(error: unknown): boolean {
  if (isPendingDependency(error)) return true;
  return error instanceof Error && /^Cannot find module '@thin-air\//.test(error.message);
}

/** Texte lisible d'une erreur quelconque. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
