/**
 * L'œuvre commandée : le gabarit livré au compositeur, les refus de la
 * commande, et le nombre exact d'échantillons du rendu. Aucun son émis
 * (AIR-N-02) : tout se lit dans des tableaux et des listes d'événements.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MusicEvent, Session } from "@thin-air/core";
import { SAMPLE_RATE, sessionLoopSeconds } from "@thin-air/core";
import { samplesForDuration } from "@thin-air/audio";
import { parseSession } from "@thin-air/schema";

import type { Writers } from "./commands.js";
import { readJsonFile } from "./io.js";
import {
  BARS_AUTORISEES,
  MODELE_SESSION,
  TEMPO_MAX,
  TEMPO_MIN,
  buildOeuvreReport,
  checkCommande,
  defaultTours,
  main,
  oeuvrePaths,
} from "./oeuvre.js";
import { readInstrumentDirectory, readSessionFile, renderPiece } from "./piece.js";

const gabarit = readSessionFile(MODELE_SESSION);
const instruments = readInstrumentDirectory();

/** Un tour de boucle à 48 000 Hz : 4 mesures à 90, soit 512 000 échantillons. */
const ECHANTILLONS_PAR_TOUR = 512_000;

function ecrivain(): { writers: Writers; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { writers: { out: (t) => stdout.push(t), err: (t) => stderr.push(t) }, stdout, stderr };
}

function variante(changes: Partial<Session>): Session {
  return { ...gabarit, ...changes };
}

function couche(id: number, events: readonly MusicEvent[] = [], instrument = "Harp") {
  return { id, instrument, events, muted: false };
}

/** Une raison qui contient le motif : les refus se cumulent, on les cherche. */
function raison(raisons: readonly string[], motif: string): boolean {
  return raisons.some((texte) => texte.includes(motif));
}

function note(t: number, midi: number, voice: string): MusicEvent {
  return { type: "noteOn", t, voice, midi, velocity: 0.5 };
}

describe("le gabarit de commande", () => {
  it("est une session valide selon le schéma", () => {
    const resultat = parseSession(readJsonFile(MODELE_SESSION));
    expect(resultat.ok).toBe(true);
    expect(gabarit.format).toBe("thin-air-session/1");
  });

  it("tient dans la commande : une couche, quatre mesures, tempo jouable", () => {
    expect(checkCommande(gabarit)).toEqual([]);
    expect(gabarit.layers).toHaveLength(1);
    expect(gabarit.bars).toBe(4);
    expect(BARS_AUTORISEES).toContain(gabarit.bars);
    expect(gabarit.tempo).toBeGreaterThanOrEqual(TEMPO_MIN);
    expect(gabarit.tempo).toBeLessThanOrEqual(TEMPO_MAX);
  });

  it("nomme sa couche d'après un instrument du dépôt, avec des événements dans la boucle", () => {
    const longueur = sessionLoopSeconds(gabarit);
    for (const coucheJouee of gabarit.layers) {
      expect(instruments.parNom.has(coucheJouee.instrument), coucheJouee.instrument).toBe(true);
      expect(coucheJouee.events.length).toBeGreaterThan(0);
      for (const evenement of coucheJouee.events) {
        expect(evenement.t).toBeGreaterThanOrEqual(0);
        expect(evenement.t).toBeLessThan(longueur);
      }
    }
  });
});

describe("les refus de la commande", () => {
  it("refuse un tempo hors bornes, dans les deux sens", () => {
    // Un tempo changé change la longueur de la boucle : les raisons se cumulent,
    // on cherche celle qui porte sur le tempo.
    expect(raison(checkCommande(variante({ tempo: TEMPO_MAX + 10 })), `tempo ${TEMPO_MAX + 10}`)).toBe(true);
    expect(raison(checkCommande(variante({ tempo: TEMPO_MIN - 10 })), `tempo ${TEMPO_MIN - 10}`)).toBe(true);
    expect(raison(checkCommande(variante({ tempo: TEMPO_MIN })), "tempo")).toBe(false);
    expect(raison(checkCommande(variante({ tempo: TEMPO_MAX })), "tempo")).toBe(false);
  });

  it("refuse une couche muette, sans événements", () => {
    const raisons = checkCommande(variante({ layers: [couche(1)] }));
    expect(raisons).toHaveLength(1);
    expect(raisons[0]).toContain("aucun événement");
  });

  it("refuse plus de six couches", () => {
    const sept = Array.from({ length: 7 }, (_, index) => couche(index + 1, [note(0, 50, `v${index}`)]));
    expect(parseSession({ ...gabarit, layers: sept }).ok).toBe(false);
    expect(raison(checkCommande(variante({ layers: sept })), "7 couches : 6 au plus")).toBe(true);
  });

  it("refuse un nombre de mesures hors 1, 2, 4", () => {
    expect(raison(checkCommande(variante({ bars: 3 })), "bars 3")).toBe(true);
    expect(raison(checkCommande(gabarit), "bars")).toBe(false);
  });

  it("refuse un événement qui déborde la boucle", () => {
    const longueur = sessionLoopSeconds(gabarit);
    expect(raison(checkCommande(variante({ layers: [couche(1, [note(longueur + 1, 50, "v")])] })), "fin de la boucle")).toBe(true);
  });

  it("refuse une session sans couche", () => {
    expect(checkCommande(variante({ layers: [] }))).toEqual([expect.stringContaining("aucune couche")]);
  });
});

