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
  /** La rampe des paramètres : jamais une marche (§7.9, règle 1). */
  readonly rampe: NombreLabel;
  /** La couture des deux horloges, en une phrase. */
  readonly seam: string;
}

/** Ce que le panneau dit quand il lit la séance en cours. */
export interface LessonLiveMessages {
  /** Étiquette du mode direct : les nombres viennent de la séance. */
  readonly modeLive: string;
  /** Étiquette du mode exemple : la prise de synthèse, jamais le jeu réel. */
  readonly modeDemo: string;
  /** Message affiché quand aucune image n'a encore été analysée. */
  readonly noData: string;
  /** Bouton qui bascule vers l'exemple. */
  readonly showExample: string;
  /** Bouton qui revient aux nombres de la séance. */
  readonly showLive: string;
  /** Mention obligatoire d'une valeur mesurée sur cette machine. */
  readonly measured: string;
  /** Mention obligatoire d'une valeur estimée (§5.1). */
  readonly estimated: string;
  readonly analysisMean: NombreLabel;
  readonly analysisMax: string;
  readonly frameInterval: string;
  readonly framesPerSecond: string;
  readonly thread: string;
  readonly threadNone: string;
  readonly camera: string;
  readonly framesAnalysed: string;
  /** La note réellement jouée par la personne, quand elle en joue une. */
  readonly playedNote: string;
  readonly noNote: string;
  /** Ce qui manque pour la leçon du filtre en direct. */
  readonly tremorPending: string;
  /** Ce qui manque pour la leçon des centièmes en direct. */
  readonly aimPending: string;
}

/** Le catalogue des trois leçons, dans une langue. */
export interface LessonMessages {
  readonly lang: "en" | "fr";
  readonly title: string;
  readonly close: string;
  readonly ms: string;
  readonly centsUnit: string;
  readonly filter: LessonFilterMessages;
  readonly cents: LessonCentsMessages;
  readonly horloges: LessonHorlogesMessages;
  readonly live: LessonLiveMessages;
}

export const lessonsEn: LessonMessages = {
  lang: "en",
  title: "The three lessons",
  close: "Close",
  ms: "ms",
  centsUnit: "cents",
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
    rampe: (nombre) => `Parameter ramp: ${nombre} ms — never a step (§7.9, rule 1)`,
    seam:
      "Every event carries a timestamp on the sound clock, not on the frame clock: that seam is where this kind of instrument usually crackles, drags, or leaves a note stuck.",
  },
  live: {
    modeLive: "live — this session",
    modeDemo: "example — synthetic take",
    noData:
      "No live data yet: start a session and every number below will be measured on this machine. Nothing is invented in the meantime.",
    showExample: "Show the example",
    showLive: "Back to the live numbers",
    measured: "measured",
    estimated: "estimated",
    analysisMean: (nombre) => `Analysis, mean over the last ${nombre} frames`,
    analysisMax: "Analysis, worst frame",
    frameInterval: "Interval between two frames",
    framesPerSecond: "Frames actually delivered per second",
    thread: "Analysis thread",
    threadNone: "not started",
    camera: "Camera (exposure, sensor, transport)",
    framesAnalysed: "Frames analysed",
    playedNote: "Note played right now",
    noNote: "silence",
    tremorPending:
      "The tremor of the person playing is not collected yet: the tracking chain exposes no sliding buffer of raw and filtered positions. The numbers of this lesson come from the example.",
    aimPending:
      "The height that was aimed at is not exposed by the session: only the note that was played is known here.",
  },
};
