/**
 * Le fichier de session (cahier §7.10, §11.5, AIR-F-43) : ce qui est écrit se
 * relit, ce qui rompt une règle est refusé EN ENTIER avec ses raisons, et la
 * boucle relue garde ses couches. Aucun son, aucune requête : du pur.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type LoopLayer, type Session } from "@thin-air/core";
import { emptyLoop, type LoopState } from "./loopState.js";
import { decodeSession, encodeSession, loopFromSession, sessionFromLoop } from "./sessionFile.js";

function couche(id: number, muted = false): LoopLayer {
  return { id, instrument: "Harp", events: [], muted };
}

function boucle(): LoopState {
  return { ...emptyLoop(DEFAULT_SETTINGS), layers: [couche(1), couche(3)], nextLayerId: 4 };
}

function session(layers: readonly LoopLayer[] = boucle().layers): Session {
  return { ...sessionFromLoop(boucle(), DEFAULT_SETTINGS), layers };
}

describe("fichier de session (§7.10, AIR-F-43)", () => {
  it("ce qui est écrit se relit à l'identique", () => {
    const ecrit = encodeSession(session());
    const lu = decodeSession(ecrit);
    expect(lu.reasons).toEqual([]);
    expect(lu.session?.format).toBe("thin-air-session/1");
    expect(lu.session?.layers.map((couche) => couche.id)).toEqual([1, 3]);
  });

  it("un fichier illisible rend sa raison, jamais une moitié de boucle", () => {
    const lu = decodeSession("{ pas du JSON");
    expect(lu.session).toBeNull();
    expect(lu.reasons.length).toBeGreaterThan(0);
  });

  it("une règle rompue refuse le fichier entier, avec ses raisons", () => {
    const lu = decodeSession(encodeSession(session([couche(2), couche(2)])));
    expect(lu.session).toBeNull();
    expect(lu.reasons.join(" ; ")).toContain("twice");
  });

  it("la boucle relue garde ses couches, son tempo et ses mesures", () => {
    const relue = loopFromSession(session());
    expect(relue.layers.length).toBe(2);
    expect(relue.tempo).toBe(DEFAULT_SETTINGS.tempo);
    expect(relue.bars).toBe(boucle().bars);
    expect(relue.recording).toBe(false);
  });

  it("l'identifiant suivant dépasse ceux du fichier : rien n'est écrasé", () => {
    expect(loopFromSession(session()).nextLayerId).toBe(4);
  });

  it("les couches coupées ne partent pas dans le fichier", () => {
    const avecMuet = sessionFromLoop({ ...boucle(), layers: [couche(1), couche(2, true)] }, DEFAULT_SETTINGS);
    expect(avecMuet.layers.map((couche) => couche.id)).toEqual([1]);
  });
});
