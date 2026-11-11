/**
 * Corde pincée : le calcul partagé par le module audio (cahier §7.9).
 *
 * Karplus-Strong : une ligne à retard bouclée dont la longueur fixe la note
 * (326,9 échantillons pour ré 146,83 Hz à 48 kHz). Retard fractionnaire par
 * interpolation linéaire, pour que la hauteur puisse glisser sans reconstruire
 * la ligne.
 *
 * TODO(raccordement lot A5) : `dsp/engines.ts` expose `pluckDelayLength`,
 * `pluckExcitation` et `makeNoise` pour le rendu hors ligne. Ce fichier garde
 * le même algorithme, écrit pour tourner dans un `AudioWorkletProcessor`
 * (échantillon par échantillon, état persistant) ; dès que le lot A5 est mergé,
 * les deux doivent partager une seule implémentation — soit `dsp/engines.ts`
 * délègue à `PluckString`, soit `PluckString` appelle `pluckExcitation` et
 * `makeNoise`. Aucune formule ne doit diverger entre les deux faces.
 *
 * Déterminisme (AIR-N-09) : le bruit d'excitation vient d'un générateur à
 * graine, jamais d'un aléa non reproductible.
 */

/** Nom sous lequel le module de corde s'enregistre auprès du contexte. */
export const PLUCK_PROCESSOR_NAME = "thin-air-pluck";

/** Générateur pseudo-aléatoire déterministe (mulberry32) : mêmes suites à chaque run. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Longueur de la ligne à retard, en échantillons (fractionnaire). */
export function pluckDelaySamples(freqHz: number, sampleRate: number): number {
  const freq = Math.max(freqHz, 1);
  return Math.max(2, sampleRate / freq);
}

/** Bruit d'excitation de la corde, déterministe pour une graine donnée. */
export function pluckExcitation(length: number, seed: number, velocity: number): Float32Array {
  const n = Math.max(0, Math.floor(length));
  const out = new Float32Array(n);
  const random = seededRandom(seed);
  const amp = Math.min(Math.max(velocity, 0), 1);
  for (let i = 0; i < n; i += 1) out[i] = (random() * 2 - 1) * amp;
  return out;
}

export interface PluckStringOptions {
  readonly sampleRate: number;
  /** Longueur maximale de la ligne, en échantillons (borne la note la plus grave). */
  readonly maxLength?: number;
  /** Coefficient de la ligne à retard, 0,996 par défaut (§7.9). */
  readonly decay?: number;
  /** 0..1 : mélange du filtre passe-bas de brillance. */
  readonly brightness?: number;
}

/**
 * Une corde : état persistant, un échantillon rendu à la fois. C'est ce que le
 * module audio appelle dans `process()`, et ce que les tests appellent dans
 * Node pour vérifier la longueur, le decay et le filtre.
 */
export class PluckString {
  private readonly buffer: Float32Array;

  private readonly sampleRate: number;

  private write = 0;

  private delay: number;

  private decay: number;

  private brightness: number;

  private last = 0;

  private ringing = false;

  constructor(options: PluckStringOptions) {
    this.sampleRate = options.sampleRate;
    this.buffer = new Float32Array(Math.max(64, Math.floor(options.maxLength ?? 4096)));
    this.delay = 2;
    this.decay = options.decay ?? 0.996;
    this.brightness = options.brightness ?? 0.5;
  }

  get isRinging(): boolean {
    return this.ringing;
  }

  get delaySamples(): number {
    return this.delay;
  }

  /** Pincement : la ligne est remplie du bruit d'excitation de la graine donnée. */
  pluck(freqHz: number, velocity: number, seed: number): void {
    this.setFrequency(freqHz);
    const length = Math.min(Math.floor(this.delay), this.buffer.length);
    const noise = pluckExcitation(length, seed, velocity);
    for (let i = 0; i < length; i += 1) {
      this.buffer[(this.write + i) % this.buffer.length] = noise[i] ?? 0;
    }
    this.write = (this.write + length) % this.buffer.length;
    this.last = 0;
    this.ringing = length > 0 && velocity > 0;
  }

  setFrequency(freqHz: number): void {
    const delay = pluckDelaySamples(freqHz, this.sampleRate);
    this.delay = Math.min(delay, this.buffer.length - 1);
  }

  setDecay(decay: number): void {
    this.decay = Math.min(Math.max(decay, 0), 0.99999);
  }

  setBrightness(brightness: number): void {
    this.brightness = Math.min(Math.max(brightness, 0), 1);
  }

  /** Étouffement : le relâchement coupe la réinjection, la corde s'éteint. */
  damp(): void {
    this.ringing = false;
    this.decay = 0;
  }

  /** Un échantillon : lecture interpolée, puis réinjection filtrée et atténuée. */
  next(): number {
    if (!this.ringing) return 0;
    const size = this.buffer.length;
    const readPos = this.write - this.delay;
    const i0 = ((Math.floor(readPos) % size) + size) % size;
    const i1 = (i0 + 1) % size;
    const frac = readPos - Math.floor(readPos);
    const a = this.buffer[i0] ?? 0;
    const b = this.buffer[i1] ?? 0;
    const out = a + (b - a) * frac;
    const filtered = (1 - this.brightness) * this.last + this.brightness * out;
    this.last = filtered;
    this.buffer[this.write] = filtered * this.decay;
    this.write = (this.write + 1) % size;
    if (Math.abs(out) < 1e-6 && Math.abs(filtered) < 1e-6) this.ringing = false;
    return out;
  }

  /** Rend `count` échantillons dans `out` à partir de `offset`. */
  render(out: Float32Array, offset: number, count: number): void {
    for (let i = 0; i < count; i += 1) out[offset + i] = this.next();
  }
}
