/**
 * La boucle (cahier §7.10) : enregistrement d'événements, compensation du
 * retard, calage sur la grille, six couches au plus.
 * Propriété : AIR-P-17.
 *
 * Rien de sonore ici, et aucune horloge lue : tous les instants viennent des
 * arguments. Les événements enregistrés sont toujours des `MusicEvent`
 * (`types.ts`), jamais des échantillons.
 */
import { DEFAULT_SETTINGS, SAMPLE_RATE } from "./defaults.js";
import { sortByTimeStable, withTime, wrapWithin } from "./events.js";
import type { LoopLayer, MusicEvent, Session, Settings } from "./types.js";

/** Tempo retenu : le donné s'il est exploitable, le défaut sinon. */
function safeTempo(tempo: number): number {
  return Number.isFinite(tempo) && tempo > 0 ? tempo : DEFAULT_SETTINGS.tempo;
}

/** Nombre de temps retenu : entier positif, défaut sinon. */
function safeBeats(beatsPerBar: number): number {
  return Number.isFinite(beatsPerBar) && beatsPerBar >= 1
    ? Math.round(beatsPerBar)
    : DEFAULT_SETTINGS.beatsPerBar;
}

/** Nombre de mesures retenu : entier positif, défaut sinon. */
function safeBars(bars: number): number {
  return Number.isFinite(bars) && bars >= 1 ? Math.round(bars) : DEFAULT_SETTINGS.loopBars;
}

/** Durée d'un temps (une noire), en secondes. */
export function beatSeconds(tempo: number): number {
  return 60 / safeTempo(tempo);
}

/** Durée d'une mesure en secondes, au tempo donné (§7.10). */
export function barSeconds(tempo: number, beatsPerBar: number): number {
  return safeBeats(beatsPerBar) * beatSeconds(tempo);
}

export function loopSeconds(tempo: number, bars: number, beatsPerBar: number): number {
  return safeBars(bars) * barSeconds(tempo, beatsPerBar);
}

/**
 * Longueur d'une boucle en échantillons, arrondie au plus proche : à 90
 * battements par minute, quatre mesures et 48 000 par seconde, elle vaut
 * exactement 512 000 (recette §18).
 */
export function loopSamples(
  tempo: number,
  bars: number,
  beatsPerBar: number,
  sampleRate: number = SAMPLE_RATE,
): number {
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : SAMPLE_RATE;
  return Math.round(loopSeconds(tempo, bars, beatsPerBar) * rate);
}

/** Longueur de la boucle décrite par une session, en secondes. */
export function sessionLoopSeconds(session: Session): number {
  return loopSeconds(session.tempo, session.bars, session.beatsPerBar);
}

/** Intervalle de la grille de calage, en secondes (`off` : pas de grille). */
export function gridStepSeconds(
  grid: "off" | "eighth" | "sixteenth",
  tempo: number,
): number {
  switch (grid) {
    case "off":
      return 0;
    case "eighth":
      return beatSeconds(tempo) / 2;
    case "sixteenth":
      return beatSeconds(tempo) / 4;
  }
}

/**
 * Compensation : les instants enregistrés sont avancés du retard estimé
 * (part mesurée + caméra), en restant dans la boucle.
 *
 * Un instant devenu négatif repasse en fin de boucle. Le résultat est trié par
 * instant (tri stable) : la boucle rejoue des événements monotones même quand
 * la compensation fait passer certains d'entre eux après leurs voisins.
 */
export function compensate(
  events: readonly MusicEvent[],
  latencyS: number,
  loopLengthS: number,
): readonly MusicEvent[] {
  const length = Number.isFinite(loopLengthS) && loopLengthS > 0 ? loopLengthS : 0;
  const latency = Number.isFinite(latencyS) ? latencyS : 0;
  if (length === 0) return events.map((event) => withTime(event, event.t));
  const shifted = events.map((event) => withTime(event, wrapWithin(event.t - latency, length)));
  return sortByTimeStable(shifted);
}

