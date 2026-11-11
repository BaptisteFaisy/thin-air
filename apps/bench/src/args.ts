/**
 * Analyse des arguments du banc d'essai (cahier §11.6).
 *
 * Un argument inconnu, une valeur manquante ou un nombre illisible sont des
 * erreurs d'usage (code 2) : le banc ne devine jamais à la place de celui qui
 * l'appelle. `--aide` et `--help` sont acceptés partout.
 */
import { UsageError } from "./errors.js";

export interface OptionSpec {
  /** Nom de la commande, pour les messages. */
  readonly command: string;
  /** Options qui prennent une valeur : `--take <prise>`. */
  readonly values: readonly string[];
  /** Options qui n'en prennent pas : `--json`. */
  readonly flags: readonly string[];
  /** Nombre de paramètres positionnels attendus (au plus). */
  readonly positionals?: number;
}

export interface ParsedArgs {
  readonly command: string;
  readonly positionals: readonly string[];
  readonly values: ReadonlyMap<string, string>;
  readonly flags: ReadonlySet<string>;
}

const AIDE = ["help", "aide"];

function listFor(names: readonly string[]): string {
  return names.map((name) => `--${name}`).join(", ");
}

function knownOption(spec: OptionSpec, name: string): "value" | "flag" | "unknown" {
  if (spec.values.includes(name)) return "value";
  if (spec.flags.includes(name) || AIDE.includes(name)) return "flag";
  return "unknown";
}

function storeValue(values: Map<string, string>, spec: OptionSpec, name: string, value: string): void {
  if (values.has(name)) throw new UsageError(`option répétée : --${name}`, `usage : ${spec.command}`);
  if (value === "") throw new UsageError(`valeur vide pour --${name}`, `usage : ${spec.command}`);
  values.set(name, value);
}

/** Découpe un jeton `--nom=valeur` (ou rend `null`). */
function splitInline(token: string): { readonly name: string; readonly value: string } | null {
  if (!token.startsWith("--")) return null;
  const cut = token.indexOf("=");
  if (cut < 0) return null;
  return { name: token.slice(2, cut), value: token.slice(cut + 1) };
}

/** Analyse `argv` contre la spécification d'une commande. */
export function parseArgs(argv: readonly string[], spec: OptionSpec): ParsedArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positionals: string[] = [];
  const maxPositionals = spec.positionals ?? 0;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) continue;

    if (!token.startsWith("--") && !token.startsWith("-")) {
      if (positionals.length >= maxPositionals) {
        throw new UsageError(
          `argument en trop : « ${token} »`,
          maxPositionals === 0 ? `usage : ${spec.command}` : `au plus ${maxPositionals} paramètre(s)`,
        );
      }
      positionals.push(token);
      continue;
    }

    const inline = splitInline(token);
    const name = inline?.name ?? token.replace(/^-{1,2}/, "");
    const kind = knownOption(spec, name);

    if (kind === "unknown") {
      const acceptes = [...spec.values, ...spec.flags, ...AIDE].sort();
      throw new UsageError(`option inconnue : ${token}`, `options acceptées : ${listFor(acceptes)}`);
    }
    if (kind === "flag") {
      if (inline !== null) throw new UsageError(`--${name} ne prend pas de valeur`, `usage : ${spec.command}`);
      flags.add(name);
      continue;
    }

    const value = inline?.value ?? argv[i + 1];
    if (value === undefined || (inline === null && value.startsWith("-"))) {
      throw new UsageError(`valeur manquante pour --${name}`, `exemple : --${name} <valeur>`);
    }
    if (inline === null) i += 1;
    storeValue(values, spec, name, value);
  }

  return { command: spec.command, positionals, values, flags };
}

/** Valeur d'une option, ou `undefined`. */
export function optionalValue(args: ParsedArgs, name: string): string | undefined {
  return args.values.get(name);
}

/** Valeur obligatoire : son absence est une erreur d'usage. */
export function requireValue(args: ParsedArgs, name: string): string {
  const value = args.values.get(name);
  if (value === undefined) throw new UsageError(`option obligatoire manquante : --${name}`, `usage : ${args.command}`);
  return value;
}

/** Valeur numérique : un texte non numérique est une erreur d'usage. */
export function numberValue(args: ParsedArgs, name: string): number | undefined {
  const raw = args.values.get(name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new UsageError(`valeur numérique attendue pour --${name} : « ${raw} »`);
  return value;
}

/** Vrai si l'aide est demandée. */
export function wantsHelp(args: ParsedArgs): boolean {
  return AIDE.some((name) => args.flags.has(name));
}
