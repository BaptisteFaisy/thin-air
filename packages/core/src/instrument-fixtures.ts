/**
 * Entrées de test construites à la main : des `TrackedHand` et des
 * `GestureEvent` littéraux (cahier §11.5). On teste ici le mapping de
 * l'instrument, pas la logique des lots B1 (`features`, `roles`, `gestures`)
 * ni A3 (`music`) — d'où les littéraux plutôt que leurs générateurs.
 */
import fc from "fast-check";
import type {
  Features,
  GestureEvent,
  GestureName,
  HandRole,
  HandSide,
  Instrument,
  MusicEvent,
  Settings,
  TrackedHand,
} from "./types.js";
import { withSettings } from "./defaults.js";

/** Mesures d'une main : tout est borné, `present` décide si la main est vue. */
export function mesures(over: Partial<Features> = {}): Features {
  return {
    u: 0.5,
    v: 0.75,
    pinch: 1,
    open: 1,
    speedU: 0,
    speedV: 0,
    present: true,
    edge: false,
    ...over,
  };
}

/** Une main suivie littérale ; `present: false` = main perdue après la grâce. */
export function main(role: HandRole, over: Partial<Features> = {}, present = true): TrackedHand {
  const features = mesures({ ...over, present });
  const side: HandSide = role === "pitch" ? "right" : "left";
  return { role, side, id: role === "pitch" ? 1 : 2, smooth: features, fast: features, present, lastSeenT: 0 };
}

/** Un geste littéral : `value` porte la vitesse (`cross`) ou la position. */
export function geste(
  gesture: GestureName,
  hand: HandRole = "pitch",
  over: Partial<GestureEvent> = {},
): GestureEvent {
  return { t: 0, hand, gesture, phase: "start", value: 0, ...over };
}

/** Thérémine du cahier §11.4 : étendue 45..81, ré mineur harmonique, aimant 0,6. */
export const PHANTOM: Instrument = {
  format: "thin-air-instrument/1",
  name: "Phantom",
  pointer: "palm",
  scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 11] },
  range: { low: 45, high: 81 },
  snap: 0.6,
  voices: 1,
  controls: [
    { hand: "pitch", feature: "u", to: "pitch" },
    { hand: "volume", feature: "v", to: "gain", curve: "db48" },
    { hand: "pitch", feature: "pinch", to: "vibrato", from: [0.4, 0.1], into: [0, 40] },
  ],
  gestures: [{ hand: "volume", gesture: "fist", do: "mute" }],
  oneHand: [
    { feature: "u", to: "pitch" },
    { feature: "open", to: "gain", curve: "db48" },
  ],
  sound: { engine: "osc", wave: "sine", second: 0.15, attackMs: 60, releaseMs: 250, glideMs: 30 },
};

/** Harpe du cahier, annexe B : seize cordes, ré mineur pentatonique. */
export const HARPE: Instrument = {
  format: "thin-air-instrument/1",
  name: "Harp",
  pointer: "index",
  scale: { root: 50, steps: [0, 3, 5, 7, 10] },
  strings: { count: 16, axis: "u" },
  snap: 1,
  voices: 8,
  gestures: [
    { hand: "any", gesture: "cross", do: "pluck", velocity: "speed" },
    { hand: "any", gesture: "pinch", do: "damp" },
  ],
  sound: { engine: "pluck", decay: 0.996 },
};

/** Chœur du cahier §7.8 : quatre zones, tenues, verrouillables en maintien. */
export const CHOEUR: Instrument = {
  format: "thin-air-instrument/1",
  name: "Choir",
  pointer: "palm",
  scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 11] },
  zones: {
    zones: [
      { id: "a", u0: 0, u1: 0.5, v0: 0.5, v1: 1, degree: 0 },
      { id: "b", u0: 0.5, u1: 1, v0: 0.5, v1: 1, degree: 2 },
      { id: "c", u0: 0, u1: 0.5, v0: 0, v1: 0.5, degree: 4 },
      { id: "d", u0: 0.5, u1: 1, v0: 0, v1: 0.5, midi: 62 },
    ],
  },
  snap: 1,
  voices: 4,
  gestures: [
    { hand: "any", gesture: "enter", do: "hold" },
    { hand: "any", gesture: "leave", do: "hold" },
    { hand: "any", gesture: "dwell", do: "hold" },
  ],
  sound: { engine: "osc", wave: "sawtooth", attackMs: 300, releaseMs: 800, detuneCents: 7 },
};

