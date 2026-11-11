/**
 * Les trois outils du serveur MCP de Thin Air (cahier §11.7) : l'agent entend
 * le projet en chiffres, jamais en son.
 *
 *   `render_take`     — une prise et un instrument donnent un rapport de rendu ;
 *   `list_notes`      — les paliers mesurés dans ce rendu ;
 *   `compare_reports` — les écarts entre deux rapports, et la conformité.
 *
 * Tout le calcul vient du banc d'essai (`apps/bench`) : ici on ne réécrit
 * aucune mesure, on ne fait que lire des fichiers, appeler le banc, et rendre
 * ses nombres. Aucun son, aucun périphérique audio (AIR-N-02), aucune date
 * dans les sorties (AIR-N-09).
 */
import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Settings } from "@thin-air/core";
import {
  DEFAULT_TOLERANCES,
  UsageError,
  compareReports,
  formatComparison,
  formatNote,
  formatReport,
  isConforming,
  parseReport,
  parseSettingsJson,
  readInstrumentFile,
  readJsonFile,
  readTakeFile,
  renderTake,
} from "../../bench/src/index.js";
import type { Tolerances } from "../../bench/src/index.js";
import { CODES, RpcError, messageOf } from "./protocol.js";

/** La racine du dépôt : les chemins des outils sont résolus par rapport à elle. */
export const RACINE = fileURLToPath(new URL("../../..", import.meta.url));

/** Un chemin d'entrée, résolu par rapport à la racine du dépôt. */
export function cheminDepot(chemin: string): string {
  return resolve(RACINE, chemin);
}

/** L'étiquette d'une prise dans le rapport : son nom de fichier, sans extension. */
function etiquette(chemin: string): string {
  return basename(chemin, extname(chemin));
}

/** Un schéma JSON d'entrée, tel qu'un client MCP le lit. */
export interface SchemaJson {
  readonly type: "object";
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties: boolean;
}

/** Le résultat d'un outil, au format MCP : du texte, et les nombres à part. */
export interface ToolResult {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly structuredContent?: Record<string, unknown>;
  readonly isError?: boolean;
}

/** Un outil : sa carte (nom, description, schéma) et son exécution. */
export interface Outil {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: SchemaJson;
  readonly run: (args: Record<string, unknown>) => Promise<ToolResult>;
}

const CHEMIN: Record<string, unknown> = {
  type: "string",
  description: "Chemin du fichier, relatif à la racine du dépôt (ex. takes/reference/harp-sweep.json).",
};

const REGLAGES: Record<string, unknown> = {
  type: "object",
  description: "Réglages partiels du cahier (§7.13) ; l'instrument garde ses propres défauts.",
};

const OPTIONS_RENDU: Record<string, unknown> = {
  oneHand: { type: "boolean", description: "Jouer d'une seule main (§7.9)." },
  hold: { type: "boolean", description: "Tenir les notes après la sortie des mains (§7.10)." },
};

/** Les tolérances que `compare_reports` accepte, et leurs valeurs par défaut. */
const TOLERANCES_CONNUES = ["cents", "peakDb", "rmsDb", "noteTimeMs", "silenceAfterMs"] as const;

function texte(contenu: string): ToolResult["content"] {
  return [{ type: "text", text: contenu }];
}

/** Une erreur d'usage de l'outil : elle revient comme un résultat lisible. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

/** Le message d'une erreur, sans trace de pile : l'agent doit pouvoir le lire. */
function messageLisible(error: unknown): string {
  if (error instanceof UsageError) {
    if (error.hint === undefined) return error.message;
    const lignes = error.hint.split("\n").map((ligne) => `  - ${ligne}`);
    return [error.message, ...lignes].join("\n");
  }
  return messageOf(error);
}

function champTexte(args: Record<string, unknown>, nom: string): string {
  const valeur = args[nom];
  if (typeof valeur !== "string" || valeur.trim() === "") {
    throw new ToolInputError(`${nom} : un chemin de fichier est attendu`);
  }
  return valeur;
}

