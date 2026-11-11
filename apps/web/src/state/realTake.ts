/**
 * Le mode « prise réelle » (lot N7, cahier §7.3, §7.4, §7.5, annexe D).
 *
 * Trois scénarios guidés lèvent les trois points que les prises synthétiques
 * ne peuvent pas prouver : la convention de côté du modèle sur une vraie
 * caméra, l'étendue de la calibration, et les valeurs du filtre. Tout est
 * pur ici : le composant `ui/RealTake.tsx` ne fait que câbler la caméra et
 * l'enregistreur existant (`createTakeRecorder`, AIR-F-47 : les points
 * seulement, jamais l'image).
 */

export type RealTakeScenarioId = "left-hand-only" | "reach" | "tremor";

/** Une consigne du scénario : affichée à partir de `atS` secondes écoulées. */
export interface RealTakeStep {
  readonly atS: number;
  /** Clé de `m.realTake.steps` (textes externalisés, AIR-N-14). */
  readonly key: "leftHand" | "up" | "down" | "left" | "right" | "still" | "slow";
}

export interface RealTakeScenario {
  readonly id: RealTakeScenarioId;
  /** Durée de l'enregistrement, en secondes. */
  readonly durationS: number;
  /** Décompte avant l'enregistrement, en secondes. */
  readonly countdownS: number;
  readonly steps: readonly RealTakeStep[];
  /** Ce que la prise lève, dit à l'écran : clé de `m.realTake.purposes`. */
  readonly purposeKey: "side" | "calibration" | "filter";
}

/**
 * Les trois scénarios. Durées : 3 s pour la convention de côté (une pose
 * tenue), 8 s pour la calibration (§7.4 : « pendant huit secondes »), 10 s
 * pour le filtre (5 s main immobile + 5 s mouvement lent, §7.5).
 */
export const REAL_TAKE_SCENARIOS: readonly RealTakeScenario[] = [
  {
    id: "left-hand-only",
    durationS: 3,
    countdownS: 3,
    steps: [{ atS: 0, key: "leftHand" }],
    purposeKey: "side",
  },
  {
    id: "reach",
    durationS: 8,
    countdownS: 3,
    steps: [
      { atS: 0, key: "up" },
      { atS: 2, key: "down" },
      { atS: 4, key: "left" },
      { atS: 6, key: "right" },
    ],
    purposeKey: "calibration",
  },
  {
    id: "tremor",
    durationS: 10,
    countdownS: 3,
    steps: [
      { atS: 0, key: "still" },
      { atS: 5, key: "slow" },
    ],
    purposeKey: "filter",
  },
];

export function realTakeScenario(id: RealTakeScenarioId): RealTakeScenario {
  const trouve = REAL_TAKE_SCENARIOS.find((scenario) => scenario.id === id);
  if (trouve === undefined) throw new Error(`scénario inconnu : ${id}`);
  return trouve;
}

/** La consigne à afficher à `elapsedS` secondes d'enregistrement. */
export function stepAt(scenario: RealTakeScenario, elapsedS: number): RealTakeStep {
  let courant = scenario.steps[0] ?? { atS: 0, key: "leftHand" as const };
  for (const etape of scenario.steps) {
    if (etape.atS <= elapsedS) courant = etape;
  }
  return courant;
}

/** Nom du fichier téléchargé : le scénario d'abord, l'ingestion le relit. */
export function realTakeFilename(id: RealTakeScenarioId): string {
  return `${id}-take.json`;
}

/**
 * Le scénario d'un fichier, lu dans son nom : `left-hand-only-take.json` ou
 * `left-hand-only-…json` → `left-hand-only`. `null` si aucun ne correspond :
 * l'ingestion refuse alors le fichier au lieu de deviner.
 */
export function scenarioFromFilename(name: string): RealTakeScenarioId | null {
  const base = name.toLowerCase();
  for (const scenario of REAL_TAKE_SCENARIOS) {
    if (base.startsWith(scenario.id)) return scenario.id;
  }
  return null;
}

/** Les phases de la séance guidée : choix, décompte, enregistrement, fini. */
export type RealTakePhase = "pick" | "countdown" | "recording" | "done";

export interface RealTakeState {
  readonly phase: RealTakePhase;
  readonly scenarioId: RealTakeScenarioId | null;
  /** Secondes restant avant l'enregistrement. */
  readonly countdownS: number;
  /** Secondes écoulées depuis le début de l'enregistrement. */
  readonly elapsedS: number;
  /** Nom du fichier proposé au téléchargement, une fois fini. */
  readonly filename: string | null;
}

export const REAL_TAKE_INITIAL: RealTakeState = {
  phase: "pick",
  scenarioId: null,
  countdownS: 0,
  elapsedS: 0,
  filename: null,
};

export type RealTakeEvent =
  | { readonly type: "pick"; readonly id: RealTakeScenarioId }
  | { readonly type: "tick" }
  | { readonly type: "reset" };

/**
 * Une horloge d'une seconde bat `tick` : le décompte descend, puis
 * l'enregistrement avance jusqu'à sa durée. Le passage à `done` produit le
 * nom du fichier ; le composant y accroche `stop` et `downloadTake`.
 */
export function reduceRealTake(state: RealTakeState, event: RealTakeEvent): RealTakeState {
  if (event.type === "reset") return REAL_TAKE_INITIAL;
  if (event.type === "pick") {
    const scenario = realTakeScenario(event.id);
    return { ...REAL_TAKE_INITIAL, phase: "countdown", scenarioId: scenario.id, countdownS: scenario.countdownS };
  }
  if (state.phase === "countdown") {
    if (state.countdownS > 1) return { ...state, countdownS: state.countdownS - 1 };
    return { ...state, phase: "recording", countdownS: 0, elapsedS: 0 };
  }
  if (state.phase === "recording" && state.scenarioId !== null) {
    const elapsedS = state.elapsedS + 1;
    if (elapsedS < realTakeScenario(state.scenarioId).durationS) return { ...state, elapsedS };
    return { ...state, phase: "done", elapsedS, filename: realTakeFilename(state.scenarioId) };
  }
  return state;
}
