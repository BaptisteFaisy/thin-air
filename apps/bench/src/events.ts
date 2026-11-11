/** `bench events --take <prise> --instrument <fichier>` — tourne dans Node. */
import type { Instrument, MusicEvent, Settings, Take } from "@thin-air/core";
import { todo } from "@thin-air/core/internal";

export interface EventsOptions {
  readonly settings?: Partial<Settings>;
  readonly oneHand?: boolean;
  readonly hold?: boolean;
}

export function eventsOf(take: Take, instrument: Instrument, options?: EventsOptions): readonly MusicEvent[] {
  void take; void instrument; void options;
  return todo("bench.eventsOf", "A4");
}

export function formatEvents(events: readonly MusicEvent[]): string {
  void events;
  return todo("bench.formatEvents", "A4");
}
