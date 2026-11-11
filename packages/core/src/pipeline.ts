/**
 * La chaîne complète, du cadre aux événements (cahier §7.1) :
 * image → rôles → filtrage → mesures → gestes → instrument → événements.
 * C'est ce que rejoue le banc d'essai sur une prise, et ce que la page
 * exécute en direct. `core` est pur : aucune dépendance au navigateur
 * (AIR-N-09).
 *
 * Ce module ne mesure rien lui-même : il assemble les étages écrits par les
 * autres lots (rôles, filtrage et mesures, gestes) et les branche sur
 * `InstrumentPlayer`. Les étages sont injectables (`PipelineOptions.stages`)
 * pour deux raisons : les tests de cette chaîne prouvent la composition sans
 * dépendre de l'implémentation du lot B1, et la page peut fournir les siens.
 */
import type {
  DetectedHand,
  Features,
  GestureEvent,
  HandRole,
  Instrument,
  MusicEvent,
  PointerKind,
  Settings,
  Take,
  TakeFrame,
  TrackedHand,
} from "./types.js";
import { defaultPlayRect, withSettings } from "./defaults.js";
import { InstrumentPlayer } from "./instrument.js";
import { GestureTracker } from "./gestures.js";
import { FeatureTracker } from "./features.js";
import { RoleTracker, type AssignedHand } from "./roles.js";

/** Un étage qui rend des mesures pour une main (lot B1). */
export interface FeaturesStage {
  push(tSeconds: number, hand: DetectedHand | null): { readonly smooth: Features; readonly fast: Features };
  reset(): void;
}

/** Un étage qui attribue les rôles aux mains détectées (lot B1). */
export interface RolesStage {
  push(tSeconds: number, hands: readonly DetectedHand[]): readonly AssignedHand[];
  reset(): void;
}

/** Un étage qui rend les gestes d'une image (lot B1). */
export interface GesturesStage {
  push(tSeconds: number, hands: readonly TrackedHand[]): readonly GestureEvent[];
  releaseAll(tSeconds: number): readonly GestureEvent[];
  reset(): void;
}

export interface PipelineStages {
  readonly roles: RolesStage;
  readonly gestures: GesturesStage;
  /** Un suiveur de mesures par rôle : chacun possède ses filtres. */
  readonly featuresFor: (role: HandRole) => FeaturesStage;
}

export interface PipelineOptions {
  readonly oneHand?: boolean;
  readonly hold?: boolean;
  readonly leftHanded?: boolean;
  readonly magnet?: number | null;
  /** Rectangle de jeu calibré ; par défaut les 80 % centraux. */
  readonly rect?: PlayRectOption;
  readonly aspect?: number;
  /**
   * Après la dernière image : délai de grâce, relâchement et extinction.
   * Désactivé seulement pour mesurer un comportement précis.
   */
  readonly finish?: boolean;
  /** Étages injectés ; par défaut ceux des modules du lot B1. */
  readonly stages?: PipelineStages;
}

type PlayRectOption = import("./types.js").PlayRect;

/** Les deux rôles, dans l'ordre de lecture. */
const ROLES: readonly HandRole[] = ["pitch", "volume"];

/**
 * Les étages réels : rôles par continuité, deux canaux de filtrage par main,
 * gestes à seuils doubles (lots B1). Rien n'est réimplémenté ici.
 */
export function defaultStages(instrument: Instrument, settings: Settings, options?: PipelineOptions): PipelineStages {
  const rect = options?.rect ?? defaultPlayRect();
  const aspect = options?.aspect ?? 4 / 3;
  const pointer: PointerKind = instrument.pointer;
  const features = new Map<HandRole, FeaturesStage>();
  return {
    roles: new RoleTracker(settings),
    gestures: new GestureTracker(instrument, settings),
    featuresFor: (role: HandRole): FeaturesStage => {
      const known = features.get(role);
      if (known) return known;
      const created = new FeatureTracker(rect, aspect, settings, pointer);
      features.set(role, created);
      return created;
    },
  };
}

