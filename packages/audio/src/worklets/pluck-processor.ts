/**
 * Module audio de la corde pincée (cahier §7.9, AIR-F-29).
 *
 * Pourquoi un module à part : dans le graphe ordinaire du navigateur, un retard
 * pris dans une boucle ne peut pas descendre sous un bloc de 128 échantillons
 * (2,67 ms), donc aucune note au-dessus de 375 Hz ne serait possible. Dans un
 * `AudioWorkletProcessor`, la ligne à retard se règle échantillon par
 * échantillon : ré 146,83 Hz à 48 kHz fait 326,9 échantillons.
 *
 * Installable par `audioWorklet.addModule()` à partir d'une URL du site : ce
 * fichier est autonome (il n'importe que `pluck-core.js`, le même calcul que le
 * rendu hors ligne). Aucun fichier sonore n'est embarqué (AIR-F-25) : la corde
 * est excitée par un bruit déterministe tiré d'une graine.
 */
import { PLUCK_PROCESSOR_NAME, PluckString } from "./pluck-core.js";

interface WorkletProcessorBase {
  readonly port: MessagePort;
  readonly sampleRate: number;
  readonly currentTime: number;
}

type WorkletBaseCtor = new (options?: { processorOptions?: NoteOnMessage }) => WorkletProcessorBase;

/** Le fichier reste importable hors navigateur (Node) : la classe de base manque alors. */
const fallbackBase: WorkletBaseCtor = class {
  readonly port = { addEventListener(): void {}, postMessage(): void {} } as unknown as MessagePort;

  readonly sampleRate = 48000;

  readonly currentTime = 0;
};

const ProcessorBase: WorkletBaseCtor =
  (globalThis as { AudioWorkletProcessor?: WorkletBaseCtor }).AudioWorkletProcessor ?? fallbackBase;

interface NoteOnMessage {
  readonly type: "noteOn" | "damp";
  readonly frequency?: number;
  readonly velocity?: number;
  readonly seed?: number;
  /** Moment sur l'horloge du son : la corde est excitée quand il est atteint. */
  readonly at?: number;
}

interface PendingNote {
  readonly frequency: number;
  readonly velocity: number;
  readonly seed: number;
  readonly at: number;
}

/** Le processeur : une corde, ses trois réglages, ses notes datées. */
export class PluckProcessor extends ProcessorBase {
  /** Les réglages continus sont des `AudioParam` : ils se rampent (§7.9 règle 1). */
  static readonly parameterDescriptors = [
    { name: "frequency", defaultValue: 220, minValue: 20, maxValue: 8000, automationRate: "a-rate" as const },
    { name: "decay", defaultValue: 0.996, minValue: 0.5, maxValue: 0.99999, automationRate: "k-rate" as const },
    { name: "brightness", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" as const },
  ];

  private readonly string: PluckString;

  private pending: PendingNote | null;

  constructor(options?: { processorOptions?: NoteOnMessage }) {
    super(options);
    const start = options?.processorOptions;
    this.string = new PluckString({
      sampleRate: this.sampleRate,
      decay: 0.996,
      brightness: 0.5,
    });
    this.pending = null;
    this.port.onmessage = (event: MessageEvent<NoteOnMessage>) => this.onMessage(event.data);
    if (start !== undefined && start.type === "noteOn") this.onMessage(start);
  }

  private onMessage(message: NoteOnMessage): void {
    if (message.type === "damp") {
      this.string.damp();
      this.pending = null;
      return;
    }
    this.pending = {
      frequency: message.frequency ?? 220,
      velocity: message.velocity ?? 0.8,
      seed: message.seed ?? 1,
      at: message.at ?? this.currentTime,
    };
  }

  process(
    _inputs: readonly Float32Array[][],
    outputs: Float32Array[][],
    parameters: Readonly<Record<string, Float32Array>>,
  ): boolean {
    const out = outputs[0]?.[0];
    if (out === undefined) return true;
    this.triggerIfDue();
    const frequency = parameters.frequency;
    const decay = parameters.decay;
    const brightness = parameters.brightness;
    for (let i = 0; i < out.length; i += 1) {
      this.applyParams(frequency, decay, brightness, i);
      out[i] = this.string.next();
    }
    return true;
  }

  /** Une note datée sur l'horloge du son : la corde part quand le moment arrive. */
  private triggerIfDue(): void {
    const note = this.pending;
    if (note === null) return;
    if (note.at > this.currentTime + 128 / this.sampleRate) return;
    this.string.pluck(note.frequency, note.velocity, note.seed);
    this.pending = null;
  }

  private applyParams(
    frequency: Float32Array | undefined,
    decay: Float32Array | undefined,
    brightness: Float32Array | undefined,
    i: number,
  ): void {
    const hz = at(frequency, i);
    if (hz !== null && hz > 0) this.string.setFrequency(hz);
    const d = at(decay, 0);
    if (d !== null) this.string.setDecay(d);
    const b = at(brightness, 0);
    if (b !== null) this.string.setBrightness(b);
  }
}

/** Un réglage k-rate n'a qu'une valeur ; un réglage a-rate en a une par échantillon. */
function at(param: Float32Array | undefined, i: number): number | null {
  if (param === undefined) return null;
  const value = param.length > 1 ? param[i] : param[0];
  return value === undefined ? null : value;
}

const register = (globalThis as { registerProcessor?: (name: string, ctor: unknown) => void }).registerProcessor;
if (register !== undefined) register(PLUCK_PROCESSOR_NAME, PluckProcessor);

export { PLUCK_PROCESSOR_NAME };
