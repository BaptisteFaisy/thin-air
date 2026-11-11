/**
 * La mise en forme des événements : une ligne par événement, triée par instant.
 * `noteName` vient du lot A3 ; il est injecté ici pour tester la ligne seule.
 */
import type { MusicEvent } from "@thin-air/core";
import { describe, expect, it } from "vitest";

import { formatEvents } from "./events.js";

const noms: Record<number, string> = { 55: "G3", 57: "A3", 58: "A#3", 61: "C#4" };
const nom = (midi: number): string => noms[midi] ?? `?${midi}`;

const events: readonly MusicEvent[] = [
  { type: "noteOff", t: 0.139, voice: "pitch-0" },
  { type: "noteOn", t: 0.139, voice: "pitch-0", midi: 57, velocity: 0.42 },
  { type: "noteOn", t: 0, voice: "pitch-0", midi: 55, velocity: 0.4 },
  { type: "control", t: 0.21, voice: "volume-0", param: "gain", value: -12 },
];

describe("formatEvents", () => {
  it("trie par instant croissant", () => {
    const lignes = formatEvents(events, { noteNameOf: nom }).split("\n");
    expect(lignes).toHaveLength(4);
    expect(lignes[0]).toContain("0,000 s");
    expect(lignes[1]).toContain("0,139 s");
    expect(lignes[3]).toContain("0,210 s");
  });

  it("garde l'ordre de production à instant égal (tri stable)", () => {
    const lignes = formatEvents(events, { noteNameOf: nom }).split("\n");
    // Le noteOff est produit avant le noteOn de même instant dans la liste.
    expect(lignes[1]).toContain("noteOff");
    expect(lignes[2]).toContain("noteOn");
  });

  it("écrit une noteOn avec voix, midi, nom et force", () => {
    const ligne = formatEvents([{ type: "noteOn", t: 0.139, voice: "pitch-0", midi: 57, velocity: 0.42 }], {
      noteNameOf: nom,
    });
    expect(ligne).toContain("noteOn");
    expect(ligne).toContain("voice=pitch-0");
    expect(ligne).toContain("midi=57 (A3)");
    expect(ligne).toContain("vel=0,42");
    expect(ligne).toContain("0,139 s");
  });

  it("écrit une noteOff et un control", () => {
    const lignes = formatEvents(events, { noteNameOf: nom }).split("\n");
    expect(lignes[1]).toContain("noteOff  voice=pitch-0");
    expect(lignes[3]).toContain("control");
    expect(lignes[3]).toContain("param=gain");
    expect(lignes[3]).toContain("value=−12,00");
  });

  it("ne plante pas quand le nom de note manque : le midi reste", () => {
    const ligne = formatEvents([{ type: "noteOn", t: 1, voice: "v", midi: 61, velocity: 0.5 }], {
      noteNameOf: () => {
        throw new Error("TODO(music.noteName) — lot A3");
      },
    });
    expect(ligne).toContain("midi=61");
    expect(ligne).not.toContain("(C#4)");
  });

  it("donne une chaîne vide pour une liste vide", () => {
    expect(formatEvents([], { noteNameOf: nom })).toBe("");
  });
});
