/**
 * JSON-RPC 2.0 sur stdio — le protocole du serveur MCP (cahier §11.7).
 *
 * Aucune dépendance externe : le dialecte est petit et stable, et le serveur
 * doit démarrer sans rien installer. Trois règles :
 *
 *   - une requête porte `jsonrpc`, `method` et `id` ; une notification n'a pas
 *     d'`id` et ne reçoit jamais de réponse ;
 *   - une erreur porte un code normalisé (-32700, -32600, -32601, -32602,
 *     -32603) et un message lisible, jamais une trace de pile ;
 *   - une ligne illisible est refusée, jamais fatale : le serveur continue.
 */

export const JSONRPC_VERSION = "2.0";

/** Les codes d'erreur normalisés de JSON-RPC 2.0. */
export const CODES = {
  /** La ligne n'est pas du JSON. */
  parse: -32700,
  /** Le JSON n'est pas une requête JSON-RPC 2.0. */
  invalidRequest: -32600,
  /** La méthode n'existe pas. */
  methodNotFound: -32601,
  /** Les paramètres sont absents ou illisibles. */
  invalidParams: -32602,
  /** Le serveur a échoué pour une raison interne. */
  internal: -32603,
} as const;

export type RequestId = number | string;

export interface JsonRpcRequest {
  readonly jsonrpc: typeof JSONRPC_VERSION;
  readonly id: RequestId;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcSuccess {
  readonly jsonrpc: typeof JSONRPC_VERSION;
  readonly id: RequestId;
  readonly result: unknown;
}

export interface JsonRpcFailure {
  readonly jsonrpc: typeof JSONRPC_VERSION;
  readonly id: RequestId | null;
  readonly error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

/** Une erreur qui porte son code : la couche protocolaire la relaie telle quelle. */
export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

/** Ce qu'une ligne peut être : requête, notification, ou refus expliqué. */
export type ParsedMessage =
  | { readonly kind: "request"; readonly request: JsonRpcRequest }
  | { readonly kind: "notification"; readonly method: string; readonly params?: unknown }
  | { readonly kind: "refus"; readonly code: number; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is RequestId {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function refus(code: number, message: string): ParsedMessage {
  return { kind: "refus", code, message };
}

/** Une ligne de JSON-RPC : requête, notification, ou refus expliqué. */
export function parseMessage(line: string): ParsedMessage {
  let json: unknown;
  try {
    json = JSON.parse(line) as unknown;
  } catch {
    return refus(CODES.parse, "JSON illisible");
  }
  if (!isRecord(json)) return refus(CODES.invalidRequest, "un objet JSON-RPC est attendu");
  if (json["jsonrpc"] !== JSONRPC_VERSION) {
    return refus(CODES.invalidRequest, `jsonrpc doit valoir « ${JSONRPC_VERSION} »`);
  }
  const method = json["method"];
  if (typeof method !== "string" || method === "") {
    return refus(CODES.invalidRequest, "method : une chaîne non vide est attendue");
  }
  const id = json["id"];
  if (id === undefined) return { kind: "notification", method, params: json["params"] };
  if (!isId(id)) return refus(CODES.invalidRequest, "id : un nombre ou une chaîne est attendu");
  return { kind: "request", request: { jsonrpc: JSONRPC_VERSION, id, method, params: json["params"] } };
}

/** La réponse « résultat » d'une requête. */
export function success(id: RequestId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

/** La réponse « erreur » d'une requête, au code normalisé. */
export function failure(id: RequestId | null, code: number, message: string, data?: unknown): JsonRpcFailure {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

export type Route = (params: unknown) => unknown | Promise<unknown>;
export type Routes = Readonly<Record<string, Route>>;

function routeOf(routes: Routes, method: string): Route | undefined {
  if (!Object.prototype.hasOwnProperty.call(routes, method)) return undefined;
  return routes[method];
}

/** La réponse à une ligne : `null` pour une notification. */
export async function dispatch(parsed: ParsedMessage, routes: Routes): Promise<JsonRpcResponse | null> {
  if (parsed.kind === "refus") return failure(null, parsed.code, parsed.message);
  if (parsed.kind === "notification") return null;
  const { id, method, params } = parsed.request;
  const route = routeOf(routes, method);
  if (route === undefined) return failure(id, CODES.methodNotFound, `méthode inconnue : ${method}`);
  try {
    return success(id, await route(params));
  } catch (error) {
    if (error instanceof RpcError) return failure(id, error.code, error.message);
    return failure(id, CODES.internal, messageOf(error));
  }
}

/** La première ligne d'une erreur : le détail d'une trace n'aide pas ici. */
export function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}
