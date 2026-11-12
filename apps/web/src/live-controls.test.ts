/**
 * Changer d'instrument et de réglages PENDANT que la caméra tourne
 * (lot cam-live) : la séance reste pilotable.
 *
 * Ce que la preuve montre, image par image sur la prise de référence :
 *   - changer d'instrument au milieu de la prise ne laisse aucune voix
 *     coincée : tout `noteOn` a son `noteOff` ;
 *   - les voix qui sonnaient s'éteignent AVANT les notes suivantes : le
 *     nombre de voix ne dépasse jamais le plafond ;
 *   - la note jouée après le changement appartient à la NOUVELLE gamme ;
 *   - un changement pendant qu'une main est sortie du cadre, ou deux
 *     changements d'affilée sur la même image, ne cassent rien non plus.
 *
 * Aucun son (AIR-N-02) : la chaîne `core` ne rend que des événements datés.
 * Déterminisme : la prise est un fichier, aucune horloge n'est lue.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SETTINGS,
  TakeProcessor,
  type Instrument,
  type MusicEvent,
  type Settings,
  type Take,
} from "@thin-air/core";
import { edit } from "./state/instruments.js";
import { HARP, PHANTOM } from "./state/presets.js";

/** La prise de référence du banc : 91 images, 30 images/s (slow-rise). */
const PRISE = JSON.parse(
  readFileSync(new URL("../../../takes/reference/slow-rise.json", import.meta.url), "utf8"),
) as Take;

/** Les réglages du cahier : l'aimant suit l'instrument tant qu'on ne le pose pas. */
const REGLAGES: Settings = { ...DEFAULT_SETTINGS };

/** Un changement à faire sur une image donnée de la reprise. */
interface Changement {
  readonly index: number;
  readonly faire: (processor: TakeProcessor) => readonly MusicEvent[];
}

/** Ce qu'un changement laisse : les voix avant, l'extinction, les voix après. */
interface Bilan {
  readonly avant: number;
  readonly extinction: readonly MusicEvent[];
  readonly apres: number;
}

/** Rejoue la prise image par image, en appliquant les changements à leur image. */
function rejouer(instrument: Instrument, prise: Take, changements: readonly Changement[]): TakeProcessor {
  const processor = new TakeProcessor(instrument, { ...REGLAGES });
  for (let index = 0; index < prise.frames.length; index += 1) {
    for (const changement of changements) {
      if (changement.index === index) changement.faire(processor);
    }
    processor.push(prise.frames[index]!);
  }
  processor.finish();
  return processor;
}

/** Un changement qui note l'état des voix avant et après. */
function changement(
  index: number,
  faire: (processor: TakeProcessor) => readonly MusicEvent[],
  bilans: Bilan[],
): Changement {
  return {
    index,
    faire: (processor) => {
      const avant = processor.activeVoiceCount;
      const extinction = faire(processor);
      bilans.push({ avant, extinction, apres: processor.activeVoiceCount });
      return extinction;
    },
  };
}

/** Les notes jouées : `noteOn` et changements de hauteur de la voix continue. */
function notes(evenements: readonly MusicEvent[]): number[] {
  const liste: number[] = [];
  for (const evenement of evenements) {
    const midi =
      evenement.type === "noteOn"
        ? evenement.midi
        : evenement.type === "control" && evenement.param === "pitch"
          ? evenement.value
          : null;
    if (midi === null) continue;
    if (liste.length === 0 || Math.abs(liste[liste.length - 1]! - midi) > 1e-9) liste.push(midi);
  }
  return liste;
}

/** Les notes jouées entre deux moments de la prise. */
function notesEntre(evenements: readonly MusicEvent[], depuis: number, jusqua: number): number[] {
  return notes(
    evenements.filter((evenement) => evenement.t >= depuis && evenement.t < jusqua),
  );
}

/** Les voix qui n'ont pas été relâchées : aucune ne doit rester. */
function voixRestantes(evenements: readonly MusicEvent[]): string[] {
  const comptes = new Map<string, number>();
  for (const evenement of evenements) {
    if (evenement.type === "noteOn") {
      comptes.set(evenement.voice, (comptes.get(evenement.voice) ?? 0) + 1);
    } else if (evenement.type === "noteOff") {
      comptes.set(evenement.voice, (comptes.get(evenement.voice) ?? 0) - 1);
    }
  }
  return [...comptes.entries()].filter(([, compte]) => compte !== 0).map(([voix]) => voix).sort();
}

/** Le plus grand nombre de voix qui ont sonné en même temps. */
function voixMax(evenements: readonly MusicEvent[]): number {
  const actives = new Set<string>();
  let maximum = 0;
  for (const evenement of evenements) {
    if (evenement.type === "noteOn") actives.add(evenement.voice);
    else if (evenement.type === "noteOff") actives.delete(evenement.voice);
    maximum = Math.max(maximum, actives.size);
  }
  return maximum;
}

/** La note est-elle une note de la gamme de l'instrument ? */
function dansGamme(midi: number, instrument: Instrument): boolean {
  const ecart = ((midi - instrument.scale.root) % 12 + 12) % 12;
  return instrument.scale.steps.includes(ecart);
}

/** La prise où la main gauche disparaît entre deux images. */
function priseSansMainGauche(prise: Take, depuis: number, jusqua: number): Take {
  return {
    ...prise,
    frames: prise.frames.map((image, index) =>
      index >= depuis && index < jusqua
        ? { ...image, hands: image.hands.filter((main) => main.side === "right") }
        : image,
    ),
  };
}