/** Une attaque et le décalage qu'elle transmet aux événements qui la suivent. */
interface AttackShift {
  readonly t: number;
  readonly shift: number;
}

/**
 * Décalage de chaque attaque, par voix : `force × (grille la plus proche −
 * attaque)`. Une voix sans attaque n'a aucun décalage.
 */
function attackShifts(
  events: readonly MusicEvent[],
  step: number,
  strength: number,
): Map<string, AttackShift[]> {
  const parVoix = new Map<string, AttackShift[]>();
  for (const event of events) {
    if (event.type !== "noteOn") continue;
    const cible = Math.round(event.t / step) * step;
    const shifts = parVoix.get(event.voice) ?? [];
    shifts.push({ t: event.t, shift: strength * (cible - event.t) });
    parVoix.set(event.voice, shifts);
  }
  return parVoix;
}

/** Décalage applicable à un instant d'une voix : celui de son attaque en cours. */
function shiftAt(shifts: readonly AttackShift[] | undefined, t: number): number {
  if (shifts === undefined) return 0;
  let retenu = 0;
  for (const entree of shifts) {
    if (entree.t <= t) retenu = entree.shift;
    else break;
  }
  return retenu;
}

/**
 * Calage sur la grille : force 0 ne change rien, force 1 pose sur le temps.
 *
 * Seules les **attaques** (`noteOn`) sont calées. Les autres événements d'une
 * voix — fin de note, réglages continus — reçoivent le décalage de l'attaque
 * qui les précède : la durée et la forme de la note ne bougent pas, seule sa
 * position change. Un calage peut faire passer un événement avant un voisin
 * d'une autre voix : le résultat est trié par instant.
 */
export function quantize(
  events: readonly MusicEvent[],
  grid: "off" | "eighth" | "sixteenth",
  strength: number,
  tempo: number,
  beatsPerBar: number,
): readonly MusicEvent[] {
  const step = gridStepSeconds(grid, tempo);
  const force = Number.isFinite(strength) ? Math.min(Math.max(strength, 0), 1) : 0;
  if (step <= 0 || force === 0) return events.map((event) => withTime(event, event.t));
  void beatsPerBar;
  const ordonnes = sortByTimeStable(events);
  const shifts = attackShifts(ordonnes, step, force);
  const cales = ordonnes.map((event) =>
    withTime(event, event.t + shiftAt(shifts.get(event.voice), event.t)),
  );
  return sortByTimeStable(cales);
}

export const MAX_LAYERS = 6;

/**
 * Enregistreur de couches : `start`, `record`, `stop`, et les opérations du
 * §7.10 (retirer la dernière couche, couper une couche, tout effacer).
 *
 * Ce qui est mémorisé : des `MusicEvent` datés sur l'horloge du son, ramenés
 * à l'origine de la prise. Au-delà d'une boucle, la fin de la prise est
 * ignorée : la capture s'arrête à la longueur de la boucle.
 */
export class LoopRecorder {
  /** Retard estimé, en secondes, retiré à chaque événement à l'arrêt d'une couche. */
  latencyS = 0;

  private readonly stored: LoopLayer[] = [];
  private capture: MusicEvent[] | null = null;
  private originS = 0;
  private nextId = 1;

  constructor(readonly settings: Settings) {}

  /** Couches enregistrées, dans l'ordre de création. */
  get layers(): readonly LoopLayer[] {
    return this.stored;
  }

  get isRecording(): boolean {
    return this.capture !== null;
  }

  /** Longueur de la boucle, en secondes, d'après les réglages. */
  get loopLengthS(): number {
    const { tempo, loopBars, beatsPerBar } = this.settings;
    return loopSeconds(tempo, loopBars, beatsPerBar);
  }

  start(tSeconds: number): void {
    this.originS = Number.isFinite(tSeconds) ? tSeconds : 0;
    this.capture = [];
  }

