/**
 * Une voix : enveloppe, hauteur, réglages continus datés.
 *
 * Règle 1 de la couture (§7.9) : on ne fixe jamais directement un réglage
 * pendant qu'une voix sonne. Tout réglage daté passe par une rampe interne de
 * τ = `paramTauS` (20 ms), et un changement de note passe en plus par un
 * glissement linéaire de `glideS` (30 ms pour le thérémine). Sans cela la
 * hauteur avance par marches, trente fois par seconde, et le son grésille
 * (AIR-F-26, AIR-P-16).
 *
 * La voix rend ses échantillons dans un tampon : `render(out, from, to)`
 * additionne [from, to) dans `out`. Aucun périphérique audio n'est ouvert
 * (AIR-N-02) : c'est du calcul sur des `Float32Array`, reproductible au bit
 * près (AIR-N-09).
 */
import type { SoundEngine } from "@thin-air/core";
import { createEngine, type Engine, type EngineContext } from "./engine.js";
import type { Wave } from "./engines.js";
import { midiToHz } from "./tuning.js";

export type ControlParam = "pitch" | "gain" | "cutoff" | "vibrato";

export interface VoiceParams {
  readonly engine: SoundEngine;
  readonly sampleRate: number;
  readonly midi: number;
  readonly velocity: number;
  readonly attackS: number;
  readonly releaseS: number;
  readonly glideS: number;
  readonly wave: "sine" | "triangle" | "sawtooth" | "square";
  /** Amplitude de l'harmonique 2. */
  readonly second: number;
  readonly vibratoHz: number;
  readonly vibratoCents: number;
  readonly detuneCents: number;
  /** Corde pincée : 0,996 par défaut. */
  readonly decay: number;
  /** 0..1 : mélange du filtre de la ligne à retard. */
  readonly brightness: number;
  /** Cloches : rapport et indice de modulation. */
  readonly fmRatio: number;
  readonly fmIndex: number;
  /** Percussions : durée du bruit, hauteur du corps. */
  readonly noiseMs: number;
  readonly toneHz: number;
  /** τ des rampes internes, secondes (0,02). */
  readonly paramTauS: number;
  readonly seed: number;
}

export interface SynthVoice {
  readonly id: string;
  /** Un réglage daté, en échantillons depuis le début du rendu. */
  setParam(param: ControlParam, value: number, atSample: number): void;
  noteOff(atSample: number): void;
  /** Rend [from, to) dans `out` (mono, additionné). */
  render(out: Float32Array, from: number, to: number): void;
  /** Plus aucun échantillon à produire. */
  readonly done: boolean;
  readonly peak: number;
}

/** Un réglage daté, rangé dans la file de la voix. */
interface ParamEvent {
  readonly param: ControlParam;
  readonly value: number;
  readonly atSample: number;
}

class VoiceImpl implements SynthVoice {
  private readonly engine: Engine;
  private readonly sampleRate: number;
  private readonly attackSamples: number;
  private readonly releaseSamples: number;
  private readonly glideSamples: number;
  private readonly alpha: number;
  private readonly file: ParamEvent[] = [];

  /** Cibles (après glissement) et valeurs lissées. */
  private cibleHz: number;
  private freqHz: number;
  private gain = 1;
  private cutoffHz = 20_000;
  private vibratoCents: number;

  private glisseDe = 0;
  private glisseVers = 0;
  private glisseDepart = 0;
  private enGlisse = false;

  private debutSample = -1;
  private releaseSample = -1;
  private termine = false;
  private crete = 0;
  private phaseVibrato = 0;

  constructor(readonly id: string, private readonly params: VoiceParams) {
    this.engine = createEngine(params);
    this.sampleRate = params.sampleRate;
    this.attackSamples = Math.max(1, params.attackS * params.sampleRate);
    this.releaseSamples = Math.max(1, params.releaseS * params.sampleRate);
    this.glideSamples = Math.max(0, params.glideS * params.sampleRate);
    this.alpha = 1 - Math.exp(-1 / Math.max(1e-6, params.paramTauS * params.sampleRate));
    this.cibleHz = midiToHz(params.midi);
    this.freqHz = this.cibleHz;
    this.vibratoCents = params.vibratoCents;
  }

  setParam(param: ControlParam, value: number, atSample: number): void {
    this.file.push({ param, value, atSample });
    this.file.sort((a, b) => a.atSample - b.atSample);
  }

  noteOff(atSample: number): void {
    if (this.releaseSample < 0) this.releaseSample = atSample;
  }

  /** Une nouvelle frappe sur une voix qui sonne déjà (corde rejouée). */
  strike(velocity: number, atSample: number): void {
    this.debutSample = atSample;
    this.releaseSample = -1;
    this.termine = false;
    this.freqHz = this.cibleHz;
    this.engine.strike(velocity);
  }

  render(out: Float32Array, from: number, to: number): void {
    if (this.termine) return;
    if (this.debutSample < 0) this.demarrer(from, this.params.velocity);
    for (let n = from; n < to; n++) {
      this.positionCourante = n;
      this.appliquerFile(n);
      this.lisser();
      const enveloppe = this.enveloppe(n);
      if (enveloppe <= 0 && this.releaseSample >= 0) {
        this.termine = true;
        return;
      }
      this.ajouter(out, n, enveloppe);
    }
  }

  get done(): boolean {
    return this.termine;
  }

  get peak(): number {
    return this.crete;
  }

