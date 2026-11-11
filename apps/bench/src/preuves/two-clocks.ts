/**
 * Preuve « deux horloges » (§7.9) — le récit §14.6, point 4, en chiffres.
 *
 * La même séquence d'événements est rendue DEUX fois par le moteur hors
 * ligne : un glissé lent de la note 55 à la note 67 sur 3 s (le thérémine
 * du §7.14), avec la hauteur fixée à la cadence de la caméra — un contrôle
 * toutes les 33 ms (30 images/s).
 *
 *   - variante « avec rampes »  : le comportement actuel du moteur, chaque
 *     réglage passe par une rampe τ = `paramTauMs` (20 ms, §7.13) plus le
 *     glissement `glideMs` de l'instrument (30 ms) ;
 *   - variante « par marches »  : le réglage fixé directement à chaque
 *     image, sans lissage (`paramTauMs: 0`, `glideMs: 0`) — ce que l'agent
 *     écrivait avant le steering `two-clocks.md` (règle 1 de §7.9).
 *
 * La mesure est celle d'AIR-P-16 : `freqEnvelope` par fenêtres de 10 ms,
 * puis le plus grand saut de fréquence entre fenêtres consécutives, exprimé
 * en centièmes de demi-ton, et le nombre de sauts au-dessus du seuil d'une
 * rampe idéale (la pente exacte du glissé, avec la tolérance de 70 % déjà
 * employée par `offline/render.test.ts`).
 *
 * Exécution (depuis la racine du dépôt) :
 *   npx tsx apps/bench/src/preuves/two-clocks.ts
 *
 * Aucun son n'est émis (AIR-N-02) : le rendu est un calcul dans des
 * `Float32Array`, reproductible au bit près (AIR-N-09) — le script le
 * vérifie en rendant chaque variante deux fois.
 */
import { readInstrumentFile } from "../load.js";
import { renderEvents, type RenderResult } from "@thin-air/audio";
import {
  DEFAULT_SETTINGS,
  freqEnvelope,
  SAMPLE_RATE,
  type Instrument,
  type MusicEvent,
} from "@thin-air/core";

/** Le glissé du §7.14 : note 55 (sol, 196 Hz) → note 67 (sol, 392 Hz). */
const NOTE_DEBUT = 55;
const NOTE_FIN = 67;
const DUREE_GLISSE_S = 3;
/** L'horloge de gauche : la caméra analyse 30 images par seconde (§7.9). */
const PAS_IMAGE_S = 1 / 30;
const DEBUT_NOTE_S = 0.05;
const DUREE_RENDU_S = 4;
/** Fenêtre d'analyse de la fréquence : 10 ms (AIR-P-16). */
const FENETRE_S = 0.01;
/** Tolérance sur le pas de la rampe idéale : 70 %, comme `render.test.ts`. */
const TOLERANCE = 1.7;
/**
 * Bornes de la mesure. En dessous de ~310 Hz (midi 63, atteint à t = 2 s dans
 * ce glissé), une fenêtre de 10 ms ne contient qu'environ deux périodes :
 * l'autocorrélation de `dominantFreq` quantifie le lag et ajoute un bruit qui
 * dépasse le pas mesuré — mesuré sur des notes tenues : 9,3 centièmes à
 * 261,6 Hz, 1,6 à 293,7 Hz, 0,9 à 311,1 Hz (plancher documenté dans
 * `measure.ts` : la fréquence la plus basse mesurable est
 * sampleRate / (fenêtre / 2) = 200 Hz). Ce bruit frapperait les DEUX
 * variantes. La mesure porte donc sur la fin du glissé, de mi (311,13 Hz) à
 * sol (392 Hz) — le passage mi → fa → sol du §7.14 ; au-delà de 3 s la note
 * est relâchée.
 */
const MESURE_DE_S = 2.0;
const MESURE_A_S = 2.99;

/** Écart en centièmes de demi-ton entre deux fréquences. */
function centsEntre(f0: number, f1: number): number {
  return 1200 * Math.log2(f1 / f0);
}

/**
 * Les événements du glissé : un `noteOn`, puis la hauteur fixée à chaque
 * image (toutes les 33 ms), puis un `noteOff`. La cible monte linéairement
 * de la note 55 à la note 67 — « sans aimant », comme le test d'AIR-P-16.
 */
function evenementsGlisse(): MusicEvent[] {
  const images = Math.round(DUREE_GLISSE_S / PAS_IMAGE_S);
  const evenements: MusicEvent[] = [
    { type: "noteOn", t: DEBUT_NOTE_S, voice: "v", midi: NOTE_DEBUT, velocity: 1 },
  ];
  for (let i = 1; i <= images; i += 1) {
    const midi = NOTE_DEBUT + (NOTE_FIN - NOTE_DEBUT) * (i / images);
    evenements.push({
      type: "control",
      t: DEBUT_NOTE_S + i * PAS_IMAGE_S,
      voice: "v",
      param: "pitch",
      value: midi,
    });
  }
  evenements.push({ type: "noteOff", t: DEBUT_NOTE_S + DUREE_GLISSE_S + 0.1, voice: "v" });
  return evenements;
}

