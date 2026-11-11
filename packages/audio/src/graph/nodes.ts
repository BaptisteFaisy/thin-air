/**
 * Les voix du jeu direct et le graphe du §7.9, branchés sur Web Audio.
 *
 *  voix 1 ┐
 *  voix 2 ┼─► mélange ─► réverbération ─► gain général ─► limiteur ─► plafond ─► sortie
 *   …     ┘              (réponse calculée)   (−12 dB)     (compresseur)  (−1 dB)
 *
 * Chaque réglage continu passe par une rampe (`rampParam`, règle 1 de §7.9) :
 * jamais une valeur fixée pendant qu'une voix sonne. Aucun fichier sonore
 * n'est embarqué : la réponse de la réverbération est calculée (AIR-F-25).
 *
 * Ce fichier parle au navigateur : il ne se teste pas dans Node. La logique qui
 * le pilote (bornage, ordonnancement, rampes, retard) vit dans `params.ts`,
 * `voices.ts`, `scheduler.ts` et `latency.ts`, et elle est testée.
 */
import type { InstrumentSound } from "@thin-air/core";
import { dbToGain, midiToFreq } from "@thin-air/core";
import { PLUCK_PROCESSOR_NAME } from "../worklets/pluck-core.js";
import { makeCeilingCurve, rampParam, releaseTauS } from "./params.js";

/** Profondeur du vibrato, en centièmes de demi-ton. */
export const VIBRATO_DEPTH_CENTS = 20;

/** Fréquence du vibrato quand l'instrument n'en demande pas, Hz. */
export const VIBRATO_HZ = 5;

/** Coupure du filtre de voix quand l'instrument n'en demande pas. */
export const DEFAULT_CUTOFF_HZ = 8000;

/**
 * Convention des valeurs de contrôle (le contrat ne fixe pas l'unité : à
 * confirmer avec les lots A3/A5). `pitch` en numéro MIDI, `gain` en amplitude
 * linéaire 0..1, `cutoff` et `vibrato` en Hz.
 */
export type ControlParamName = "pitch" | "gain" | "cutoff" | "vibrato";

export interface LiveVoice {
  readonly id: string;
  /** Le gain de la voix : c'est lui qui porte l'attaque et le fondu. */
  readonly gain: GainNode;
  start(at: number): void;
  /** Fin de note : un fondu, jamais une coupure (AIR-F-24). */
  noteOff(at: number, releaseS: number): void;
  setParam(param: ControlParamName, value: number, at: number, tauS: number): void;
  dispose(): void;
}

export interface LiveVoiceOptions {
  readonly sound: InstrumentSound;
  readonly midi: number;
  readonly velocity: number;
  readonly tauS: number;
  readonly seed: number;
  /** `false` si le module de corde n'a pas pu être installé. */
  readonly workletReady: boolean;
  readonly destination: AudioNode;
}

interface InnerVoice {
  start(at: number): void;
  stop(at: number): void;
  setParam(param: ControlParamName, value: number, at: number, tauS: number): void;
  dispose(): void;
}

/** Un oscillateur qui suit la fondamentale dans un rapport fixe. */
interface PitchFollower {
  readonly node: OscillatorNode;
  readonly ratio: number;
}

/** Fabrique une voix du moteur demandé : oscillateur, corde, FM ou percussion. */
export function createLiveVoice(context: AudioContext, id: string, options: LiveVoiceOptions): LiveVoice {
  const { sound, midi, velocity, tauS, destination } = options;
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(destination);
  const freq = midiToFreq(midi);
  const inner =
    sound.engine === "pluck" && options.workletReady
      ? buildPluckVoice(context, sound, freq, options, gain)
      : buildTonalVoice(context, sound, freq, options, gain);
  const attack = Math.max(tauS, 0.005);
  return {
    id,
    gain,
    start(at) {
      inner.start(at);
      rampParam(gain.gain, Math.min(Math.max(velocity, 0), 1), at, attack);
    },
    noteOff(at, releaseS) {
      rampParam(gain.gain, 0, at, releaseTauS(releaseS));
      inner.stop(at + Math.max(releaseS, tauS) * 4);
    },
    setParam(param, value, at, tau) {
      if (param === "gain") rampParam(gain.gain, value, at, attack);
      else inner.setParam(param, value, at, tau);
    },
    dispose() {
      inner.dispose();
      gain.disconnect();
    },
  };
}