describe("le nombre de tours", () => {
  it("vise une à trois minutes, sans jamais dépasser", () => {
    const boucle = sessionLoopSeconds(gabarit);
    const tours = defaultTours(boucle);
    expect(tours).toBe(6);
    expect(tours * boucle).toBeGreaterThanOrEqual(60);
    expect(tours * boucle).toBeLessThanOrEqual(180);
  });

  it("reste dans les bornes pour une boucle courte et pour une boucle longue", () => {
    expect(defaultTours(2)).toBe(30);
    expect(defaultTours(200)).toBe(1);
  });
});

describe("le rendu du gabarit", () => {
  it("fait exactement le nombre d'échantillons attendu", () => {
    const boucle = sessionLoopSeconds(gabarit);
    expect(samplesForDuration(boucle, SAMPLE_RATE)).toBe(ECHANTILLONS_PAR_TOUR);
    const rendu = renderPiece(gabarit, instruments, { tours: 1 });
    expect(rendu.samples.length).toBe(ECHANTILLONS_PAR_TOUR);
    const complet = renderPiece(gabarit, instruments, { tours: defaultTours(boucle) });
    expect(complet.samples.length).toBe(defaultTours(boucle) * ECHANTILLONS_PAR_TOUR);
  });

  it("tient sous le plafond et compte les notes jouées", () => {
    const rendu = renderPiece(gabarit, instruments, { tours: 1 });
    expect(rendu.peakDb).toBeLessThanOrEqual(-1);
    expect(rendu.peakDb).toBeGreaterThan(-60);
    expect(rendu.layers.map((couche) => couche.notes)).toEqual([gabarit.layers[0]!.events.length]);
  });

  it("reprend ces nombres dans le rapport, sans en inventer", () => {
    const rendu = renderPiece(gabarit, instruments, { tours: 1 });
    const rapport = buildOeuvreReport(MODELE_SESSION, gabarit, rendu);
    expect(rapport.mesures.samples).toBe(ECHANTILLONS_PAR_TOUR);
    expect(rapport.mesures.sampleRate).toBe(SAMPLE_RATE);
    expect(rapport.mesures.peakDb).toBe(rendu.peakDb);
    expect(rapport.mesures.maxVoices).toBe(rendu.voicesTotal);
    expect(rapport.peakConforme).toBe(true);
    expect(rapport.couches).toEqual([
      { id: 1, instrument: "Harp", notes: gabarit.layers[0]!.events.length, maxVoices: rendu.voicesTotal },
    ]);
    expect(rapport.notesTotal).toBe(gabarit.layers[0]!.events.length);
    expect(rapport.loopSeconds).toBeCloseTo(sessionLoopSeconds(gabarit), 9);
  });
});

describe("la commande en ligne", () => {
  it("--help rend 0 et imprime l'usage", () => {
    const { writers, stdout } = ecrivain();
    expect(main(["--help"], writers)).toBe(0);
    expect(stdout.join("\n")).toContain("oeuvre");
  });

  it("écrit le WAV et le rapport, puis rend 0", () => {
    const dossier = mkdtempSync(join(tmpdir(), "oeuvre-"));
    const wav = join(dossier, "oeuvre-modele.wav");
    const rapport = join(dossier, "oeuvre-modele.report.json");
    const { writers, stdout } = ecrivain();
    const code = main(
      ["--session", MODELE_SESSION, "--tours", "1", "--out", wav, "--report", rapport],
      writers,
    );
    expect(code).toBe(0);
    const octets = readFileSync(wav);
    expect(octets.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(octets.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(octets.length).toBe(44 + 2 * ECHANTILLONS_PAR_TOUR);
    const lu = JSON.parse(readFileSync(rapport, "utf8")) as { mesures: { samples: number; peakDb: number } };
    expect(lu.mesures.samples).toBe(ECHANTILLONS_PAR_TOUR);
    expect(lu.mesures.peakDb).toBeLessThanOrEqual(-1);
    expect(stdout.join("\n")).toContain("conforme");
  });

  it("--no-wav n'écrit aucun fichier sonore", () => {
    const dossier = mkdtempSync(join(tmpdir(), "oeuvre-"));
    const rapport = join(dossier, "rapport.json");
    const { writers } = ecrivain();
    expect(main(["--tours", "1", "--no-wav", "--report", rapport], writers)).toBe(0);
    expect(oeuvrePaths(MODELE_SESSION).nom).toBe("modele-commande");
  });

  it("sort en code 1 sur une session hors commande, sans rien rendre", () => {
    const dossier = mkdtempSync(join(tmpdir(), "oeuvre-"));
    const mauvaise = join(dossier, "mauvaise.json");
    writeFileSync(mauvaise, JSON.stringify({ ...gabarit, tempo: 200 }), "utf8");
    const { writers, stderr } = ecrivain();
    expect(main(["--session", mauvaise, "--report", join(dossier, "r.json")], writers)).toBe(1);
    expect(stderr.join("\n")).toContain("tempo 200");
  });

  it("sort en code 2 sur un fichier absent", () => {
    const { writers } = ecrivain();
    expect(main(["--session", "takes/pieces/introuvable.json", "--no-wav"], writers)).toBe(2);
  });
});