/** Les trois instruments de test, pour les propriétés. */
export const INSTRUMENTS: readonly Instrument[] = [PHANTOM, HARPE, CHOEUR];

export function reglages(over: Partial<Settings> = {}): Settings {
  return withSettings(over);
}

/** Les `noteOn` d'une liste d'événements. */
export function noteOns(events: readonly MusicEvent[]): readonly MusicEvent[] {
  return events.filter((event) => event.type === "noteOn");
}

/** Les `control` d'une cible donnée. */
export function controls(events: readonly MusicEvent[], param: string): readonly number[] {
  return events
    .filter((event): event is Extract<MusicEvent, { type: "control" }> => event.type === "control")
    .filter((event) => event.param === param)
    .map((event) => event.value);
}

/**
 * Générateurs fast-check pour les propriétés de la section 13.2 : des mains
 * suivies et des gestes quelconques, jamais de caméra réelle (AIR-N-10).
 * Les instants sont fabriqués par sommes d'écarts positifs : une prise ne
 * remonte jamais le temps, mais elle peut hoqueter (écarts irréguliers).
 */
const borne = fc.double({ min: 0, max: 1, noNaN: true });
const vitesse = fc.double({ min: 0, max: 4, noNaN: true });

export const genFeatures = fc.record({
  u: borne,
  v: borne,
  pinch: fc.double({ min: 0, max: 1.5, noNaN: true }),
  open: borne,
  speedU: vitesse,
  speedV: vitesse,
  present: fc.constant(true),
  edge: fc.boolean(),
});

export const genMain: fc.Arbitrary<TrackedHand> = fc.record({
  role: fc.constantFrom<HandRole>("pitch", "volume"),
  side: fc.constantFrom<HandSide>("left", "right"),
  id: fc.integer({ min: 0, max: 3 }),
  smooth: genFeatures,
  fast: genFeatures,
  present: fc.boolean(),
  lastSeenT: fc.double({ min: 0, max: 10, noNaN: true }),
});

export const genGeste: fc.Arbitrary<GestureEvent> = fc.record({
  t: fc.double({ min: 0, max: 10, noNaN: true }),
  hand: fc.constantFrom<HandRole>("pitch", "volume"),
  gesture: fc.constantFrom<GestureName>("pinch", "fist", "cross", "enter", "leave", "dwell", "handLost"),
  phase: fc.constantFrom<"start" | "end">("start", "end"),
  value: fc.double({ min: 0, max: 3, noNaN: true }),
  index: fc.integer({ min: 0, max: 7 }),
});

/** Une image : un instant, des mains suivies, des gestes. */
export interface Image {
  readonly t: number;
  readonly hands: readonly TrackedHand[];
  readonly gestures: readonly GestureEvent[];
}

const genContenu = fc.record({
  hands: fc.array(genMain, { maxLength: 2 }),
  gestures: fc.array(genGeste, { maxLength: 3 }),
});

/**
 * Une suite d'images : les écarts vont de 1 ms à 500 ms, donc certains trous
 * dépassent le relâchement de 300 ms (§7.9, règle 3) et d'autres non.
 */
export function genImages(maxLength = 24): fc.Arbitrary<readonly Image[]> {
  return fc
    .tuple(fc.array(fc.double({ min: 0.001, max: 0.5, noNaN: true }), { minLength: 1, maxLength }), fc.array(genContenu, { maxLength }))
    .map(([ecarts, contenus]) => {
      const images: Image[] = [];
      let t = 0;
      for (let i = 0; i < contenus.length; i += 1) {
        t += ecarts[i % ecarts.length] ?? 0.033;
        const contenu = contenus[i] as { hands: readonly TrackedHand[]; gestures: readonly GestureEvent[] };
        images.push({ t, hands: contenu.hands, gestures: contenu.gestures });
      }
      return images;
    });
}
