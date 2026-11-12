/**
 * Le fichier de session (cahier §7.10, §11.5) : la boucle, ses couches et les
 * réglages, dans le format `thin-air-session/1`. Il ne contient jamais de son,
 * seulement les événements de la couture (§11.3).
 *
 * La validation appartient au lot A4 (`@thin-air/schema`) : ce module appelle
 * `parseSession` et `stringifySession`, et ne réécrit aucune règle. Un fichier
 * refusé l'est EN ENTIER, avec ses raisons affichées — jamais de boucle
 * remplacée à moitié (AIR-F-43).
 */
import type { Session, Settings } from "@thin-air/core";
import { parseSession, stringifySession } from "@thin-air/schema";
import { emptyLoop, withBars, withTempo, type LoopState } from "./loopState.js";
import { toSession } from "../lib/exportLoop.js";

/** La boucle telle qu'un fichier la décrit, ou les raisons de son refus. */
export interface SessionLue {
  readonly session: Session | null;
  readonly reasons: readonly string[];
}

/** Ce qu'un bouton apprend de l'ouverture d'un fichier. */
export type SessionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasons: readonly string[] };

/** La session à écrire : une piste par couche audible, tempo et mesures du cahier. */
export function sessionFromLoop(loop: LoopState, settings: Settings): Session {
  return toSession(loop.layers, loop.tempo, loop.bars, loop.beatsPerBar, settings);
}

/** Le fichier, mis en forme par le schéma : une seule façon de l'écrire. */
export function encodeSession(session: Session): string {
  return stringifySession(session);
}

/**
 * La relecture : le schéma est seul juge. Un fichier illisible, ou qui rompt une
 * de ses règles, rend ses raisons — la boucle en place ne bouge pas.
 */
export function decodeSession(raw: string): SessionLue {
  let valeur: unknown;
  try {
    valeur = JSON.parse(raw);
  } catch {
    return { session: null, reasons: ["the file is not readable JSON"] };
  }
  const resultat = parseSession(valeur);
  if (!resultat.ok) return { session: null, reasons: resultat.reasons };
  return { session: resultat.value, reasons: [] };
}

/** La boucle qu'une session décrit : mêmes couches, même tempo, mêmes mesures. */
export function loopFromSession(session: Session): LoopState {
  const mesuree = withBars(emptyLoop(session.settings), session.bars);
  const tempo = withTempo(mesuree, session.tempo);
  const dernierId = session.layers.reduce((max, couche) => (couche.id > max ? couche.id : max), 0);
  return { ...tempo, beatsPerBar: session.beatsPerBar, layers: session.layers, nextLayerId: dernierId + 1 };
}

/** Le nom du fichier rendu au navigateur : aucune requête ne part (AIR-N-01). */
export const SESSION_FILE = "thin-air-session.json";
