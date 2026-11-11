/**
 * La détection du mode kiosque et sa configuration : la prise du fantôme,
 * l'instrument, les réglages imposés. Aucune logique de rendu ici — juste de
 * quoi décider que l'adresse demande une borne, et avec quoi elle joue.
 */
import type { Instrument, Settings, Take } from "@thin-air/core";
import { DEFAULT_SETTINGS } from "@thin-air/core";
import { builtInByName, premierLivre } from "../state/library.js";
import { langFrom } from "../i18n/index.js";
import { kioskEn, type KioskMessages } from "../i18n/kiosk.en.js";
import { kioskFr } from "../i18n/kiosk.fr.js";

/** Le paramètre d'adresse qui allume la borne : `?kiosk=1`. */
export const KIOSK_PARAM = "kiosk";

export function kioskWanted(search: string): boolean {
  return new URLSearchParams(search).get(KIOSK_PARAM) === "1";
}

/** La langue de la borne : la même règle que le reste de la page (§11.10). */
export function kioskMessagesFor(search: string): KioskMessages {
  return langFrom(search) === "fr" ? kioskFr : kioskEn;
}

/**
 * La prise que rejoue le fantôme : `slow-rise.json`, l'exemple du thérémine
 * (cahier §7.14) — une montée lente de la hauteur, volume tenu, trois
 * secondes. C'est une phrase musicale complète qui boucle sans à-coup, pas un
 * cas de test (les autres prises sont courtes, traversent le cadre en plein
 * milieu d'une note, ou servent à fixer une convention de côté). Lue au build,
 * comme les instruments (§7.11) : aucune requête réseau à l'exécution.
 */
const PRISES = import.meta.glob("../../../../takes/reference/slow-rise.json", {
  eager: true,
  import: "default",
}) as Readonly<Record<string, unknown>>;

export function priseFantome(): Take {
  const prise = Object.values(PRISES)[0];
  if (prise === undefined) throw new Error("kiosk: missing ghost take");
  return prise as Take;
}

/** L'instrument de la borne : Phantom, le premier livré (§7.8). */
export const KIOSK_INSTRUMENT = "Phantom";

export function kioskInstrument(): Instrument {
  return builtInByName(KIOSK_INSTRUMENT) ?? premierLivre() ?? defaultInstrument();
}

/** Filet de sécurité : un Phantom minimal si aucun n'était livré. */
function defaultInstrument(): Instrument {
  return {
    name: KIOSK_INSTRUMENT,
    format: "thin-air-instrument/1",
    pointer: "palm",
    scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 11] },
    range: { low: 45, high: 81 },
    snap: 0.6,
    voices: 1,
    sound: { engine: "osc", wave: "sine" },
  };
}

/** Volume de la borne quand une main joue : le défaut (-12 dB). */
export const KIOSK_VOLUME_DB = DEFAULT_SETTINGS.masterGainDb;

/** Volume du fantôme : moitié moins fort qu'une main, « à faible volume » (AIR-F-50). */
export const GHOST_VOLUME_DB = -24;

/**
 * Aimant imposé à 1 : la hauteur se pose sur la gamme. Une borne sans écran
 * de réglage doit rester agréable à une main pressée, même sans viser.
 */
export const KIOSK_MAGNET = 1;

/** Les réglages de la borne : l'aimant est posé sur la gamme, rien d'autre ne change. */
export function kioskSettings(): Settings {
  return { ...DEFAULT_SETTINGS, magnet: KIOSK_MAGNET };
}

/** Les réglages du fantôme : même instrument, volume abaissé (AIR-F-50). */
export function ghostSettings(base: Settings): Settings {
  return { ...base, masterGainDb: GHOST_VOLUME_DB };
}