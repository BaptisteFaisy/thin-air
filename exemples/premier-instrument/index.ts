/**
 * Premier instrument — le moteur de Thin Air vu de l'extérieur.
 *
 * On construit une note MIDI, on la rend hors ligne dans un `Float32Array`,
 * on écrit un WAV, on mesure la fréquence et le niveau, puis on affiche trois
 * nombres. Aucun son n'est émis : rien n'est lu, rien n'est joué — les
 * échantillons restent des nombres (AIR-N-02).
 *
 * Dans ce dépôt : `npx tsx exemples/premier-instrument/index.ts`
 * Ailleurs, paquets publiés : `npm install @thin-air/core @thin-air/audio`
 * puis `npx tsx index.ts` — les imports ne changent pas.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Instrument, MusicEvent } from "@thin-air/core";
import { DEFAULT_SETTINGS, measureNotes, peakDb } from "@thin-air/core";
import { encodeWav, renderEvents } from "@thin-air/audio";

/** La sortie : un dossier ignoré par git, et rien d'autre sur le disque. */
const DOSSIER_SORTIE = "out";
const FICHIER_WAV = join(DOSSIER_SORTIE, "premier-instrument.wav");

/** La note jouée : la 440 (MIDI 69), tenue une seconde. */
const MIDI = 69;
const FIN_S = 1;

/** L'instrument minimal : une sinusoïde, une voix. */
const INSTRUMENT: Instrument = {
  format: "thin-air-instrument/1",
  name: "Onde",
  pointer: "palm",
  scale: { root: MIDI, steps: [0, 3, 5, 7, 10] },
  range: { low: 55, high: 84 },
  snap: 1,
  voices: 1,
  sound: { engine: "osc", wave: "sine", attackMs: 20, releaseMs: 200 },
};

/** Les deux événements de la note : elle s'ouvre, elle se ferme. */
const EVENEMENTS: readonly MusicEvent[] = [
  { type: "noteOn", t: 0, voice: "v1", midi: MIDI, velocity: 0.8 },
  { type: "noteOff", t: FIN_S, voice: "v1" },
];

/** Un nombre à l'écran : deux décimales, sans « -0.00 ». */
function nombre(valeur: number): string {
  const arrondi = Math.round(valeur * 100) / 100;
  return (arrondi === 0 ? 0 : arrondi).toFixed(2);
}

/** Le rendu hors ligne : des échantillons, jamais un périphérique audio. */
function rendre(): { samples: Float32Array; sampleRate: number } {
  const rendu = renderEvents(EVENEMENTS, {
    instrument: INSTRUMENT,
    durationS: FIN_S + 0.5,
    masterGainDb: DEFAULT_SETTINGS.masterGainDb,
    ceilingDb: DEFAULT_SETTINGS.ceilingDb,
    reverb: DEFAULT_SETTINGS.reverb,
    maxVoices: DEFAULT_SETTINGS.maxVoices,
    paramTauMs: DEFAULT_SETTINGS.paramTauMs,
  });
  return { samples: rendu.samples, sampleRate: rendu.sampleRate };
}

/** Les trois mesures : fréquence, écart en centièmes, niveau en dB. */
function mesurer(
  echantillons: Float32Array,
  sampleRate: number,
): { hz: number; cents: number; db: number } {
  const [note] = measureNotes(echantillons, [{ t: 0, midi: MIDI, untilT: FIN_S }], { sampleRate });
  if (!note) throw new Error("mesure vide : la note n'a pas été trouvée dans le rendu");
  return { hz: note.measuredHz, cents: note.cents, db: peakDb(echantillons) };
}

function main(): void {
  const { samples, sampleRate } = rendre();
  const { hz, cents, db } = mesurer(samples, sampleRate);

  mkdirSync(DOSSIER_SORTIE, { recursive: true });
  writeFileSync(FICHIER_WAV, encodeWav(samples, sampleRate));

  console.log(`fréquence : ${nombre(hz)} Hz`);
  console.log(`écart     : ${nombre(cents)} centièmes`);
  console.log(`niveau    : ${nombre(db)} dB`);
  console.log(`WAV écrit : ${FICHIER_WAV} (aucun son émis)`);
}

main();
