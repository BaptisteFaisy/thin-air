/**
 * Thin Air — le contrat partagé.
 *
 * Ce fichier est la frontière entre les deux horloges (cahier §7.9) : tout ce
 * qui est à gauche (vision, gestes) produit des `MusicEvent` datés ; tout ce
 * qui est à droite (audio) les consomme. Aucun module ne peut changer ces
 * types sans accord : les lots sont construits en parallèle dessus.
 */

/** Un point de main : x, y normalisés dans l'image (0..1) et z relatif au poignet. */
export type HandPoint = readonly [number, number, number];

export type HandSide = "left" | "right";

/** Une main vue par le modèle : 21 points, un côté, un score. */
export interface DetectedHand {
  readonly side: HandSide;
  readonly score: number;
  readonly points: readonly HandPoint[];
}

export interface TakeFrame {
  /** Instant en secondes sur l'horloge de la prise. */
  readonly t: number;
  readonly hands: readonly DetectedHand[];
}

/**
 * Une prise : le flux des points des mains, jamais l'image (AIR-N-01).
 * C'est aussi ce que rejoue le fantôme et ce que mesure le banc d'essai.
 */
export interface Take {
  readonly format: "thin-air-take/1";
  readonly fps: number;
  readonly frames: readonly TakeFrame[];
}

/** Rôle d'une main dans un instrument à deux mains. */
export type HandRole = "pitch" | "volume";

/** Rectangle de jeu : la zone de l'image lue de 0 à 1 (cahier §7.4). */
export interface PlayRect {
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  /** Date de la calibration, `null` si c'est la zone par défaut. */
  readonly calibratedAt: number | null;
}

/** Mesures d'une main, dans la zone de jeu (cahier §7.6). */
export interface Features {
  /** Position du pointeur, de 0 à 1, bornée. */
  readonly u: number;
  readonly v: number;
  /** Écart pouce-index divisé par l'échelle de la paume. */
  readonly pinch: number;
  /** Main fermée (0) ou à plat (1). */
  readonly open: number;
  /** Vitesses en largeurs de zone par seconde, sur le canal vif. */
  readonly speedU: number;
  readonly speedV: number;
  /** Main vue, ou tenue pendant le délai de grâce. */
  readonly present: boolean;
  /** Le pointeur touche le bord de la zone. */
  readonly edge: boolean;
}

/** Une main suivie : rôle stable par continuité, deux canaux de filtrage. */
export interface TrackedHand {
  readonly role: HandRole;
  readonly side: HandSide;
  /** Identité de continuité : ne change pas quand deux mains se croisent. */
  readonly id: number;
  readonly smooth: Features;
  readonly fast: Features;
  readonly present: boolean;
  readonly lastSeenT: number;
}

export type GestureName =
  | "pinch"
  | "fist"
  | "cross"
  | "enter"
  | "leave"
  | "dwell"
  | "handLost";

export interface GestureEvent {
  readonly t: number;
  readonly hand: HandRole;
  readonly gesture: GestureName;
  readonly phase: "start" | "end";
  /** Vitesse pour `cross`, position pour `enter`/`leave`, mesure brute sinon. */
  readonly value: number;
  /** Corde ou zone concernée, quand le geste en vise une. */
  readonly index?: number;
}

/**
 * Le type qui traverse la couture. `t` est en secondes sur l'horloge du son :
 * en jeu direct, l'instant présent plus l'avance ; en rendu hors ligne,
 * l'instant de la prise.
 */
export type MusicEvent =
  | { readonly type: "noteOn"; readonly t: number; readonly voice: string; readonly midi: number; readonly velocity: number }
  | { readonly type: "noteOff"; readonly t: number; readonly voice: string }
  | {
      readonly type: "control";
      readonly t: number;
      readonly voice: string;
      readonly param: "pitch" | "gain" | "cutoff" | "vibrato";
      readonly value: number;
    };

export type PointerKind = "index" | "palm";
export type SoundEngine = "osc" | "pluck" | "fm" | "drum";
export type ScaleName =
  | "majorPentatonic"
  | "minorPentatonic"
  | "naturalMinor"
  | "harmonicMinor"
  | "hungarianMinor"
  | "major"
  | "wholeTone"
  | "chromatic";

export interface InstrumentScale {
  /** Fondamentale, numéro MIDI (69 = la 440 Hz). */
  readonly root: number;
  /** Écarts en demi-tons dans l'octave. */
  readonly steps: readonly number[];
}

export interface InstrumentRange {
  readonly low: number;
  readonly high: number;
}

export interface InstrumentStrings {
  readonly count: number;
  readonly axis: "u" | "v";
}

export interface InstrumentZone {
  readonly id: string;
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  /** Note absolue, ou degré de la gamme si `degree` est donné. */
  readonly midi?: number;
  readonly degree?: number;
}

export interface InstrumentZones {
  readonly zones: readonly InstrumentZone[];
}

export type FeatureName = "u" | "v" | "pinch" | "open" | "speedU" | "speedV";
export type ControlTarget = "pitch" | "gain" | "cutoff" | "vibrato";

