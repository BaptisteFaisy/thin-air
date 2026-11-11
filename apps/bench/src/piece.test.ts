/**
 * La pièce de démonstration : structure de la session, rendu hors ligne,
 * nombres mesurés, déterminisme. Aucun son émis (AIR-N-02) : tout se lit
 * dans des tableaux d'échantillons et des listes d'événements.
 */
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Session } from "@thin-air/core";
import { SAMPLE_RATE, loopEventsAt, sessionLoopSeconds } from "@thin-air/core";
import { samplesForDuration } from "@thin-air/audio";

import type { Writers } from "./commands.js";
import {
  PIECE_SESSION,
  layerEvents,
  main,
  readInstrumentDirectory,
  readSessionFile,
  renderPiece,
} from "./piece.js";

/** Ré mineur harmonique (cahier §7.7) : ré, mi, fa, sol, la, si♭, do♯. */
const HARMONIQUE_RE = new Set([2, 4, 5, 7, 9, 10, 1]);

const session = readSessionFile(PIECE_SESSION);
const instruments = readInstrumentDirectory();

function ecrivain(): { writers: Writers; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { writers: { out: (t) => stdout.push(t), err: (t) => stderr.push(t) }, stdout, stderr };
}

describe("la session de la pièce", () => {
  it("est valide et calée sur la boucle du §7.10", () => {
    expect(session.format).toBe("thin-air-session/1");
    expect(session.tempo).toBe(90);
    expect(session.bars).toBe(4);
    expect(session.beatsPerBar).toBe(4);
    expect(session.layers.length).toBeGreaterThanOrEqual(3);
    expect(session.layers.length).toBeLessThanOrEqual(4);
    const ids = session.layers.map((couche) => couche.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nomme ses couches d'après des instruments du dépôt", () => {
    for (const couche of session.layers) {
      expect(instruments.parNom.has(couche.instrument), couche.instrument).toBe(true);
      expect(couche.muted).toBe(false);
      expect(couche.events.length).toBeGreaterThan(0);
    }
  });

  it("tient dans la boucle et dans la gamme de saison", () => {
    const longueur = sessionLoopSeconds(session);
    for (const couche of session.layers) {
      for (const evenement of couche.events) {
        expect(evenement.t).toBeGreaterThanOrEqual(0);
        expect(evenement.t).toBeLessThan(longueur);
        if (evenement.type === "noteOn") {
          expect(HARMONIQUE_RE.has(evenement.midi % 12), `midi ${evenement.midi}`).toBe(true);
        }
        if (evenement.type === "control" && evenement.param === "pitch") {
          expect(HARMONIQUE_RE.has(evenement.value % 12), `pitch ${evenement.value}`).toBe(true);
        }
      }
    }
  });

  it("vaut exactement 512 000 échantillons par tour (recette §18)", () => {
    expect(samplesForDuration(sessionLoopSeconds(session), SAMPLE_RATE)).toBe(512_000);
  });
});

describe("le déroulé de la boucle", () => {
  it("passe par loopEventsAt, couche par couche", () => {
    const couche = session.layers[0]!;
    const duree = 2 * sessionLoopSeconds(session);
    const viaPiece = layerEvents(session, couche, duree);
    const viaCore = loopEventsAt({ ...session, layers: [couche] }, 0, duree);
    expect(viaPiece).toEqual(viaCore);
    const attaques = viaPiece.filter((e) => e.type === "noteOn").length;
    expect(attaques).toBe(2 * couche.events.filter((e) => e.type === "noteOn").length);
  });
});

describe("le rendu hors ligne", () => {
  const rapide = { tours: 1, sampleRate: 8_000 } as const;

  it("produit la durée exacte et une crête sous le plafond", () => {
    const rendu = renderPiece(session, instruments, rapide);
    const attendu = samplesForDuration(sessionLoopSeconds(session), 8_000);
    expect(rendu.samples.length).toBe(attendu);
    expect(rendu.peakDb).toBeLessThanOrEqual(rendu.ceilingDb);
    expect(rendu.ceilingDb).toBe(-1);
    expect(rendu.peakDb).toBeGreaterThan(-60); // il y a de la musique, pas du silence
    expect(rendu.voicesTotal).toBeGreaterThan(0);
    expect(rendu.voicesTotal).toBeLessThanOrEqual(session.settings.maxVoices * rendu.layers.length);
  });

  it("compte les notes déroulées : 2 tours = 2 fois les notes d'un tour", () => {
    const unTour = renderPiece(session, instruments, rapide);
    const deuxTours = renderPiece(session, instruments, { tours: 2, sampleRate: 8_000 });
    expect(deuxTours.layers.map((c) => c.notes)).toEqual(unTour.layers.map((c) => c.notes * 2));
    expect(unTour.layers.every((c) => c.notes > 0)).toBe(true);
  });

  it("est déterministe au bit près (AIR-N-09)", () => {
    const premier = renderPiece(session, instruments, rapide);
    const second = renderPiece(session, instruments, rapide);
    const a = Buffer.from(premier.samples.buffer, premier.samples.byteOffset, premier.samples.byteLength);
    const b = Buffer.from(second.samples.buffer, second.samples.byteOffset, second.samples.byteLength);
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it("refuse une couche dont l'instrument n'existe pas", () => {
    const mauvaise: Session = {
      ...session,
      layers: [{ id: 99, instrument: "Inconnu", events: [], muted: false }],
    };
    expect(() => renderPiece(mauvaise, instruments, rapide)).toThrow(/introuvable/);
  });
});

describe("la commande", () => {
  it("--help rend 0 et imprime l'usage", () => {
    const { writers, stdout } = ecrivain();
    expect(main(["--help"], writers)).toBe(0);
    expect(stdout.join("\n")).toContain("piece");
  });

  it("--no-wav imprime les nombres réels sans écrire de fichier", () => {
    const { writers, stdout } = ecrivain();
    const code = main(["--tours", "1", "--no-wav"], writers);
    const texte = stdout.join("\n");
    expect(code).toBe(0);
    expect(texte).toContain("512000 échantillons");
    expect(texte).toContain("crête");
    expect(texte).toContain("conforme");
    expect(texte).toContain("notes par couche");
    for (const couche of session.layers) expect(texte).toContain(couche.instrument);
    expect(texte).toContain("AIR-N-02");
  });

  it("écrit un WAV 16 bits mono dans un dossier ignoré", () => {
    const dossier = mkdtempSync(join(tmpdir(), "piece-"));
    const chemin = join(dossier, "piece.wav");
    const { writers, stdout } = ecrivain();
    const code = main(["--tours", "1", "--out", chemin], writers);
    expect(code).toBe(0);
    const octets = readFileSync(chemin);
    expect(octets.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(octets.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(octets.length).toBe(44 + 2 * 512_000);
    expect(statSync(chemin).size).toBe(octets.length);
    expect(stdout.join("\n")).toContain(chemin);
  });

  it("une session illisible est une erreur d'usage (code 2)", () => {
    const { writers } = ecrivain();
    expect(main(["--session", "takes/pieces/introuvable.json", "--no-wav"], writers)).toBe(2);
  });
});
