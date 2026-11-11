/** Le choix de la langue : anglais pour la soumission (AIR-N-14). */
import { en, type Messages } from "./en.js";
import { fr } from "./fr.js";

export type { Messages };
export type Lang = "en" | "fr";

export const MESSAGES: Readonly<Record<Lang, Messages>> = { en, fr };

/** Langue de la page : `?lang=fr` dans l'adresse, anglais sinon. */
export function langFrom(search: string): Lang {
  const parametres = new URLSearchParams(search);
  return parametres.get("lang") === "fr" ? "fr" : "en";
}

export function messagesFor(lang: Lang): Messages {
  return MESSAGES[lang];
}

/** Toutes les clés textuelles, à plat : sert au test de parité en/fr. */
export function messagePaths(value: unknown, prefixe = ""): readonly string[] {
  if (typeof value === "string") return [prefixe];
  if (typeof value === "function") return [prefixe];
  if (value === null || typeof value !== "object") return [];
  const entrees = Object.entries(value as Record<string, unknown>);
  return entrees.flatMap(([cle, sous]) => messagePaths(sous, prefixe === "" ? cle : `${prefixe}.${cle}`));
}
