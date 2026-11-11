/**
 * Le serveur MCP de Thin Air, sur stdio (cahier §11.7).
 *
 * Lecture ligne à ligne sur stdin, écriture ligne à ligne sur stdout : chaque
 * ligne de stdout est un message JSON-RPC 2.0, et rien d'autre. Les journaux
 * vont sur stderr. Aucun son, aucun périphérique audio (AIR-N-02) : le serveur
 * rend des fichiers et des nombres.
 *
 * Démarrage :
 *   node --import tsx apps/mcp/src/server.ts
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";

import { CODES, RpcError, dispatch, messageOf, parseMessage } from "./protocol.js";
import type { Routes } from "./protocol.js";
import { TOOLS, callTool } from "./tools.js";

/** La version du protocole que le serveur annonce quand le client n'en demande aucune connue. */
export const PROTOCOLE_PAR_DEFAUT = "2025-06-18";
export const VERSIONS_CONNUES: readonly string[] = ["2024-11-05", "2025-03-26", "2025-06-18"];

export const SERVER_INFO = {
  name: "thin-air-mcp",
  title: "Thin Air — les oreilles en chiffres",
  version: "0.1.0",
} as const;

export const INSTRUCTIONS =
  "Ce serveur ne joue jamais de son : il rend des fichiers et des nombres. " +
  "Les chemins de prise, d'instrument et de rapport sont relatifs à la racine du dépôt.";

/** La version du protocole : celle du client si elle est connue, la nôtre sinon. */
export function versionProtocole(params: unknown): string {
  if (typeof params === "object" && params !== null) {
    const demandee = (params as { protocolVersion?: unknown }).protocolVersion;
    if (typeof demandee === "string" && VERSIONS_CONNUES.includes(demandee)) return demandee;
  }
  return PROTOCOLE_PAR_DEFAUT;
}

/** `initialize` : l'identité du serveur et ce qu'il sait faire. */
function resultatInitialize(params: unknown): unknown {
  return {
    protocolVersion: versionProtocole(params),
    capabilities: { tools: { listChanged: false } },
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}

function recordAttendu(params: unknown, quoi: string): Record<string, unknown> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new RpcError(CODES.invalidParams, `${quoi} : un objet est attendu`);
  }
  return params as Record<string, unknown>;
}

/** `tools/call` : le nom de l'outil et ses arguments. */
async function appelOutil(params: unknown): Promise<unknown> {
  const corps = recordAttendu(params, "params");
  const name = corps["name"];
  if (typeof name !== "string" || name === "") {
    throw new RpcError(CODES.invalidParams, "params.name : le nom de l'outil est attendu");
  }
  const args = corps["arguments"] === undefined ? {} : recordAttendu(corps["arguments"], "params.arguments");
  return callTool(name, args);
}

/** Les méthodes que le serveur connaît ; toute autre est refusée (-32601). */
const ROUTES: Routes = {
  initialize: resultatInitialize,
  "notifications/initialized": () => ({}),
  ping: () => ({}),
  "tools/list": () => ({ tools: TOOLS }),
  "tools/call": appelOutil,
};

/** Une ligne de stdin : la réponse à écrire sur stdout, ou `null`. */
async function traiter(ligne: string): Promise<string | null> {
  const texte = ligne.trim();
  if (texte === "") return null;
  const reponse = await dispatch(parseMessage(texte), ROUTES);
  return reponse === null ? null : JSON.stringify(reponse);
}

/** La boucle du serveur : stdin → JSON-RPC → stdout. */
async function boucle(): Promise<void> {
  const lignes = createInterface({ input: process.stdin, crlfDelay: Infinity });
  process.stderr.write("thin-air-mcp : serveur prêt (stdio, JSON-RPC 2.0)\n");
  for await (const ligne of lignes) {
    const reponse = await traiter(ligne);
    if (reponse !== null) process.stdout.write(`${reponse}\n`);
  }
}

/** Vrai si ce fichier est le point d'entrée du processus (chemin relatif accepté). */
function directRun(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  return import.meta.url === pathToFileURL(resolve(argv1)).href;
}

if (directRun()) {
  boucle().catch((error: unknown) => {
    process.stderr.write(`thin-air-mcp : arrêt sur erreur : ${messageOf(error)}\n`);
    process.exitCode = 1;
  });
}