/** Oscillateur, FM et percussion : tout se règle par `AudioParam`, donc tout se rampe. */
function buildTonalVoice(
  context: AudioContext,
  sound: InstrumentSound,
  freq: number,
  options: LiveVoiceOptions,
  out: AudioNode,
): InnerVoice {
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = DEFAULT_CUTOFF_HZ;
  filter.Q.value = 1;
  filter.connect(out);
  const amp = context.createGain();
  amp.gain.value = 1;
  amp.connect(filter);
  const osc = context.createOscillator();
  osc.type = sound.wave ?? "sine";
  osc.frequency.value = freq;
  osc.connect(amp);
  const sources: AudioScheduledSourceNode[] = [osc];
  const followers: PitchFollower[] = [];
  const vibrato = addVibrato(context, osc.detune);
  if (sound.engine === "fm") addFmModulator(context, sound, osc, freq, amp, sources, followers);
  else if (sound.engine === "drum") addDrumBody(context, sound, options.seed, amp, sources);
  else if ((sound.second ?? 0) > 0) addSecondHarmonic(context, sound, osc, freq, amp, sources, followers);
  return {
    start(at) {
      for (const source of sources) source.start(at);
    },
    stop(at) {
      for (const source of sources) stopAt(source, at);
    },
    setParam(param, value, at, tau) {
      if (param === "pitch") rampPitch(osc, followers, value, at, tau);
      else if (param === "cutoff") rampParam(filter.frequency, value, at, tau);
      else if (param === "vibrato" && vibrato !== null) rampParam(vibrato.frequency, value, at, tau);
    },
    dispose() {
      if (vibrato !== null) stopAt(vibrato.osc, context.currentTime);
      for (const node of [osc, amp, filter]) node.disconnect();
    },
  };
}

/** La fondamentale et ses suiveurs glissent ensemble : le rapport reste juste. */
function rampPitch(osc: OscillatorNode, followers: readonly PitchFollower[], midi: number, at: number, tau: number): void {
  const hz = midiToFreq(midi);
  rampParam(osc.frequency, hz, at, tau);
  for (const follower of followers) rampParam(follower.node.frequency, hz * follower.ratio, at, tau);
}

/** Corde pincée : un module audio à part (§7.9, AIR-F-29). */
function buildPluckVoice(
  context: AudioContext,
  sound: InstrumentSound,
  freq: number,
  options: LiveVoiceOptions,
  out: AudioNode,
): InnerVoice {
  const node = new AudioWorkletNode(context, PLUCK_PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    parameterData: { frequency: freq, decay: sound.decay ?? 0.996, brightness: 0.5 },
  });
  node.connect(out);
  const frequency = node.parameters.get("frequency");
  return {
    start(at) {
      node.port.postMessage({
        type: "noteOn",
        frequency: freq,
        velocity: options.velocity,
        seed: options.seed,
        at,
      });
    },
    stop() {
      node.port.postMessage({ type: "damp" });
    },
    setParam(param, value, at, tau) {
      // La corde n'a ni filtre ni vibrato : `cutoff` et `vibrato` y sont ignorés.
      if (param === "pitch" && frequency !== undefined) rampParam(frequency, midiToFreq(value), at, tau);
    },
    dispose() {
      node.port.close();
      node.disconnect();
    },
  };
}

function addVibrato(context: AudioContext, target: AudioParam): { osc: OscillatorNode; frequency: AudioParam } {
  const osc = context.createOscillator();
  osc.frequency.value = VIBRATO_HZ;
  const depth = context.createGain();
  depth.gain.value = VIBRATO_DEPTH_CENTS;
  osc.connect(depth);
  depth.connect(target);
  osc.start();
  return { osc, frequency: osc.frequency };
}

function addFmModulator(
  context: AudioContext,
  sound: InstrumentSound,
  carrier: OscillatorNode,
  freq: number,
  amp: AudioNode,
  sources: AudioScheduledSourceNode[],
  followers: PitchFollower[],
): void {
  const ratio = sound.fmRatio ?? 2;
  const mod = context.createOscillator();
  mod.frequency.value = freq * ratio;
  const depth = context.createGain();
  depth.gain.value = freq * (sound.fmIndex ?? 1);
  mod.connect(depth);
  depth.connect(carrier.frequency);
  mod.connect(amp);
  sources.push(mod);
  followers.push({ node: mod, ratio });
}

function addSecondHarmonic(
  context: AudioContext,
  sound: InstrumentSound,
  osc: OscillatorNode,
  freq: number,
  amp: AudioNode,
  sources: AudioScheduledSourceNode[],
  followers: PitchFollower[],
): void {
  const second = context.createOscillator();
  second.type = osc.type;
  second.frequency.value = freq * 2;
  const level = context.createGain();
  level.gain.value = sound.second ?? 0;
  second.connect(level);
  level.connect(amp);
  sources.push(second);
  followers.push({ node: second, ratio: 2 });
}