  private demarrer(atSample: number, velocity: number): void {
    this.debutSample = atSample;
    this.freqHz = this.cibleHz;
    this.engine.strike(velocity);
  }

  private contexte(n: number): EngineContext {
    // Le vibrato est une modulation de hauteur en centièmes, à `vibratoHz`.
    const incrementLfo = this.params.vibratoHz / this.sampleRate;
    this.phaseVibrato += incrementLfo;
    if (this.phaseVibrato >= 1) this.phaseVibrato -= Math.floor(this.phaseVibrato);
    const modulation = Math.sin(2 * Math.PI * this.phaseVibrato) * this.vibratoCents;
    return {
      freqHz: this.freqHz * 2 ** (modulation / 1200),
      cutoffHz: this.cutoffHz,
      timeS: (n - this.debutSample) / this.sampleRate,
    };
  }

  /** Les réglages dont l'instant est atteint entrent en cible (pas en valeur). */
  private appliquerFile(n: number): void {
    while (this.file.length > 0 && (this.file[0]?.atSample ?? Infinity) <= n) {
      const evenement = this.file.shift();
      if (evenement) this.cibler(evenement);
    }
  }

  private cibler(evenement: ParamEvent): void {
    switch (evenement.param) {
      case "pitch": {
        const cible = midiToHz(evenement.value);
        if (this.glideSamples > 0 && this.debutSample >= 0) {
          this.glisseDe = this.freqHz;
          this.glisseVers = cible;
          this.glisseDepart = Math.max(this.debutSample, evenement.atSample);
          this.enGlisse = true;
        } else {
          this.cibleHz = cible;
        }
        return;
      }
      case "gain":
        this.gainCible = evenement.value;
        return;
      case "cutoff":
        this.cutoffCible = evenement.value;
        return;
      case "vibrato":
        this.vibratoCible = evenement.value;
        return;
    }
  }

  /** Cibles des réglages continus, suivies par la rampe τ. */
  private gainCible = 1;
  private cutoffCible = 20_000;
  private vibratoCible = 0;

  private lisser(): void {
    if (this.enGlisse) {
      const p = (this.positionCourante - this.glisseDepart) / this.glideSamples;
      const borne = Math.max(0, Math.min(1, p));
      this.cibleHz = this.glisseDe + (this.glisseVers - this.glisseDe) * borne;
      if (borne >= 1) this.enGlisse = false;
    }
    this.freqHz += (this.cibleHz - this.freqHz) * this.alpha;
    this.gain += (this.gainCible - this.gain) * this.alpha;
    this.cutoffHz += (this.cutoffCible - this.cutoffHz) * this.alpha;
    this.vibratoCents += (this.vibratoCible - this.vibratoCents) * this.alpha;
  }

  private positionCourante = 0;

  private ajouter(out: Float32Array, n: number, enveloppe: number): void {
    const echantillon =
      this.engine.next(this.contexte(n)) * enveloppe * this.params.velocity * this.gain;
    out[n] = (out[n] ?? 0) + echantillon;
    const absolu = Math.abs(echantillon);
    if (absolu > this.crete) this.crete = absolu;
  }

  private enveloppe(n: number): number {
    const depuis = n - this.debutSample;
    const attaque = Math.max(0, Math.min(1, depuis / this.attackSamples));
    const montee = 0.5 * (1 - Math.cos(Math.PI * attaque));
    if (this.releaseSample < 0) return montee;
    const p = Math.max(0, Math.min(1, (n - this.releaseSample) / this.releaseSamples));
    if (p <= 0) return montee;
    // Extinction en cosinus relevé : elle atteint exactement zéro, donc le
    // silence final est mesurable (AIR-P-15).
    return montee * 0.5 * (1 + Math.cos(Math.PI * p));
  }
}

export function createVoice(id: string, params: VoiceParams): SynthVoice {
  return new VoiceImpl(id, params);
}

/** Une nouvelle frappe sur une voix vivante : corde rejouée, percussions. */
export function strikeVoice(voice: SynthVoice, velocity: number, atSample: number): void {
  if (voice instanceof VoiceImpl) voice.strike(velocity, atSample);
}

/** Valeurs par défaut d'un moteur, pour ne rien avoir à répéter. */
export function defaultVoiceParams(engine: SoundEngine, sampleRate: number): VoiceParams {
  const base: VoiceParams = {
    engine,
    sampleRate,
    midi: 69,
    velocity: 1,
    attackS: 0.06,
    releaseS: 0.15,
    glideS: 0.03,
    wave: "sine",
    second: 0.15,
    vibratoHz: 5.5,
    vibratoCents: 0,
    detuneCents: 0,
    decay: 0.996,
    brightness: 0.5,
    fmRatio: 3,
    fmIndex: 4,
    noiseMs: 80,
    toneHz: 180,
    paramTauS: 0.02,
    seed: 1,
  };
  switch (engine) {
    case "osc":
      return { ...base, attackS: 0.06, releaseS: 0.15, glideS: 0.03 };
    case "pluck":
      return { ...base, attackS: 0.002, releaseS: 0.25, glideS: 0, brightness: 0.5 };
    case "fm":
      return { ...base, attackS: 0.005, releaseS: 0.5, glideS: 0, fmRatio: 3, fmIndex: 4 };
    case "drum":
      return { ...base, attackS: 0.001, releaseS: 0.08, glideS: 0, noiseMs: 80, toneHz: 180 };
  }
}

/** Re-export pratique : la forme d'onde d'un instrument. */
export type { Wave };
