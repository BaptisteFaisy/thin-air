/**
 * Attribution des voix (cahier §7.9, règle 3) : huit au plus, la plus ancienne
 * est reprise, tout est toujours relâché. Propriétés : AIR-P-09, 10.
 *
 * Le réservoir ne connaît ni le son ni l'horloge : il tient la liste des voix
 * actives et rend les événements qu'il faut pour la faire respecter. C'est lui
 * qui garantit qu'on ne superpose jamais plus de `maxVoices` voix (AIR-F-27) et
 * que tout `noteOn` a son `noteOff`.
 */
import type { MusicEvent } from "./types.js";

export interface VoiceSlot {
  readonly id: string;
  readonly startedAt: number;
  midi: number;
  active: boolean;
}

/** Nombre de voix réellement utilisable : au moins une, jamais zéro. */
function usableVoices(maxVoices: number): number {
  if (!Number.isFinite(maxVoices)) return 1;
  return Math.max(1, Math.floor(maxVoices));
}

export class VoicePool {
  private readonly slots: VoiceSlot[] = [];

  constructor(readonly maxVoices: number) {}

  /**
   * Une note demandée : rend l'événement de reprise si la voix la plus
   * ancienne doit être libérée d'abord.
   *
   * L'ordre des événements rendus est celui de l'écoute : les `noteOff` de
   * reprise précèdent toujours le `noteOn`, si bien qu'un rendu ne compte
   * jamais plus de `maxVoices` voix à la fois (AIR-P-10). Redemander une voix
   * déjà active la relance : son `noteOff` part avant le nouveau `noteOn`,
   * pour que les paires restent appariées.
   */
  noteOn(t: number, id: string, midi: number, velocity: number): readonly MusicEvent[] {
    const events: MusicEvent[] = [];
    const existing = this.find(id);
    if (existing) events.push(...this.release(t, existing));

    while (this.activeCount >= this.limit()) {
      const oldest = this.oldestActive();
      if (!oldest) break;
      events.push(...this.release(t, oldest));
    }
    this.compact();

    this.slots.push({ id, startedAt: t, midi, active: true });
    events.push({ type: "noteOn", t, voice: id, midi, velocity });
    return events;
  }

  /** Fin de note : silencieux si la voix n'est pas active. */
  noteOff(t: number, id: string): readonly MusicEvent[] {
    const slot = this.find(id);
    if (!slot || !slot.active) return [];
    const events = this.release(t, slot);
    this.compact();
    return events;
  }

  /** Relâchement général : onglet masqué, plus d'image, fin de prise. */
  releaseAll(t: number): readonly MusicEvent[] {
    const events: MusicEvent[] = [];
    for (const slot of this.activeSlots) events.push(...this.release(t, slot));
    this.compact();
    return events;
  }

  get activeCount(): number {
    let compte = 0;
    for (const slot of this.slots) if (slot.active) compte += 1;
    return compte;
  }

  /** Les voix actives, de la plus ancienne à la plus récente. */
  get activeSlots(): readonly VoiceSlot[] {
    return this.slots.filter((slot) => slot.active);
  }

  /** La voix active de cet identifiant ; `undefined` si elle est éteinte. */
  find(id: string): VoiceSlot | undefined {
    return this.slots.find((slot) => slot.id === id && slot.active);
  }

  /** Hauteur d'une voix déjà sonnante (glissé) : ne crée rien. */
  setMidi(id: string, midi: number): void {
    const slot = this.find(id);
    if (slot) slot.midi = midi;
  }

  /** Le nombre de voix que ce réservoir accepte (borne dure). */
  limit(): number {
    return usableVoices(this.maxVoices);
  }

  private release(t: number, slot: VoiceSlot): readonly MusicEvent[] {
    slot.active = false;
    return [{ type: "noteOff", t, voice: slot.id }];
  }

  /** La plus ancienne ; à égalité d'instant, celle entrée en premier. */
  private oldestActive(): VoiceSlot | undefined {
    let oldest: VoiceSlot | undefined;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      if (oldest === undefined || slot.startedAt < oldest.startedAt) oldest = slot;
    }
    return oldest;
  }

  /** Les voix mortes ne servent plus : on garde la liste courte. */
  private compact(): void {
    for (let i = this.slots.length - 1; i >= 0; i -= 1) {
      const slot = this.slots[i];
      if (slot && !slot.active) this.slots.splice(i, 1);
    }
  }
}
