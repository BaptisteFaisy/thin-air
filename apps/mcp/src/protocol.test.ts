/**
 * Le protocole JSON-RPC 2.0, testé ligne à ligne : ce qui est accepté, ce qui
 * est refusé, et avec quel code normalisé. Aucun processus enfant ici — la
 * boucle stdio est testée dans `server.test.ts`.
 */
import { describe, expect, it } from "vitest";

import { CODES, RpcError, dispatch, failure, messageOf, parseMessage, success } from "./protocol.js";
import type { Routes } from "./protocol.js";

function requete(id: number | string, method: string, params?: unknown): string {
  return JSON.stringify(params === undefined ? { jsonrpc: "2.0", id, method } : { jsonrpc: "2.0", id, method, params });
}

describe("parseMessage — la ligne est reconnue", () => {
  it("une requête avec un id numérique", () => {
    const parsed = parseMessage(requete(1, "tools/list"));
    expect(parsed.kind).toBe("request");
    if (parsed.kind !== "request") return;
    expect(parsed.request.id).toBe(1);
    expect(parsed.request.method).toBe("tools/list");
  });

  it("une requête avec un id textuel et des paramètres", () => {
    const parsed = parseMessage(requete("abc", "tools/call", { name: "render_take" }));
    expect(parsed.kind).toBe("request");
    if (parsed.kind !== "request") return;
    expect(parsed.request.id).toBe("abc");
    expect(parsed.request.params).toEqual({ name: "render_take" });
  });

  it("une notification (sans id) ne demande aucune réponse", () => {
    const parsed = parseMessage('{"jsonrpc":"2.0","method":"notifications/initialized"}');
    expect(parsed.kind).toBe("notification");
  });
});

describe("parseMessage — la ligne est refusée, au code normalisé", () => {
  it("du JSON illisible : -32700", () => {
    const parsed = parseMessage("{oops");
    expect(parsed).toMatchObject({ kind: "refus", code: CODES.parse });
  });

  it("un tableau au lieu d'un objet : -32600", () => {
    expect(parseMessage("[1,2]")).toMatchObject({ kind: "refus", code: CODES.invalidRequest });
  });

  it("une version jsonrpc absente ou fausse : -32600", () => {
    expect(parseMessage('{"id":1,"method":"x"}')).toMatchObject({ kind: "refus", code: CODES.invalidRequest });
    expect(parseMessage('{"jsonrpc":"1.0","id":1,"method":"x"}')).toMatchObject({
      kind: "refus",
      code: CODES.invalidRequest,
    });
  });

  it("une méthode absente ou vide : -32600", () => {
    expect(parseMessage('{"jsonrpc":"2.0","id":1}')).toMatchObject({ kind: "refus", code: CODES.invalidRequest });
    expect(parseMessage('{"jsonrpc":"2.0","id":1,"method":""}')).toMatchObject({
      kind: "refus",
      code: CODES.invalidRequest,
    });
  });

  it("un id qui n'est ni un nombre ni une chaîne : -32600", () => {
    expect(parseMessage('{"jsonrpc":"2.0","id":[1],"method":"x"}')).toMatchObject({
      kind: "refus",
      code: CODES.invalidRequest,
    });
  });
});

const ROUTES: Routes = {
  echo: (params) => params,
  boom: () => {
    throw new RpcError(CODES.invalidParams, "paramètres refusés");
  },
  casse: () => {
    throw new Error("ligne utile\n    at trace.de.pile (file.ts:1:1)");
  },
};

describe("dispatch — la réponse au code normalisé", () => {
  it("une méthode connue rend son résultat", async () => {
    const reponse = await dispatch(parseMessage(requete(7, "echo", { a: 1 })), ROUTES);
    expect(reponse).toEqual(success(7, { a: 1 }));
  });

  it("une méthode inconnue : -32601", async () => {
    const reponse = await dispatch(parseMessage(requete(8, "inconnue")), ROUTES);
    expect(reponse).toMatchObject({ id: 8, error: { code: CODES.methodNotFound } });
  });

  it("« constructor » n'est pas une méthode : -32601", async () => {
    const reponse = await dispatch(parseMessage(requete(9, "constructor")), ROUTES);
    expect(reponse).toMatchObject({ error: { code: CODES.methodNotFound } });
  });

  it("une RpcError garde son code : -32602", async () => {
    const reponse = await dispatch(parseMessage(requete(10, "boom")), ROUTES);
    expect(reponse).toMatchObject({ id: 10, error: { code: CODES.invalidParams, message: "paramètres refusés" } });
  });

  it("une erreur interne : -32603, sans trace de pile", async () => {
    const reponse = await dispatch(parseMessage(requete(11, "casse")), ROUTES);
    expect(reponse).toMatchObject({ id: 11, error: { code: CODES.internal } });
    if (reponse === null || !("error" in reponse)) return;
    expect(reponse.error.message).toBe("ligne utile");
    expect(reponse.error.message).not.toContain("at trace");
  });

  it("une notification ne reçoit aucune réponse", async () => {
    const reponse = await dispatch(parseMessage('{"jsonrpc":"2.0","method":"notifications/initialized"}'), ROUTES);
    expect(reponse).toBeNull();
  });

  it("une ligne refusée rend l'erreur avec un id nul", async () => {
    const reponse = await dispatch(parseMessage("{oops"), ROUTES);
    expect(reponse).toEqual(failure(null, CODES.parse, "JSON illisible"));
  });
});

describe("messageOf — jamais de trace de pile", () => {
  it("garde la première ligne d'une erreur", () => {
    expect(messageOf(new Error("première\ndeuxième"))).toBe("première");
  });

  it("accepte ce qui n'est pas une erreur", () => {
    expect(messageOf("texte brut")).toBe("texte brut");
  });
});