export class TakeProcessor {
  private readonly settings: Settings;
  private readonly stages: PipelineStages;
  private readonly player: InstrumentPlayer;
  private readonly events: MusicEvent[] = [];
  private lastT = 0;
  private done = false;

  constructor(
    readonly instrument: Instrument,
    settings: Settings,
    readonly options?: PipelineOptions,
  ) {
    this.settings = withSettings({ ...instrument.defaults, ...settings });
    this.stages = options?.stages ?? defaultStages(instrument, this.settings, options);
    this.player = new InstrumentPlayer(instrument, this.settings, options);
  }

  /** Une image de la prise : rend les événements qu'elle produit, dans l'ordre. */
  push(frame: TakeFrame): readonly MusicEvent[] {
    if (this.done) return [];
    const t = this.instant(frame.t);
    const hands = this.tracked(t, frame.hands);
    const gestures = this.stages.gestures.push(t, hands);
    const events = this.player.frame(t, hands, gestures);
    this.lastT = t;
    this.events.push(...events);
    return events;
  }

  /**
   * Fin de prise : la grâce (`graceMs`), le relâchement, l'extinction.
   * Les gestes encore enclenchés sont clos ici, et le lecteur datte ses
   * `noteOff` à `t + graceMs` : le son s'éteint, il ne se coupe pas.
   */
  finish(): readonly MusicEvent[] {
    if (this.done) return [];
    this.done = true;
    // Les gestes encore enclenchés sont clos (état des étages B1) : leurs
    // événements de geste ne traversent pas la couture, seuls les événements
    // musicaux en sortent (§11.3). `end` relâche tout ce qui sonnait.
    this.stages.gestures.releaseAll(this.lastT);
    const out = [...this.player.end(this.lastT)];
    this.events.push(...out);
    return out;
  }

  /** Tous les événements produits depuis le début, dans l'ordre (AIR-P-11). */
  get allEvents(): readonly MusicEvent[] {
    return this.events;
  }

  /** Voix actives : doit valoir zéro après `finish` (AIR-P-09). */
  get activeVoiceCount(): number {
    return this.player.activeVoiceCount;
  }

  /** Le plus grand nombre de voix actives vues (AIR-P-10). */
  get peakVoices(): number {
    return this.player.peakVoices;
  }

  /** Note visée, pour l'écran (AIR-F-53). */
  currentMidi(): number | null {
    return this.player.currentMidi();
  }

  /** Un instant de prise ne recule jamais : une image en double est datée. */
  private instant(tSeconds: number): number {
    if (!Number.isFinite(tSeconds)) return this.lastT;
    return Math.max(this.lastT, tSeconds);
  }

  /** Les deux mains suivies de l'image, rôle par rôle, filtres compris. */
  private tracked(t: number, hands: readonly DetectedHand[]): readonly TrackedHand[] {
    const assigned = this.stages.roles.push(t, hands);
    const out: TrackedHand[] = [];
    for (const role of ROLES) {
      const mine = assigned.find((candidate) => candidate.role === role);
      out.push(this.trackOne(t, role, mine));
    }
    return out;
  }

  private trackOne(t: number, role: HandRole, assigned: AssignedHand | undefined): TrackedHand {
    const feats = this.stages.featuresFor(role).push(t, assigned?.hand ?? null);
    return {
      role,
      side: assigned?.side ?? (role === "pitch" ? "right" : "left"),
      id: assigned?.id ?? -1,
      smooth: feats.smooth,
      fast: feats.fast,
      present: feats.smooth.present,
      lastSeenT: t,
    };
  }
}

/**
 * Une prise + un instrument = une liste d'événements, au bit près identique
 * d'un appel à l'autre (AIR-P-12). C'est LA fonction que le banc d'essai
 * appelle.
 */
export function processTake(
  take: Take,
  instrument: Instrument,
  settings?: Partial<Settings>,
  options?: PipelineOptions,
): readonly MusicEvent[] {
  const merged = withSettings({ ...instrument.defaults, ...(settings ?? {}) });
  const processor = new TakeProcessor(instrument, merged, options);
  for (const frame of take.frames) processor.push(frame);
  if (options?.finish !== false) processor.finish();
  return processor.allEvents;
}