/** Le Phantom, gamuté en majeur pentatonique : une autre gamme, le même instrument. */
const PHANTOM_PENTATONIQUE: Instrument = edit(PHANTOM, {
  scaleName: "majorPentatonic",
  root: 48,
});

describe("les commandes en cours de jeu (lot cam-live)", () => {
  it("changer d'instrument puis de gamme et d'aimant au milieu de la prise", () => {
    const moitie = Math.floor(PRISE.frames.length / 2);
    const tiers = Math.floor((PRISE.frames.length * 3) / 4);
    const tInstrument = PRISE.frames[moitie]!.t;
    const tGamme = PRISE.frames[tiers]!.t;
    const bilans: Bilan[] = [];

    const processor = rejouer(PHANTOM, PRISE, [
      changement(moitie, (p) => p.setInstrument(HARP), bilans),
      changement(tiers, (p) => p.setInstrument(PHANTOM_PENTATONIQUE), bilans),
      changement(tiers, (p) => p.setSettings({ magnet: 1 }), bilans),
    ]);
    const evenements = processor.allEvents;

    // Aucune voix ne reste coincée : tout `noteOn` a son `noteOff`.
    expect(voixRestantes(evenements)).toEqual([]);
    expect(processor.activeVoiceCount).toBe(0);

    // Les voix en cours s'éteignent avant les notes suivantes.
    expect(bilans).toHaveLength(3);
    for (const bilan of bilans) {
      expect(bilan.extinction.every((e) => e.type === "noteOff")).toBe(true);
      expect(bilan.extinction.filter((e) => e.type === "noteOff")).toHaveLength(bilan.avant);
      expect(bilan.apres).toBe(0);
    }

    // Le nombre de voix ne dépasse jamais le plafond de l'instrument en place.
    expect(voixMax(evenements)).toBeLessThanOrEqual(REGLAGES.maxVoices);
    expect(voixMax(evenements.filter((e) => e.t < tInstrument))).toBeLessThanOrEqual(PHANTOM.voices);
    expect(voixMax(evenements.filter((e) => e.t >= tInstrument && e.t < tGamme))).toBeLessThanOrEqual(HARP.voices);
    expect(voixMax(evenements.filter((e) => e.t >= tGamme))).toBeLessThanOrEqual(PHANTOM.voices);

    // La note jouée après le changement appartient à la NOUVELLE gamme.
    const notesHarpe = notesEntre(evenements, tInstrument, tGamme);
    expect(notesHarpe.length).toBeGreaterThan(0);
    for (const midi of notesHarpe) expect(dansGamme(midi, HARP)).toBe(true);

    const notesPentatonique = notesEntre(evenements, tGamme, Number.POSITIVE_INFINITY);
    expect(notesPentatonique.length).toBeGreaterThan(0);
    for (const midi of notesPentatonique) {
      expect(dansGamme(midi, PHANTOM_PENTATONIQUE)).toBe(true);
    }
  });

  it("changer d'instrument pendant qu'une main est sortie du cadre", () => {
    const moitie = Math.floor(PRISE.frames.length / 2);
    const prise = priseSansMainGauche(PRISE, moitie - 5, moitie + 10);
    const tInstrument = prise.frames[moitie]!.t;
    const bilans: Bilan[] = [];

    const processor = rejouer(PHANTOM, prise, [
      changement(moitie, (p) => p.setInstrument(HARP), bilans),
    ]);
    const evenements = processor.allEvents;

    expect(voixRestantes(evenements)).toEqual([]);
    expect(bilans).toHaveLength(1);
    expect(bilans[0]?.apres).toBe(0);
    expect(voixMax(evenements)).toBeLessThanOrEqual(REGLAGES.maxVoices);

    const notesHarpe = notesEntre(evenements, tInstrument, Number.POSITIVE_INFINITY);
    expect(notesHarpe.length).toBeGreaterThan(0);
    for (const midi of notesHarpe) expect(dansGamme(midi, HARP)).toBe(true);
  });

  it("deux changements d'affilée sur la même image : le dernier gagne", () => {
    const moitie = Math.floor(PRISE.frames.length / 2);
    const tChangement = PRISE.frames[moitie]!.t;
    const bilans: Bilan[] = [];

    const processor = rejouer(PHANTOM, PRISE, [
      changement(moitie, (p) => p.setInstrument(HARP), bilans),
      changement(moitie, (p) => p.setInstrument(PHANTOM_PENTATONIQUE), bilans),
      changement(moitie, (p) => p.setSettings({ magnet: 1 }), bilans),
    ]);
    const evenements = processor.allEvents;

    expect(voixRestantes(evenements)).toEqual([]);
    expect(bilans).toHaveLength(3);
    expect(bilans.every((bilan) => bilan.apres === 0)).toBe(true);
    expect(voixMax(evenements)).toBeLessThanOrEqual(REGLAGES.maxVoices);

    // Le dernier changement décide : c'est la gamme pentatonique qui joue.
    const notesApres = notesEntre(evenements, tChangement, Number.POSITIVE_INFINITY);
    expect(notesApres.length).toBeGreaterThan(0);
    for (const midi of notesApres) expect(dansGamme(midi, PHANTOM_PENTATONIQUE)).toBe(true);
  });
});