function champBooleen(args: Record<string, unknown>, nom: string): boolean | undefined {
  const valeur = args[nom];
  if (valeur === undefined) return undefined;
  if (typeof valeur !== "boolean") throw new ToolInputError(`${nom} : un booléen est attendu`);
  return valeur;
}

/** Les réglages d'un rendu : partiels, refusés s'ils sont faux. */
function champReglages(args: Record<string, unknown>): Partial<Settings> | undefined {
  const valeur = args["settings"];
  if (valeur === undefined) return undefined;
  return parseSettingsJson(valeur, "settings");
}

/** Les arguments communs à `render_take` et `list_notes`. */
interface ArgsRendu {
  readonly take: string;
  readonly instrument: string;
  readonly settings?: Partial<Settings>;
  readonly oneHand?: boolean;
  readonly hold?: boolean;
}

function argsRendu(args: Record<string, unknown>): ArgsRendu {
  return {
    take: champTexte(args, "take"),
    instrument: champTexte(args, "instrument"),
    settings: champReglages(args),
    oneHand: champBooleen(args, "oneHand"),
    hold: champBooleen(args, "hold"),
  };
}

/** Le rapport d'un rendu : la prise, l'instrument, les réglages, et rien d'autre. */
async function rendreRapport(args: ArgsRendu) {
  const prise = await readTakeFile(cheminDepot(args.take));
  const instrument = await readInstrumentFile(cheminDepot(args.instrument));
  return renderTake(prise, instrument, {
    settings: args.settings,
    oneHand: args.oneHand,
    hold: args.hold,
    takeName: etiquette(args.take),
  });
}

/** Un rapport : depuis un fichier, ou depuis un objet déjà dans la requête. */
async function chargerRapport(valeur: unknown, nom: string) {
  if (typeof valeur === "string") {
    if (valeur.trim() === "") throw new ToolInputError(`${nom} : un chemin de rapport est attendu`);
    const chemin = cheminDepot(valeur);
    return parseReport(readJsonFile(chemin), chemin);
  }
  if (typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)) {
    return parseReport(valeur, `${nom} (rapport en ligne)`);
  }
  throw new ToolInputError(`${nom} : un chemin de rapport ou un objet rapport est attendu`);
}

/** Les tolérances de la comparaison : connues, finies, positives ou nulles. */
function champTolerances(valeur: unknown): Tolerances | undefined {
  if (valeur === undefined) return undefined;
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) {
    throw new ToolInputError("tolerances : un objet de nombres est attendu");
  }
  const tolérances: Record<string, number> = {};
  for (const [cle, nombre] of Object.entries(valeur as Record<string, unknown>)) {
    if (!TOLERANCES_CONNUES.includes(cle as (typeof TOLERANCES_CONNUES)[number])) {
      throw new ToolInputError(`tolerances.${cle} : tolérance inconnue (${TOLERANCES_CONNUES.join(", ")})`);
    }
    if (typeof nombre !== "number" || !Number.isFinite(nombre) || nombre < 0) {
      throw new ToolInputError(`tolerances.${cle} : un nombre fini positif ou nul est attendu`);
    }
    tolérances[cle] = nombre;
  }
  return tolérances as Tolerances;
}

/** `render_take` : la prise et l'instrument en entrée, le rapport en sortie. */
async function outilRenderTake(args: Record<string, unknown>): Promise<ToolResult> {
  const report = await rendreRapport(argsRendu(args));
  return { content: texte(formatReport(report)), structuredContent: { report } };
}

/** `list_notes` : les paliers mesurés dans le rendu (temps, note, Hz, centièmes). */
async function outilListNotes(args: Record<string, unknown>): Promise<ToolResult> {
  const report = await rendreRapport(argsRendu(args));
  const notes = report.notes.map((note) => ({
    t: note.t,
    midi: note.midi,
    expectedHz: note.expectedHz,
    measuredHz: note.measuredHz,
    cents: note.cents,
  }));
  const lignes = report.notes.map((note) => formatNote(note));
  return {
    content: texte(lignes.join("\n")),
    structuredContent: {
      take: report.take,
      instrument: report.instrument,
      count: notes.length,
      notes,
    },
  };
}

