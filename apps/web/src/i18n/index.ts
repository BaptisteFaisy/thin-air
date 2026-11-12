/** Le choix de la langue : anglais pour la soumission (AIR-N-14). */
import { en, type Messages } from "./en.js";
import { fr } from "./fr.js";
import { lessonsEn, type LessonMessages } from "./lessons.en.js";
import { lessonsFr } from "./lessons.fr.js";

export type { Messages, LessonMessages };
export type Lang = "en" | "fr";

/** Les textes de la borne (cahier §12.2, parcours P11) : exposés pour la parité et l'audit. */
export { kioskEn } from "./kiosk.en.js";
export { kioskFr } from "./kiosk.fr.js";
export type { KioskMessages } from "./kiosk.en.js";

export const MESSAGES: Readonly<Record<Lang, Messages>> = { en, fr };

/** Langue de la page : `?lang=fr` dans l'adresse, anglais sinon. */
export function langFrom(search: string): Lang {
  const parametres = new URLSearchParams(search);
  return parametres.get("lang") === "fr" ? "fr" : "en";
}

export function messagesFor(lang: Lang): Messages {
  return MESSAGES[lang];
}

/**
 * Les libellés des leçons, dans la langue de la page — le même mécanisme que
 * la borne (`kiosk.en.ts` / `kiosk.fr.ts` choisis par la langue de l'adresse).
 */
export function lessonsFor(lang: Lang): LessonMessages {
  return lang === "fr" ? lessonsFr : lessonsEn;
}

/** Toutes les clés textuelles, à plat : sert au test de parité en/fr. */
export function messagePaths(value: unknown, prefixe = ""): readonly string[] {
  if (typeof value === "string") return [prefixe];
  if (typeof value === "function") return [prefixe];
  if (value === null || typeof value !== "object") return [];
  const entrees = Object.entries(value as Record<string, unknown>);
  return entrees.flatMap(([cle, sous]) => messagePaths(sous, prefixe === "" ? cle : `${prefixe}.${cle}`));
}