/** Le corps de la percussion : un bruit déterministe (graine) et un sinus. */
function addDrumBody(
  context: AudioContext,
  sound: InstrumentSound,
  seed: number,
  amp: AudioNode,
  sources: AudioScheduledSourceNode[],
): void {
  const seconds = Math.max((sound.noiseMs ?? 80) / 1000, 0.01);
  const buffer = context.createBuffer(1, Math.ceil(seconds * context.sampleRate), context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  for (let i = 0; i < data.length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    data[i] = (state / 4294967296) * 2 - 1;
  }
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  noise.connect(amp);
  sources.push(noise);
  if ((sound.toneHz ?? 0) > 0) {
    const body = context.createOscillator();
    body.frequency.value = sound.toneHz ?? 0;
    body.connect(amp);
    sources.push(body);
  }
}

function stopAt(node: AudioScheduledSourceNode, at: number): void {
  try {
    node.stop(at);
  } catch {
    /* déjà arrêté : rien à faire */
  }
}

export interface LiveGraph {
  readonly input: GainNode;
  readonly dry: GainNode;
  readonly wet: GainNode;
  readonly master: GainNode;
  readonly limiter: DynamicsCompressorNode;
  readonly ceiling: WaveShaperNode;
  /** Réponse de la réverbération calculée, `null` si le calcul n'était pas disponible. */
  readonly impulse: Float32Array | null;
}

/**
 * Réponse de réverbération calculée au démarrage : un bruit qui s'éteint (§7.9).
 *
 * Elle vient de `dsp/reverb.ts` (lot A5) via l'API du contrat, `createReverb` /
 * `generateImpulseResponse`. L'import est dynamique et tolérant : le module est
 * encore un `todo(...)` dans cet arbre, et un son sans réverbération vaut mieux
 * qu'un instrument muet. Dès que le lot A5 est mergé, aucune ligne ne change.
 *
 * TODO(raccordement lot A5) : remplacer ce try/catch par un appel direct une
 * fois `generateImpulseResponse` implémenté et `@thin-air/core/internal`
 * résolvable depuis le paquet `audio` (l'alias Vitest ne couvre pas
 * `@thin-air/core/internal` : seul le code de `core` peut l'importer).
 */
export async function buildImpulse(context: AudioContext, seconds: number, seed: number) {
  try {
    const { generateImpulseResponse } = await import("../dsp/reverb.js");
    return new Float32Array(generateImpulseResponse(context.sampleRate, seconds, 3, seed));
  } catch {
    return null;
  }
}

/** Construit le graphe du §7.9 et le branche jusqu'à la sortie. */
export function buildLiveGraph(context: AudioContext, ceilingLinear: number, impulse: Float32Array | null): LiveGraph {
  const input = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  const master = context.createGain();
  const limiter = context.createDynamicsCompressor();
  const ceiling = context.createWaveShaper();
  input.connect(dry);
  dry.connect(master);
  if (impulse === null) {
    wet.gain.value = 0;
    dry.gain.value = 1;
  } else {
    const convolver = context.createConvolver();
    convolver.buffer = impulseBuffer(context, impulse);
    input.connect(convolver);
    convolver.connect(wet);
    wet.connect(master);
  }
  limiter.threshold.value = 0;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  ceiling.curve = makeCeilingCurve(ceilingLinear);
  ceiling.oversample = "none";
  master.connect(limiter);
  limiter.connect(ceiling);
  ceiling.connect(context.destination);
  return { input, dry, wet, master, limiter, ceiling, impulse };
}

/** Mélange sec/humide : les deux gains bougent ensemble, en rampe (AIR-F-30). */
export function setReverbAmount(graph: LiveGraph, amount: number, at: number, tauS: number): void {
  const has = graph.impulse !== null;
  const wet = has ? Math.min(Math.max(amount, 0), 1) : 0;
  rampParam(graph.wet.gain, wet, at, tauS);
  rampParam(graph.dry.gain, 1 - wet, at, tauS);
}

/** Gain général (−12 dB par défaut) : une rampe, jamais une marche. */
export function setMasterGain(graph: LiveGraph, gainDb: number, at: number, tauS: number): void {
  rampParam(graph.master.gain, dbToGain(gainDb), at, tauS);
}

function impulseBuffer(context: AudioContext, impulse: Float32Array): AudioBuffer {
  const samples = new Float32Array(impulse);
  const buffer = context.createBuffer(2, Math.max(1, samples.length), context.sampleRate);
  buffer.copyToChannel(samples, 0);
  buffer.copyToChannel(samples, 1);
  return buffer;
}
