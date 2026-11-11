import type { Session } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";
import type { ParseResult } from "./instrument.js";

export const sessionSchema: unknown = todo("schema.sessionSchema", "A4");

export function parseSession(json: unknown): ParseResult<Session> {
  void json;
  return todo("schema.parseSession", "A4");
}

export function stringifySession(session: Session): string {
  void session;
  return todo("schema.stringifySession", "A4");
}