export interface FeatureMap {
  readonly hand?: HandRole;
  readonly feature: FeatureName;
  readonly to: ControlTarget;
  /** `db48` : échelle en décibels du cahier §7.7 ; `linear` par défaut. */
  readonly curve?: "linear" | "db48";
  /** Intervalle d'entrée lu, intervalle de sortie produit. */
  readonly from?: readonly [number, number];
  readonly into?: readonly [number, number];
}

export type GestureAction = "pluck" | "damp" | "mute" | "hold" | "strike";

export interface GestureMap {
  readonly hand: HandRole | "any";
  readonly gesture: GestureName;
  readonly do: GestureAction;
  readonly velocity?: "speed" | "fixed";
  readonly value?: number;
}

export interface InstrumentSound {
  readonly engine: SoundEngine;
  readonly wave?: "sine" | "triangle" | "sawtooth" | "square";
  /** Amplitude de l'harmonique 2 (thérémine : 0,15). */
  readonly second?: number;
  readonly attackMs?: number;
  readonly releaseMs?: number;
  readonly glideMs?: number;
  /** Corde pincée : coefficient de la ligne à retard (0,996). */
  readonly decay?: number;
  readonly brightness?: { readonly feature: "u" | "v"; readonly into: readonly [number, number] };
  /** Cloches : rapport et indice de la modulation de fréquence. */
  readonly fmRatio?: number;
  readonly fmIndex?: number;
  /** Nappes : désaccordage des deux oscillateurs, en centièmes de demi-ton. */
  readonly detuneCents?: number;
  /** Percussions : durée du bruit et hauteur du corps sinusoïdal. */
  readonly noiseMs?: number;
  readonly toneHz?: number;
}

/** Un instrument est un fichier (cahier §6.2, annexe B). */
export interface Instrument {
  readonly format: "thin-air-instrument/1";
  readonly name: string;
  readonly pointer: PointerKind;
  readonly scale: InstrumentScale;
  /** Étendue continue (thérémine, bourdon). */
  readonly range?: InstrumentRange;
  /** Cordes verticales (harpe). */
  readonly strings?: InstrumentStrings;
  /** Zones tenues ou frappées (chœur, cloches, percussions). */
  readonly zones?: InstrumentZones;
  /** Aimant de 0 (glissé pur) à 1 (notes franches). */
  readonly snap: number;
  readonly voices: number;
  readonly controls?: readonly FeatureMap[];
  readonly gestures?: readonly GestureMap[];
  readonly oneHand?: readonly FeatureMap[];
  readonly sound: InstrumentSound;
  /** Réglages propres à cet instrument, fusionnés au-dessus des défauts. */
  readonly defaults?: Partial<Settings>;
}

export interface LoopLayer {
  readonly id: number;
  readonly instrument: string;
  readonly events: readonly MusicEvent[];
  readonly muted: boolean;
}

export interface Session {
  readonly format: "thin-air-session/1";
  readonly tempo: number;
  readonly bars: number;
  readonly beatsPerBar: number;
  readonly layers: readonly LoopLayer[];
  readonly settings: Settings;
}

/** Retard : ce qui est mesuré, ce qui est estimé (cahier §5.1, AIR-F-31). */
export interface LatencyReport {
  readonly frameIntervalMs: number;
  readonly inferenceMs: number;
  readonly processingMs: number;
  readonly audioBaseMs: number;
  readonly audioOutputMs: number | null;
  readonly cameraAssumedMs: number;
  /** Somme des parts mesurées. */
  readonly measuredTotalMs: number;
  /** Somme mesurée + caméra estimée. */
  readonly estimatedTotalMs: number;
  readonly partial: boolean;
}

export interface NoteMeasurement {
  readonly t: number;
  readonly midi: number;
  readonly expectedHz: number;
  readonly measuredHz: number;
  readonly cents: number;
}

export interface RenderReport {
  readonly take: string;
  readonly instrument: string;
  readonly sampleRate: number;
  readonly samples: number;
  readonly durationS: number;
  readonly notes: readonly NoteMeasurement[];
  readonly peakDb: number;
  readonly rmsDb: number;
  readonly maxVoices: number;
  readonly silenceAfterMs: number;
}

/** Réglages du cahier §7.13 — une seule source de vérité. */
export interface Settings {
  frameRateIdeal: number;
  numHands: number;
  graceMs: number;
  fcMin: number;
  beta: number;
  fcD: number;
  fcTrigger: number;
  pinchOn: number;
  pinchOff: number;
  fistOn: number;
  fistOff: number;
  zoneMargin: number;
  noteHysteresis: number;
  stringRearmMs: number;
  minPluckSpeed: number;
  paramTauMs: number;
  lookaheadMs: number;
  maxVoices: number;
  masterGainDb: number;
  ceilingDb: number;
  cameraLatencyMs: number;
  tempo: number;
  loopBars: number;
  beatsPerBar: number;
  dwellMs: number;
  wirelessWarnMs: number;
  stallReleaseMs: number;
  /** Aimant forcé, sinon celui de l'instrument. */
  magnet: number | null;
  leftHanded: boolean;
  oneHand: boolean;
  hold: boolean;
  reverb: number;
  quantize: "off" | "eighth" | "sixteenth";
  quantizeStrength: number;
  showCamera: boolean;
}
