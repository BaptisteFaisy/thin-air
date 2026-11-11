/**
 * La machine à états du mode kiosque (LOT t7, parcours P11, AIR-F-50).
 *
 * Pure : aucun React, aucun DOM, aucune horloge interne. Le temps arrive
 * dans les événements (`atMs`, en millisecondes), donc les tests rejouent
 * une nuit entière sans attendre (AIR-N-09).
 *
 * Quatre états :
 * - `idle`      : personne — le fantôme rejoue une prise en boucle ;
 * - `occupied`  : une main est là — le fantôme se tait, la main joue ;
 * - `returning` : la main est partie — délai avant le retour du fantôme ;
 * - `degraded`  : caméra perdue, refusée ou modèle en échec — le fantôme
 *   continue (la borne ne meurt jamais) et un message discret l'explique.
 *
 * Chaque transition rend le nouvel état ET les actions à mener ; c'est
 * l'écran (`Kiosk.tsx`) qui les exécute, jamais la machine.
 */

/** Les quatre états de la borne. */
export type KioskPhase = "idle" | "occupied" | "returning" | "degraded";

/** La cause d'un état dégradé (§12.2 : caméra perdue, refusée, modèle en échec). */
export type KioskFault = "cameraLost" | "cameraDenied" | "modelError";

/** Ce que la borne apprend du monde extérieur. `atMs` : l'horloge de l'écran. */
export type KioskEvent =
  | { readonly type: "handSeen"; readonly atMs: number }
  | { readonly type: "handGone"; readonly atMs: number }
  | { readonly type: "cameraLost" }
  | { readonly type: "cameraDenied" }
  | { readonly type: "modelError" }
  | { readonly type: "cameraBack"; readonly atMs: number }
  | { readonly type: "tabHidden"; readonly atMs: number }
  | { readonly type: "tabVisible"; readonly atMs: number }
  | { readonly type: "tick"; readonly atMs: number };

/** Ce que l'écran doit faire : démarrer/arrêter le fantôme, afficher, relâcher. */
export type KioskAction =
  | "ghostStart"
  | "ghostStop"
  | "releaseAll"
  | "messageShow"
  | "messageHide";

export interface KioskState {
  readonly phase: KioskPhase;
  /** Cause affichée par le message discret ; `null` quand tout va bien. */
  readonly fault: KioskFault | null;
  /** Le rejeu tourne-t-il ? (reflète les actions ghostStart/ghostStop) */
  readonly ghost: boolean;
  /** Onglet masqué : tout est relâché, le fantôme est en pause (AIR-N-08). */
  readonly tabHidden: boolean;
  /** Dernier moment où une main était vue ; sert au délai de retour. */
  readonly lastHandMs: number | null;
}

export interface KioskTransition {
  readonly state: KioskState;
  readonly actions: readonly KioskAction[];
}

/**
 * Délai sans main avant le retour du fantôme : 10 secondes. Moitié du délai
 * de premier démarrage (AIR-F-50, 20 s) : un visiteur qui recule pour
 * écouter, ou qui échange sa place, revient souvent dans ce délai — le
 * fantôme ne doit pas reprendre sous sa main. Au-delà, une borne muette
 * paraît éteinte : dix secondes d'inactivité, et la séance reprend.
 */
export const RETOUR_FANTOME_MS = 10_000;

export function initialKioskState(): KioskState {
  return {
    phase: "idle",
    fault: null,
    ghost: false,
    tabHidden: false,
    lastHandMs: null,
  };
}

function sansDoublon(actions: readonly KioskAction[]): readonly KioskAction[] {
  return actions.filter((action, index) => actions.indexOf(action) === index);
}

function fige(state: KioskState, actions: readonly KioskAction[] = []): KioskTransition {
  return { state, actions: sansDoublon(actions) };
}

