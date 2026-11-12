/**
 * La boucle compense-t-elle vraiment le retard ? (cahier §5.2, §7.10)
 *
 * Simulation de bout en bout, sans son. Huit notes pincées sont visées sur la
 * grille (une par croche, à 90 battements par minute, quatre mesures) et
 * jouées avec un retard connu — le cas courant du cahier §5.1, 105 ms. Elles
 * sont enregistrées dans une couche (`LoopRecorder`), puis :
 *
 *   - sans compensation : la couche est rejouée telle quelle ;
 *   - avec compensation : la couche passe par `compensate` (§7.10) ;
 *   - dans les deux cas : rendu hors ligne (`renderEvents`, `@thin-air/audio`)
 *     sur la boucle entière, puis mesure des attaques sur les échantillons
 *     avec `attackTimes` (`@thin-air/core`).
 *
 * Une troisième prise, jouée SANS retard, sert de référence : elle donne la
 * position des attaques telle que le moteur les rend, et le décalage propre
 * au détecteur (lissage de l'enveloppe). Les écarts se mesurent donc contre
 * elle, jamais contre une formule réécrite ici.
 *
 * Aucun son n'est émis (AIR-N-02) : le rendu est un calcul dans des
 * `Float32Array`, reproductible au bit près (AIR-N-09).
 */
import { renderEvents } from "@thin-air/audio";
import {
  attackTimes,
  compensate,
  gridStepSeconds,
  loopSamples,
  loopSeconds,
  LoopRecorder,
  SAMPLE_RATE,
  withSettings,
  type Instrument,
  type LoopLayer,
  type MusicEvent,
  type Settings,
} from "@thin-air/core";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readInstrumentFile } from "./load.js";

/** Le cadre du cahier §7.10 : 90 battements par minute, quatre mesures. */
export const TEMPO = 90;
export const MESURES = 4;
export const TEMPS_PAR_MESURE = 4;
/** Le retard courant du cahier §5.1 : 105 ms en filaire. */
export const RETARD_S = 0.105;
/** Huit notes, une par croche : assez espacées pour dater chaque attaque. */
export const NB_NOTES = 8;
export const ESPACEMENT_PAS = 2;
/** Harpe (§5.2, son pincé) : attaque franche de 2 ms, donc datable. */
export const CHEMIN_INSTRUMENT = "instruments/harp.json";
/**
 * Fenêtre d'association d'une attaque à sa note. Le pincé fait ré-envoler
 * l'enveloppe plus tard (mesuré : à 170 ms et au-delà de la note) ; 50 ms
 * gardent l'attaque de la note et laissent ces ré-envolées dehors.
 */
export const FENETRE_ASSOCIATION_S = 0.05;

/** Longueur de la boucle en secondes : 32/3 s, soit 10,667 s (§7.10). */
export const BOUCLE_S = loopSeconds(TEMPO, MESURES, TEMPS_PAR_MESURE);
/** Longueur en échantillons : exactement 512 000 (recette §18). */
export const ECHANTILLONS_BOUCLE = loopSamples(TEMPO, MESURES, TEMPS_PAR_MESURE, SAMPLE_RATE);
/** Pas de la double croche à 90 : 166,67 ms (§7.10). */
export const PAS_S = gridStepSeconds("sixteenth", TEMPO);

const REGLAGES: Settings = withSettings({
  tempo: TEMPO,
  loopBars: MESURES,
  beatsPerBar: TEMPS_PAR_MESURE,
});

/** Le dossier racine du dépôt, déduit de l'emplacement de ce fichier. */
const RACINE = fileURLToPath(new URL("../../../", import.meta.url));

/** L'instrument de la preuve : la harpe, son pincé à attaque franche (§5.2). */
export async function instrumentDeLaSimulation(): Promise<Instrument> {
  return readInstrumentFile(join(RACINE, CHEMIN_INSTRUMENT));
}

/** Les positions visées par le joueur : huit croches, à partir de la seconde. */
export function positionsVisees(): readonly number[] {
  return Array.from({ length: NB_NOTES }, (_, i) => (i + 1) * PAS_S * ESPACEMENT_PAS);
}

/**
 * Les événements tels que la caméra les voit : chaque note visée arrive datée
 * de `visée + retard`. Une voix par note, pour que chaque attaque soit datable
 * sans ambiguïté.
 */
export function evenementsJoues(
  visees: readonly number[],
  retardS: number,
): readonly MusicEvent[] {
  const evenements: MusicEvent[] = [];
  visees.forEach((visee, i) => {
    const t = visee + retardS;
    evenements.push({ type: "noteOn", t, voice: `n${i}`, midi: 50 + i, velocity: 0.9 });
    evenements.push({ type: "noteOff", t: t + 0.12, voice: `n${i}` });
  });
  return evenements;
}

/** Enregistre les événements dans une couche, sans compensation implicite. */
export function enregistrerCouche(
  evenements: readonly MusicEvent[],
  instrument: string,
): LoopLayer {
  const recorder = new LoopRecorder(REGLAGES);
  recorder.latencyS = 0; // la compensation est appliquée explicitement, après
  recorder.start(0);
  for (const evenement of evenements) recorder.record(evenement);
  const couche = recorder.stop(BOUCLE_S + 1, instrument);
  if (couche === null) throw new Error("la couche a été refusée par l'enregistreur");
  return couche;
}

/**
 * Associe chaque note (`noteOn`) à la PREMIÈRE attaque détectée dans la
 * fenêtre qui suit son enregistrement ; `NaN` si le détecteur n'en voit
 * aucune. Rien n'est réécrit : les attaques viennent de `attackTimes`.
 */