/** `compare_reports` : les écarts entre deux rapports, et la conformité. */
async function outilCompareReports(args: Record<string, unknown>): Promise<ToolResult> {
  const actual = await chargerRapport(args["actual"], "actual");
  const expected = await chargerRapport(args["expected"], "expected");
  const tolérances = champTolerances(args["tolerances"]);
  const diffs = compareReports(actual, expected, tolérances);
  return {
    content: texte(formatComparison(diffs)),
    structuredContent: {
      conforming: isConforming(diffs),
      tolerances: { ...DEFAULT_TOLERANCES, ...(tolérances ?? {}) },
      diffs,
    },
  };
}

/** Les trois outils, dans l'ordre du cahier. */
export const OUTILS: readonly Outil[] = [
  {
    name: "render_take",
    description:
      "Rend une prise avec un instrument et rend le rapport de rendu en nombres : durée, crête, niveau moyen, silence final, et les notes mesurées. Aucun son n'est produit.",
    inputSchema: {
      type: "object",
      properties: {
        take: { ...CHEMIN, description: "Chemin de la prise (thin-air-take/1), relatif au dépôt." },
        instrument: { ...CHEMIN, description: "Chemin de l'instrument (thin-air-instrument/1), relatif au dépôt." },
        settings: REGLAGES,
        ...OPTIONS_RENDU,
      },
      required: ["take", "instrument"],
      additionalProperties: false,
    },
    run: outilRenderTake,
  },
  {
    name: "list_notes",
    description:
      "Rend les paliers de note mesurés dans un rendu : temps, note MIDI, fréquence attendue, fréquence mesurée, écart en centièmes.",
    inputSchema: {
      type: "object",
      properties: {
        take: { ...CHEMIN, description: "Chemin de la prise (thin-air-take/1), relatif au dépôt." },
        instrument: { ...CHEMIN, description: "Chemin de l'instrument (thin-air-instrument/1), relatif au dépôt." },
        settings: REGLAGES,
        ...OPTIONS_RENDU,
      },
      required: ["take", "instrument"],
      additionalProperties: false,
    },
    run: outilListNotes,
  },
  {
    name: "compare_reports",
    description:
      "Compare deux rapports de rendu et rend les écarts (champ, attendu, obtenu, tolérance) et la conformité. Les rapports viennent d'un fichier ou d'un objet déjà calculé.",
    inputSchema: {
      type: "object",
      properties: {
        actual: {
          description: "Rapport mesuré : chemin de fichier (relatif au dépôt) ou objet de rapport.",
          oneOf: [{ type: "string" }, { type: "object" }],
        },
        expected: {
          description: "Rapport de référence : chemin de fichier (relatif au dépôt) ou objet de rapport.",
          oneOf: [{ type: "string" }, { type: "object" }],
        },
        tolerances: {
          type: "object",
          description: `Tolérances : ${TOLERANCES_CONNUES.join(", ")} (défauts : ${JSON.stringify(DEFAULT_TOLERANCES)}).`,
          additionalProperties: false,
        },
      },
      required: ["actual", "expected"],
      additionalProperties: false,
    },
    run: outilCompareReports,
  },
];

/** La carte des outils, telle que `tools/list` la rend. */
export const TOOLS = OUTILS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

/** Les noms des outils, pour un message d'erreur utile. */
export const NOMS_OUTILS = OUTILS.map((outil) => outil.name);

/**
 * Appelle un outil. Un nom inconnu est une erreur de protocole (-32602) ; une
 * prise illisible, un réglage faux ou un calcul en échec revient comme un
 * résultat d'outil lisible, jamais comme une trace de pile.
 */
export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const outil = OUTILS.find((autre) => autre.name === name);
  if (outil === undefined) {
    throw new RpcError(CODES.invalidParams, `outil inconnu : ${name} (outils : ${NOMS_OUTILS.join(", ")})`);
  }
  try {
    return await outil.run(args);
  } catch (error) {
    return { content: texte(messageLisible(error)), isError: true };
  }
}
