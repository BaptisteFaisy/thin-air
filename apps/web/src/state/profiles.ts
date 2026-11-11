/**
 * Profils de mobilité (cahier §3, §7.4, §12.4 ; AIR-F-10 à 12 ; AIR-N-06).
 *
 * Un profil est un choix en un geste qui tient la promesse du cahier :
 * « tout l'instrument tient dans la zone que j'atteins », le jeu à une main,
 * et le lissage accru pour les mains qui tremblent. Chaque profil rend deux
 * choses, toutes pures :
 *
 *   - un `Partial<Settings>` : les réglages qu'il change — le reste des
 *     réglages de l'utilisateur reste tel quel ;
 *   - une zone de jeu (`PlayRect`), ou `null` pour ne PAS toucher à la zone
 *     en place : un profil ne doit pas effacer une zone calibrée.
 *
 * Aucun profil ne touche l'instrument : l'étendue (la « tessiture ») d'un
 * instrument vit dans son fichier, pas dans un réglage. Changer la zone ne
 * change donc pas les notes — `u` et `v` sont des fractions du rectangle,
 * toujours dans [0, 1] quelle que soit sa taille (§7.4).
 */
import {
  DEFAULT_SETTINGS,
  defaultPlayRect,
  type PlayRect,
  type Settings,
} from "@thin-air/core";

export type ProfileId = "seated" | "oneHand" | "tremor";

export interface MobilityProfile {
  readonly id: ProfileId;
  /** Réglages appliqués par-dessus ceux en place. */
  readonly settings: Partial<Settings>;
  /** Zone de jeu à adopter, ou `null` pour conserver celle en place. */
  readonly playRect: PlayRect | null;
  /** Réglages laissés volontairement inchangés (dérivé de `settings`). */
  readonly unchanged: readonly (keyof Settings)[];
}

/** Toutes les clés de réglage, relues de `DEFAULT_SETTINGS` (§7.13). */
const TOUTES_CLES = Object.keys(DEFAULT_SETTINGS) as readonly (keyof Settings)[];

/** Les clés qu'un profil ne touche pas : tout ce qui n'est pas dans `settings`. */
function inchangees(partiel: Partial<Settings>): readonly (keyof Settings)[] {
  return TOUTES_CLES.filter((cle) => !(cle in partiel));
}

/**
 * Zone de jeu centrée, de largeur `span` sur chaque axe, non calibrée.
 * `calibratedAt: null` dit « zone préréglée », exactement comme la zone par
 * défaut (AIR-F-08).
 */
function zoneCentree(span: number): PlayRect {
  const de = (1 - span) / 2;
  return { u0: de, u1: de + span, v0: de, v1: de + span, calibratedAt: null };
}

/*
 * « Assis, portée courte » (cahier §3, Sam) : le défaut couvre les 80 %
 * centraux de l'image (AIR-F-08). Une portée assise réduite en tient environ
 * la moitié ; la zone se resserre donc sur les 40 % centraux, près du centre.
 */
const PORTEE_ASSISE_SPAN = 0.4;

export const PROFILS_ASSIS: MobilityProfile = {
  id: "seated",
  settings: {},
  playRect: zoneCentree(PORTEE_ASSISE_SPAN),
  unchanged: inchangees({}),
};

/*
 * « Une main » (AIR-F-10) : le bloc `oneHand` du fichier d'instrument joue la
 * même étendue avec une seule main. Le maintien (AIR-F-12, §7.6 : 400 ms dans
 * une zone verrouille la note) aide la main unique à se libérer sans perdre la
 * note. La zone n'est pas touchée : la portée reste celle de l'utilisateur.
 */
const UNE_MAIN_REGLAGES: Partial<Settings> = { oneHand: true, hold: true };

export const PROFILS_UNE_MAIN: MobilityProfile = {
  id: "oneHand",
  settings: UNE_MAIN_REGLAGES,
  playRect: null,
  unchanged: inchangees(UNE_MAIN_REGLAGES),
};

/*
 * « Mains qui tremblent » (§12.4) : lisser fort quand la main est lente, sans
 * traîner le geste voulu. La coupure minimale passe sous le défaut (1,5 Hz à
 * l'arrêt, §7.5) ; β réagit un peu plus au mouvement pour garder un geste
 * franc ; le canal vif des déclenchements est adouci pour ne pas multiplier
 * les fausses traversées ; la main perdue est tenue un peu plus longtemps
 * (défaut : 150 ms, §7.5).
 */
const TREMBLEMENT_FCMIN = 0.8; // Hz, défaut 1,5 (§7.5)
const TREMBLEMENT_BETA = 6; // défaut 5 (§7.5)
const TREMBLEMENT_FCTRIGGER = 5; // Hz, défaut 6 (§7.5)
const TREMBLEMENT_GRACE_MS = 200; // défaut 150 (§7.5)

const TREMBLEMENT_REGLAGES: Partial<Settings> = {
  fcMin: TREMBLEMENT_FCMIN,
  beta: TREMBLEMENT_BETA,
  fcTrigger: TREMBLEMENT_FCTRIGGER,
  graceMs: TREMBLEMENT_GRACE_MS,
};

export const PROFILS_TREMBLEMENT: MobilityProfile = {
  id: "tremor",
  settings: TREMBLEMENT_REGLAGES,
  playRect: null,
  unchanged: inchangees(TREMBLEMENT_REGLAGES),
};

/** Les trois profils, dans l'ordre du cahier (§3, §12.4). */
export const PROFILES: readonly MobilityProfile[] = [
  PROFILS_ASSIS,
  PROFILS_UNE_MAIN,
  PROFILS_TREMBLEMENT,
];

export function profileById(id: ProfileId): MobilityProfile {
  const trouve = PROFILES.find((profil) => profil.id === id);
  if (trouve === undefined) {
    throw new RangeError(`profil inconnu : ${id}`);
  }
  return trouve;
}

/** Les réglages du profil posés par-dessus ceux en place. */
export function applySettings(settings: Settings, profil: MobilityProfile): Settings {
  return { ...settings, ...profil.settings };
}

/** La zone à adopter, ou la zone en place si le profil n'en définit pas. */
export function applyRect(rect: PlayRect, profil: MobilityProfile): PlayRect {
  return profil.playRect ?? rect;
}

/** La zone par défaut, pour « aucun profil » : relue d'`@thin-air/core`. */
export function noProfileRect(): PlayRect {
  return defaultPlayRect();
}