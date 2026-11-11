/**
 * Règle 3 de §7.9 : les voix sont bornées et toujours relâchées.
 *
 * Huit voix au plus (`settings.maxVoices`) ; au-delà, la plus ancienne est
 * reprise. Si aucune image n'a été analysée depuis `settings.stallReleaseMs`
 * (onglet masqué, caméra figée), TOUTES les voix sont relâchées.
 *
 * Logique pure : le graphe Web Audio est prévenu par les crochets, ce qui rend
 * le bornage et l'extinction testables dans Node, sans `AudioContext`
 * (AIR-F-27, AIR-P-10).
 *
 * Le bornage côté événements vit dans `core/voices.ts` (lot A3) : ici c'est le
 * bornage côté nœuds Web Audio, pour qu'aucune voix ne reste allumée quoi que
 * fasse le producteur d'événements.
 */

export interface LiveVoicePoolHooks {
  /** La plus ancienne voix est reprise pour en laisser sonner une nouvelle. */
  readonly onSteal?: (id: string) => void;
  /** Relâchement : fondu de `releaseS`, jamais une coupure (AIR-F-24). */
  readonly onRelease?: (id: string, releaseS: number) => void;
}

export interface LiveVoicePoolOptions {
  readonly maxVoices: number;
  readonly stallReleaseMs: number;
  /** Durée du fondu de relâchement, en secondes. */
  readonly releaseS: number;
  readonly hooks?: LiveVoicePoolHooks;
}

interface VoiceEntry {
  readonly id: string;
  readonly startedAt: number;
}

export class LiveVoicePool {
  /** De la plus ancienne à la plus récente. */
  private readonly entries: VoiceEntry[] = [];

  private readonly hooks: LiveVoicePoolHooks;

  private maxVoices: number;

  private stallReleaseMs: number;

  private releaseS: number;

  private lastFrameAt: number | null = null;

  constructor(options: LiveVoicePoolOptions) {
    this.hooks = options.hooks ?? {};
    this.maxVoices = Math.max(1, Math.floor(options.maxVoices));
    this.stallReleaseMs = Math.max(0, options.stallReleaseMs);
    this.releaseS = Math.max(options.releaseS, 1e-3);
  }

  /** Une image vient d'être analysée : l'horloge du gel repart de zéro. */
  noteFrame(at: number): void {
    if (Number.isFinite(at)) this.lastFrameAt = at;
  }

  /** Dernière image analysée, ou `null` si aucune ne l'a encore été. */
  get lastFrameAtOr(): number | null {
    return this.lastFrameAt;
  }

  get size(): number {
    return this.entries.length;
  }

  get ids(): readonly string[] {
    return this.entries.map((entry) => entry.id);
  }

  get releaseSeconds(): number {
    return this.releaseS;
  }

  setLimits(maxVoices: number, stallReleaseMs: number): void {
    this.maxVoices = Math.max(1, Math.floor(maxVoices));
    this.stallReleaseMs = Math.max(0, stallReleaseMs);
    while (this.entries.length > this.maxVoices) this.stealOldest();
  }

  setReleaseSeconds(releaseS: number): void {
    this.releaseS = Math.max(releaseS, 1e-3);
  }

  /** Une voix commence à sonner ; au-delà de la borne, la plus ancienne est reprise. */
  start(id: string, at: number): void {
    if (this.includes(id)) this.remove(id, false);
    while (this.entries.length >= this.maxVoices) this.stealOldest();
    this.entries.push({ id, startedAt: Number.isFinite(at) ? at : 0 });
  }

  /** Relâche une voix précise (fin de note), en fondu. */
  release(id: string): void {
    this.remove(id, true);
  }

  /** Relâchement général : toutes les voix, en fondu, sans claquement. */
  releaseAll(): void {
    while (this.entries.length > 0) {
      const entry = this.entries.shift();
      if (entry === undefined) break;
      this.hooks.onRelease?.(entry.id, this.releaseS);
    }
  }

  /**
   * Vérification du gel : si aucune image n'a été analysée depuis
   * `stallReleaseMs`, toutes les voix sont relâchées (règle 3 de §7.9).
   * Rend `true` quand un relâchement a eu lieu.
   */
  checkStall(at: number): boolean {
    if (this.lastFrameAt === null || this.entries.length === 0) return false;
    if (at - this.lastFrameAt <= this.stallReleaseMs / 1000) return false;
    this.releaseAll();
    return true;
  }

  private stealOldest(): void {
    const oldest = this.entries.shift();
    if (oldest === undefined) return;
    this.hooks.onSteal?.(oldest.id);
  }

  private includes(id: string): boolean {
    return this.entries.some((entry) => entry.id === id);
  }

  private remove(id: string, notify: boolean): void {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    this.entries.splice(index, 1);
    if (notify) this.hooks.onRelease?.(id, this.releaseS);
  }
}