/** Le seul endroit où l'état change : un événement, une transition. */
export function reduceKiosk(state: KioskState, event: KioskEvent): KioskTransition {
  switch (event.type) {
    case "handSeen":
      return mainVue(state);
    case "handGone":
      return mainPartie(state, event.atMs);
    case "cameraLost":
    case "cameraDenied":
    case "modelError":
      return panne(state, event.type);
    case "cameraBack":
      return cameraRetablie(state, event.atMs);
    case "tabHidden":
      return ongletMasque(state);
    case "tabVisible":
      return ongletVisible(state, event.atMs);
    case "tick":
      return battement(state, event.atMs);
    default:
      return fige(state);
  }
}

/** Une main paraît : le fantôme s'arrête dès cet écran (P11, AIR-F-50). */
function mainVue(state: KioskState): KioskTransition {
  if (state.tabHidden) return fige(state);
  if (state.phase === "occupied") return fige(state, state.ghost ? ["ghostStop"] : []);
  const actions: KioskAction[] = [];
  if (state.ghost) actions.push("ghostStop");
  if (state.fault !== null) actions.push("messageHide");
  return fige(
    { ...state, phase: "occupied", fault: null, ghost: false, lastHandMs: null },
    actions,
  );
}

/** Plus de main : le délai de retour commence (ou continue). */
function mainPartie(state: KioskState, atMs: number): KioskTransition {
  if (state.tabHidden) return fige(state);
  if (state.phase === "degraded") return fige(state);
  if (state.phase === "occupied") {
    return fige({ ...state, phase: "returning", lastHandMs: atMs });
  }
  if (state.phase === "returning" && state.lastHandMs === null) {
    return fige({ ...state, lastHandMs: atMs });
  }
  return fige(state);
}

/** Caméra perdue, refusée, ou modèle en échec : le fantôme continue (§12.2). */
function panne(state: KioskState, fault: KioskFault): KioskTransition {
  const actions: KioskAction[] = ["messageShow"];
  if (state.phase === "occupied") actions.push("releaseAll");
  return fige({ ...state, phase: "degraded", fault, lastHandMs: null }, actions);
}

/** La caméra revient : le message s'efface, le délai de retour recommence. */
function cameraRetablie(state: KioskState, atMs: number): KioskTransition {
  if (state.phase !== "degraded") return fige(state);
  return fige(
    { ...state, phase: "returning", fault: null, lastHandMs: atMs },
    ["messageHide"],
  );
}

/** Onglet masqué : aucune note ne reste, le fantôme se met en pause (AIR-N-08). */
function ongletMasque(state: KioskState): KioskTransition {
  if (state.tabHidden) return fige(state);
  const actions: KioskAction[] = ["releaseAll"];
  if (state.ghost) actions.push("ghostStop");
  return fige({ ...state, tabHidden: true, ghost: false }, actions);
}

/** Onglet visible à nouveau : la séance repart de cet écran. */
function ongletVisible(state: KioskState, atMs: number): KioskTransition {
  if (!state.tabHidden) return fige(state);
  const suivant: KioskState = {
    ...state,
    tabHidden: false,
    lastHandMs: state.phase === "returning" || state.phase === "occupied" ? atMs : state.lastHandMs,
    phase: state.phase === "occupied" ? "returning" : state.phase,
  };
  const actions: KioskAction[] = [];
  if (suivant.phase !== "returning") actions.push("ghostStart");
  return fige({ ...suivant, ghost: suivant.phase !== "returning" }, actions);
}

/**
 * Le battement d'écran : il porte le temps. C'est lui qui fait revenir le
 * fantôme après le délai d'inactivité, et qui le rallume s'il s'était tu.
 */
function battement(state: KioskState, atMs: number): KioskTransition {
  if (state.tabHidden) return fige(state);
  if (state.phase === "returning") return retourRetarde(state, atMs);
  if (state.phase === "occupied") return fige(state);
  if (!state.ghost) return fige({ ...state, ghost: true }, ["ghostStart"]);
  return fige(state);
}

/** `returning` : attendre le délai complet sans main, puis rallumer le fantôme. */
function retourRetarde(state: KioskState, atMs: number): KioskTransition {
  const depuis = state.lastHandMs ?? atMs;
  if (atMs - depuis < RETOUR_FANTOME_MS) return fige(state);
  return fige({ ...state, phase: "idle", lastHandMs: null, ghost: true }, ["ghostStart"]);
}
