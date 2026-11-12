/**
 * Les libellés des trois leçons du parcours P5, en anglais (AIR-N-14). Fichier
 * séparé, comme `kiosk.en.ts` : il est raccordé à la page par une ligne dans
 * `i18n/index.ts` (`lessonsFor`). Le vocabulaire respecte le cahier §5.4 :
 * le retard se dit « measured » ou « estimated », jamais autrement.
 */

/** Un libellé qui accueille un nombre déjà mis en forme par `formaterNombre`. */
export type NombreLabel = (nombre: string) => string;

/**
 * Mise en forme d'un nombre dans la langue du panneau : groupes de trois
 * chiffres, puis décimale à la virgule en français, au point en anglais.
 * Une seule implémentation pour les deux langues (zéro duplication) : la
 * langue décide des deux séparateurs, rien d'autre.
 */
export function formaterNombre(valeur: number, decimales: number, lang: "en" | "fr"): string {
  if (!Number.isFinite(valeur)) return "—";
  const [entier, fraction] = valeur.toFixed(decimales).split(".");
  const groupe = entier!.replace(/\B(?=(\d{3})+(?!\d))/g, lang === "fr" ? " " : ",");
  if (fraction === undefined) return groupe;
  return `${groupe}${lang === "fr" ? "," : "."}${fraction}`;
}

export interface LessonFilterMessages {
  readonly title: string;
  readonly legend: string;
  readonly brut: string;
  readonly lisse: string;
  readonly declencheur: string;
  readonly ecartTypeBrut: string;
  readonly ecartTypeLisse: string;
  readonly ecartTypeVif: string;
  readonly alphaArret: string;
  readonly alphaRapide: string;
  readonly retardLisse: string;
  readonly retardVif: string;
}

export interface LessonCentsMessages {
  readonly title: string;
  readonly legend: string;
  readonly visee: string;
  readonly jouee: string;
  readonly gamme: string;
  readonly ecart: NombreLabel;
  readonly aimant: string;
  readonly pire: string;
  readonly tremblement: NombreLabel;
}

export interface LessonHorlogesMessages {
  readonly title: string;
  readonly legend: string;
  readonly imagesParSeconde: NombreLabel;
  readonly echantillonsParSeconde: NombreLabel;
  readonly parImage: NombreLabel;
  readonly echantillonsParImage: NombreLabel;
  readonly avance: NombreLabel;
  readonly mesure: NombreLabel;
  readonly camera: NombreLabel;
  readonly total: NombreLabel;
}

/** Le catalogue des trois leçons, dans une langue. */
export interface LessonMessages {
  readonly lang: "en" | "fr";
  readonly title: string;
  readonly close: string;
  readonly ms: string;
  readonly filter: LessonFilterMessages;
  readonly cents: LessonCentsMessages;
  readonly horloges: LessonHorlogesMessages;
}

export const lessonsEn: LessonMessages = {
  lang: "en",
  title: "The three lessons",
  close: "Close",
  ms: "ms",
  filter: {
    title: "The filter",
    legend: "Trace of the trembling hand: raw position, smoothed channel, trigger channel.",
    brut: "raw",
    lisse: "smoothed",
    declencheur: "trigger",
    ecartTypeBrut: "Tremor spread, raw (zone widths)",
    ecartTypeLisse: "Tremor spread, smoothed (zone widths)",
    ecartTypeVif: "Tremor spread, trigger (zone widths)",
    alphaArret: "Filter α at rest",
    alphaRapide: "Filter α at one zone width per second",
    retardLisse: "Smoothing delay",
    retardVif: "Trigger delay",
  },
  cents: {
    title: "Aiming true: the cents",
    legend: "Distance from the scale, in cents, for every hand position of the width.",
    visee: "Target height (continuous)",
    jouee: "Played note",
    gamme: "Nearest note of the scale",
    ecart: (nombre) => `Difference in cents: ${nombre}`,
    aimant: "Magnet strength",
    pire: "Hand position with the largest difference (fraction of the width)",
    tremblement: (nombre) =>
      `A tremor of 0.5 % of the width moves the note by ${nombre} cents.`,
  },
  horloges: {
    title: "The seam of the two clocks",
    legend:
      "Top lane: the image clock. Bottom lane: the sound clock, where every moment is scheduled. The stitches join each image to its scheduled moment.",
    imagesParSeconde: (nombre) => `${nombre} images per second`,
    echantillonsParSeconde: (nombre) => `${nombre} samples per second`,
    parImage: (nombre) => `${nombre} ms per image`,
    echantillonsParImage: (nombre) => `${nombre} samples per image`,
    avance: (nombre) => `Scheduling advance: ${nombre} ms`,
    mesure: (nombre) => `Measured latency: ${nombre} ms`,
    camera: (nombre) => `Estimated camera latency: ${nombre} ms`,
    total: (nombre) => `Total: ${nombre} ms`,
  },
};