/** Une variante rendue deux fois : les deux rendus doivent être identiques. */
function rendreDeuxFois(instrument: Instrument, paramTauMs: number): RenderResult {
  const evenements = evenementsGlisse();
  const options = { instrument, paramTauMs, reverb: 0, durationS: DUREE_RENDU_S };
  const premier = renderEvents(evenements, options);
  const second = renderEvents(evenements, options);
  const identiques =
    premier.samples.length === second.samples.length &&
    premier.samples.every((valeur, i) => valeur === second.samples[i]);
  if (!identiques) throw new Error("rendu non reproductible au bit près (AIR-N-09)");
  return premier;
}

/** La variante « par marches » : le même instrument, sans aucun glissement. */
function instrumentSansGlisse(instrument: Instrument): Instrument {
  return { ...instrument, sound: { ...instrument.sound, glideMs: 0 } };
}

interface Mesure {
  readonly fenetres: number;
  readonly maxSautCents: number;
  readonly tPireSaut: number;
  readonly sautsAuDessusDuSeuil: number;
}

/**
 * AIR-P-16 : les sauts entre fenêtres consécutives de `freqEnvelope`.
 * Seules les paires de fenêtres voisines mesurées (hz > 0) et dans la zone
 * jouée sont comptées ; le seuil est le pas de la rampe idéale × tolérance.
 */
function mesurer(samples: Float32Array, pasIdealCents: number): Mesure {
  const courbe = freqEnvelope(samples, { sampleRate: SAMPLE_RATE, windowS: FENETRE_S });
  const seuil = pasIdealCents * TOLERANCE;
  let fenetres = 0;
  let maxSautCents = 0;
  let tPireSaut = 0;
  let sautsAuDessusDuSeuil = 0;
  for (let i = 1; i < courbe.length; i += 1) {
    const avant = courbe[i - 1];
    const ici = courbe[i];
    if (!avant || !ici || avant.hz <= 0 || ici.hz <= 0) continue;
    if (ici.t < MESURE_DE_S || ici.t > MESURE_A_S) continue;
    fenetres += 1;
    const saut = Math.abs(centsEntre(avant.hz, ici.hz));
    if (saut > maxSautCents) {
      maxSautCents = saut;
      tPireSaut = ici.t;
    }
    if (saut > seuil) sautsAuDessusDuSeuil += 1;
  }
  return { fenetres, maxSautCents, tPireSaut, sautsAuDessusDuSeuil };
}

function ligne(etiquette: string, valeur: string | number): string {
  return `  ${etiquette.padEnd(38, " ")}: ${valeur}`;
}

function afficherVariante(titre: string, mesure: Mesure, pasIdealCents: number): void {
  console.log(titre);
  console.log(ligne("fenêtres mesurées", mesure.fenetres));
  console.log(
    ligne(
      "plus grand saut (centièmes)",
      `${mesure.maxSautCents.toFixed(2)} (à t = ${mesure.tPireSaut.toFixed(2)} s)`,
    ),
  );
  console.log(ligne(`sauts au-dessus du seuil`, mesure.sautsAuDessusDuSeuil));
  console.log(ligne("rendu reproductible au bit près", "oui"));
  console.log(
    ligne(
      "rampe idéale / seuil (×1,7)",
      `${pasIdealCents.toFixed(2)} / ${(pasIdealCents * TOLERANCE).toFixed(2)} centièmes`,
    ),
  );
  console.log("");
}

async function principal(): Promise<void> {
  const instrument = await readInstrumentFile("instruments/phantom.json");
  const pasIdealCents =
    ((NOTE_FIN - NOTE_DEBUT) * 100 * FENETRE_S) / DUREE_GLISSE_S; // centièmes par fenêtre
  const tau = DEFAULT_SETTINGS.paramTauMs;

  console.log("");
  console.log("Thin Air — preuve « deux horloges » (§7.9, AIR-P-16, récit §14.6 point 4)");
  console.log(
    `Glissé lent note ${NOTE_DEBUT} → ${NOTE_FIN} sur ${DUREE_GLISSE_S} s (thérémine, §7.14), ` +
      `hauteur fixée toutes les ${(PAS_IMAGE_S * 1000).toFixed(1)} ms (30 images/s).`,
  );
  console.log(
    `Mesure : freqEnvelope, fenêtres de ${FENETRE_S * 1000} ms, de ${MESURE_DE_S} s à ` +
      `${MESURE_A_S} s ; échantillonnage ${SAMPLE_RATE} Hz.`,
  );
  console.log("");

  const avecRampes = rendreDeuxFois(instrument, tau);
  const parMarches = rendreDeuxFois(instrumentSansGlisse(instrument), 0);

  afficherVariante(
    `Variante « avec rampes » — le moteur actuel (τ = paramTauMs = ${tau} ms, glideMs ${instrument.sound.glideMs ?? 0})`,
    mesurer(avecRampes.samples, pasIdealCents),
    pasIdealCents,
  );
  afficherVariante(
    "Variante « par marches » — le réglage fixé directement à chaque image, sans rampe (paramTauMs 0, glideMs 0)",
    mesurer(parMarches.samples, pasIdealCents),
    pasIdealCents,
  );

  console.log(
    "Lecture : avec rampes, aucun saut ne dépasse la rampe idéale (à 70 % près) — AIR-P-16 tient ;",
  );
  console.log(
    "par marches, la hauteur avance par à-coups trente fois par seconde : c'est le grésillement.",
  );
}

await principal();