export function attaquesParNote(
  evenements: readonly MusicEvent[],
  attaques: readonly number[],
  fenetreS: number = FENETRE_ASSOCIATION_S,
): readonly number[] {
  const notes = evenements.filter((evenement) => evenement.type === "noteOn");
  return notes.map(
    (note) =>
      attaques.find((attaque) => attaque >= note.t - 1e-9 && attaque < note.t + fenetreS) ??
      Number.NaN,
  );
}

/** Une prise rendue : ce qui est joué, et ce que le détecteur y voit. */
export interface Prise {
  /** Les événements rendus (déjà passés par la couche, éventuellement compensés). */
  readonly evenements: readonly MusicEvent[];
  /** Toutes les attaques détectées sur les échantillons. */
  readonly attaques: readonly number[];
  /** L'attaque associée à chaque note, dans l'ordre des notes. */
  readonly parNote: readonly number[];
  /** Longueur du rendu, en échantillons. */
  readonly echantillons: number;
}

/** Les options de rendu, identiques pour les trois prises (réverbération nulle). */
function optionsRendu(instrument: Instrument) {
  return { instrument, durationS: BOUCLE_S, reverb: 0 };
}

/** Rend une prise hors ligne sur la boucle entière, puis la mesure. */
export function rendreEtMesurer(
  evenements: readonly MusicEvent[],
  instrument: Instrument,
): Prise {
  const rendu = renderEvents(evenements, optionsRendu(instrument));
  const attaques = attackTimes(rendu.samples, SAMPLE_RATE);
  return {
    evenements,
    attaques,
    parNote: attaquesParNote(evenements, attaques),
    echantillons: rendu.samples.length,
  };
}

/** Deux échantillonnages des mêmes événements sont identiques au bit près. */
function memeRendu(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Le rendu est reproductible au bit près (AIR-N-09) : vérifié en rendant deux fois. */
export function renduReproductible(
  evenements: readonly MusicEvent[],
  instrument: Instrument,
): boolean {
  const premier = renderEvents(evenements, optionsRendu(instrument));
  const second = renderEvents(evenements, optionsRendu(instrument));
  return memeRendu(premier.samples, second.samples);
}

/** Écart moyen entre deux séries, en secondes ; `NaN` si une valeur manque. */
export function ecartMoyen(mesurees: readonly number[], reference: readonly number[]): number {
  const paires = ecarts(mesurees, reference);
  if (paires.length === 0) return Number.NaN;
  return paires.reduce((total, ecart) => total + ecart, 0) / paires.length;
}

/** Le plus grand écart en valeur absolue, en secondes. */
export function ecartMax(mesurees: readonly number[], reference: readonly number[]): number {
  return ecarts(mesurees, reference).reduce((max, ecart) => Math.max(max, Math.abs(ecart)), 0);
}

/** Les écarts terme à terme, en ignorant les paires incomplètes. */
function ecarts(mesurees: readonly number[], reference: readonly number[]): readonly number[] {
  const paires: number[] = [];
  mesurees.forEach((mesuree, i) => {
    const attendue = reference[i];
    if (attendue === undefined) return;
    if (!Number.isFinite(mesuree) || !Number.isFinite(attendue)) return;
    paires.push(mesuree - attendue);
  });
  return paires;
}

/** Ce que la simulation mesure, prise par prise. */
export interface Simulation {
  /** Les positions visées sur la grille. */
  readonly visees: readonly number[];
  /** Prise de référence : jouée sans retard. */
  readonly reference: Prise;
  /** Prise retardée, rejouée telle quelle : ce que le cahier appelle « boite ». */
  readonly sansCompensation: Prise;
  /** Prise retardée, passée par `compensate` avec le retard connu. */
  readonly avecCompensation: Prise;
  /** Le rendu compensé, fait deux fois, est identique au bit près. */
  readonly reproductible: boolean;
  /** Décalage propre au détecteur : attaque mesurée − position visée. */
  readonly biaisMesureS: number;
  /** Le plus grand de ces décalages, en valeur absolue. */
  readonly biaisMaxS: number;
  /** Écart moyen sans compensation, contre la référence, en secondes. */
  readonly ecartSansS: number;
  /** Écart moyen avec compensation, contre la référence, en secondes. */
  readonly ecartAvecS: number;
  /** Le plus grand écart avec compensation, contre la référence. */
  readonly ecartAvecMaxS: number;
  /** Le plus grand écart avec compensation, contre la position visée. */
  readonly ecartAvecGrilleMaxS: number;
}

/**
 * Les trois prises : référence, sans compensation, avec compensation. Le
 * même instrument, les mêmes positions visées, le même moteur de rendu.
 */
export function simuler(instrument: Instrument): Simulation {
  const visees = positionsVisees();
  const reference = rendreEtMesurer(evenementsJoues(visees, 0), instrument);
  const couche = enregistrerCouche(evenementsJoues(visees, RETARD_S), CHEMIN_INSTRUMENT);
  const sansCompensation = rendreEtMesurer(couche.events, instrument);
  const compenses = compensate(couche.events, RETARD_S, BOUCLE_S);
  const avecCompensation = rendreEtMesurer(compenses, instrument);
  return {
    visees,
    reference,
    sansCompensation,
    avecCompensation,
    reproductible: renduReproductible(compenses, instrument),
    biaisMesureS: ecartMoyen(reference.parNote, visees),
    biaisMaxS: ecartMax(reference.parNote, visees),
    ecartSansS: ecartMoyen(sansCompensation.parNote, reference.parNote),
    ecartAvecS: ecartMoyen(avecCompensation.parNote, reference.parNote),
    ecartAvecMaxS: ecartMax(avecCompensation.parNote, reference.parNote),
    ecartAvecGrilleMaxS: ecartMax(avecCompensation.parNote, visees),
  };
}