  /** Un événement de plus ; sans `start` préalable, il est ignoré. */
  record(event: MusicEvent): void {
    if (this.capture === null) return;
    this.capture.push(withTime(event, event.t - this.originS));
  }

  /** Couche terminée ; `null` si la boucle est pleine (six couches). */
  stop(tSeconds: number, instrumentName: string): LoopLayer | null {
    const captured = this.capture;
    this.capture = null;
    if (captured === null) return null;
    if (this.stored.length >= MAX_LAYERS) return null;
    const length = this.loopLengthS;
    const stopRel = Number.isFinite(tSeconds) ? tSeconds - this.originS : length;
    const limite = Math.min(length, stopRel);
    const inside = captured.filter((event) => event.t >= 0 && event.t < limite);
    const layer: LoopLayer = {
      id: this.nextId++,
      instrument: instrumentName,
      events: compensate(inside, this.latencyS, length),
      muted: false,
    };
    this.stored.push(layer);
    return layer;
  }

  /** Retire la dernière couche ; `undefined` s'il n'y en a plus. */
  removeLastLayer(): LoopLayer | undefined {
    return this.stored.pop();
  }

  /** Coupe (muet) ou rétablit une couche ; `false` si l'identifiant est inconnu. */
  setLayerMuted(id: number, muted: boolean): boolean {
    const index = this.stored.findIndex((layer) => layer.id === id);
    if (index < 0) return false;
    const couche = this.stored[index] as LoopLayer;
    this.stored[index] = { ...couche, muted };
    return true;
  }

  /** Bascule le muet d'une couche ; `false` si l'identifiant est inconnu. */
  toggleLayerMuted(id: number): boolean {
    const couche = this.stored.find((layer) => layer.id === id);
    if (couche === undefined) return false;
    return this.setLayerMuted(id, !couche.muted);
  }

  /** Tout effacer : couches et prise en cours. */
  clear(): void {
    this.stored.length = 0;
    this.capture = null;
  }

  /** La session correspondant à l'état courant. */
  toSession(): Session {
    return { ...emptySession(this.settings), layers: [...this.stored] };
  }
}

/**
 * Les événements à jouer à un instant de la boucle, toutes couches non muettes.
 *
 * `positionS` est une position sur l'axe du temps qui peut dépasser la
 * longueur de la boucle (le temps avance, la boucle tourne). La fenêtre est
 * **fermée au début, ouverte à la fin** : `[positionS, positionS + windowS)`.
 * Un événement tombe donc dans exactement une fenêtre d'une suite de fenêtres
 * jointives, et les instants rendus sont absolus, prêts à être programmés.
 */
export function loopEventsAt(
  session: Session,
  positionS: number,
  windowS: number,
): readonly MusicEvent[] {
  const length = sessionLoopSeconds(session);
  if (!(length > 0) || !(windowS > 0)) return [];
  const start = Number.isFinite(positionS) ? positionS : 0;
  const dus: MusicEvent[] = [];
  for (const layer of session.layers) {
    if (layer.muted) continue;
    for (const event of layer.events) {
      const inside = event.t >= 0 && event.t < length;
      const base = inside ? event.t : wrapWithin(event.t, length);
      // Chaque événement n'a qu'un décalage dans `[0, boucle)` : une suite de
      // fenêtres jointives le voit donc exactement une fois par tour.
      const offset = wrapWithin(base - start, length);
      for (let tour = 0; tour * length + offset < windowS; tour++) {
        dus.push(withTime(event, start + tour * length + offset));
      }
    }
  }
  return sortByTimeStable(dus);
}

export function emptySession(settings: Settings): Session {
  return {
    format: "thin-air-session/1",
    tempo: settings.tempo,
    bars: settings.loopBars,
    beatsPerBar: settings.beatsPerBar,
    layers: [],
    settings,
  };
}
