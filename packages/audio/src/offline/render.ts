/**
 * Rendu hors ligne : les échantillons dans un tableau, plus vite que le
 * temps réel, sans haut-parleur ni périphérique audio (cahier §11.6).
 * C'est le moteur unique des tests et de l'export WAV (AIR-F-38).
 *
 * La chaîne est celle du cahier §7.9 : mélange des voix → réverbération →
 * gain général (−12 dB) → plafond (−1 dB). Les voix sont bornées : au-delà de
 * `maxVoices`, la plus ancienne est reprise (AIR-F-27, AIR-P-10).
 */
import type { Instrument, MusicEvent } from "@thin-air/core";
import { DEFAULT_SETTINGS, SAMPLE_RATE } from "@thin-air/core";
import { applyCeiling, applyMasterGain } from "../dsp/limiter.js";
import { createReverb } from "../dsp/reverb.js";
import {
  createVoice,
  defaultVoiceParams,
  strikeVoice,
  type SynthVoice,
  type VoiceParams,
} from "../dsp/voice.js";

export interface RenderOptions {
  readonly instrument: Instrument;
  readonly sampleRate?: number;
  /** Durée forcée ; sinon dernier événement + extinction + 800 ms. */
  readonly durationS?: number;
  readonly masterGainDb?: number;
  readonly ceilingDb?: number;
  readonly reverb?: number;
  readonly maxVoices?: number;
  readonly paramTauMs?: number;
}

export interface RenderResult {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly durationS: number;
  /** Nombre maximal de voix actives simultanément (AIR-P-10). */
  readonly maxVoices: number;
}

/** Une voix en cours dans le rendu. */
interface Slot {
  readonly id: string;
  readonly voice: SynthVoice;
}

/**
 * Le réservoir de voix : huit au plus, la plus ancienne est reprise
 * (règle 3 de §7.9). La reprise coupe la voix reprise : la borne est tenue à
 * tout instant, donc la crête du rendu reste bornée aussi (AIR-P-13).
 */
class Reservoir {
  private slots: Slot[] = [];
  /** Le plus grand nombre de voix actives vu depuis le début du rendu. */
  maxActives = 0;

  constructor(
    private readonly params: VoiceParams,
    private readonly maxVoices: number,
  ) {}

  noteOn(id: string, midi: number, velocity: number, at: number): void {
    const existant = this.chercher(id);
    if (existant) {
      // Même voix, nouvelle note : la hauteur glisse, jamais de saut (§7.9).
      existant.voice.setParam("pitch", midi, at);
      if (this.params.engine === "pluck" || this.params.engine === "drum") {
        strikeVoice(existant.voice, velocity, at);
      }
      return;
    }
    if (this.slots.length >= this.maxVoices) this.slots.shift();
    const voice = createVoice(id, { ...this.params, midi, velocity });
    this.slots.push({ id, voice });
    this.maxActives = Math.max(this.maxActives, this.slots.length);
  }

  noteOff(id: string, at: number): void {
    this.chercher(id)?.voice.noteOff(at);
  }

  control(id: string, param: MusicEvent & { type: "control" }, at: number): void {
    this.chercher(id)?.voice.setParam(param.param, param.value, at);
  }

  /** Mélange [from, to) dans le tampon, puis libère les voix finies. */
  rendre(tampon: Float32Array, from: number, to: number): void {
    for (const slot of this.slots) slot.voice.render(tampon, from, to);
    this.slots = this.slots.filter((slot) => !slot.voice.done);
  }

  private chercher(id: string): Slot | undefined {
    return this.slots.find((slot) => slot.id === id);
  }
}

/** Les réglages d'un moteur, précisés par le fichier d'instrument. */
function voiceParamsFor(
  instrument: Instrument,
  sampleRate: number,
  paramTauMs: number | undefined,
): VoiceParams {
  const base = defaultVoiceParams(instrument.sound.engine, sampleRate);
  const son = instrument.sound;
  const secondes = (ms: number | undefined, defautS: number): number =>
    ms === undefined ? defautS : ms / 1000;
  return {
    ...base,
    wave: son.wave ?? base.wave,
    second: son.second ?? base.second,
    attackS: secondes(son.attackMs, base.attackS),
    releaseS: secondes(son.releaseMs, base.releaseS),
    glideS: secondes(son.glideMs, base.glideS),
    decay: son.decay ?? base.decay,
    detuneCents: son.detuneCents ?? base.detuneCents,
    fmRatio: son.fmRatio ?? base.fmRatio,
    fmIndex: son.fmIndex ?? base.fmIndex,
    noiseMs: son.noiseMs ?? base.noiseMs,
    toneHz: son.toneHz ?? base.toneHz,
    paramTauS: secondes(paramTauMs, base.paramTauS),
  };
}

/** Réverbération, gain général, plafond : dans cet ordre (§7.9). */
function appliquerChaine(
  tampon: Float32Array,
  options: RenderOptions,
  sampleRate: number,
): Float32Array {
  const reverb = Math.max(0, Math.min(1, options.reverb ?? DEFAULT_SETTINGS.reverb));
  let sortie = tampon;
  if (reverb > 0) {
    const humide = new Float32Array(tampon.length);
    createReverb({ sampleRate, amount: reverb }).process(tampon, humide);
    sortie = humide;
  }
  applyMasterGain(sortie, options.masterGainDb ?? DEFAULT_SETTINGS.masterGainDb);
  applyCeiling(sortie, options.ceilingDb ?? DEFAULT_SETTINGS.ceilingDb);
  return sortie;
}

export function renderEvents(events: readonly MusicEvent[], options: RenderOptions): RenderResult {
  const sampleRate = options.sampleRate ?? SAMPLE_RATE;
  const params = voiceParamsFor(options.instrument, sampleRate, options.paramTauMs);
  const tries = [...events].sort((a, b) => a.t - b.t);
  const dernierT = tries.reduce((max, e) => Math.max(max, e.t), 0);
  const durationS = options.durationS ?? dernierT + params.releaseS + 0.8;
  const total = samplesForDuration(durationS, sampleRate);
  const tampon = new Float32Array(total);
  const reservoir = new Reservoir(params, Math.max(1, options.maxVoices ?? DEFAULT_SETTINGS.maxVoices));

  let curseur = 0;
  for (const evenement of tries) {
    const at = Math.min(total, Math.max(0, Math.round(evenement.t * sampleRate)));
    if (at < curseur) continue; // un événement daté dans le passé est ignoré
    reservoir.rendre(tampon, curseur, at);
    curseur = at;
    if (evenement.type === "noteOn") {
      reservoir.noteOn(evenement.voice, evenement.midi, evenement.velocity, at);
    } else if (evenement.type === "noteOff") {
      reservoir.noteOff(evenement.voice, at);
    } else {
      reservoir.control(evenement.voice, evenement, at);
    }
  }
  reservoir.rendre(tampon, curseur, total);

  const sortie = appliquerChaine(tampon, options, sampleRate);
  return { samples: sortie, sampleRate, durationS: total / sampleRate, maxVoices: reservoir.maxActives };
}

/** Échantillons attendus pour une boucle : exact, pas arrondi (AIR-P-17). */
export function samplesForDuration(durationS: number, sampleRate: number): number {
  if (!(durationS > 0)) return 0;
  return Math.round(durationS * sampleRate);
}
