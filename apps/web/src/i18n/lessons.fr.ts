/**
 * Les libellés des trois leçons du parcours P5, en français (AIR-N-14). Même
 * forme que `lessons.en.ts` ; le vocabulaire respecte le cahier §5.4 : on dit
 * « retard mesuré » et « retard estimé », jamais un mot qui promet un retard
 * nul ou imperceptible. Les nombres arrivent déjà mis en forme : aucun n'est
 * écrit en dur ici, ils viennent des fonctions pures de `src/lessons/` ou des
 * mesures de la séance.
 */
import type { LessonMessages } from "./lessons.en.js";

export const lessonsFr: LessonMessages = {
  lang: "fr",
  title: "Les trois leçons",
  close: "Fermer",
  ms: "ms",
  centsUnit: "centièmes",
  filter: {
    title: "Le filtre",
    legend: "Tracé de la main qui tremble : position brute, canal lissé, canal des déclenchements.",
    brut: "brut",
    lisse: "lissé",
    declencheur: "déclencheur",
    ecartTypeBrut: "Écart-type du tremblement, brut (largeurs de zone)",
    ecartTypeLisse: "Écart-type du tremblement, lissé (largeurs de zone)",
    ecartTypeVif: "Écart-type du tremblement, déclencheur (largeurs de zone)",
    alphaArret: "α du filtre à l'arrêt",
    alphaRapide: "α du filtre à une largeur de zone par seconde",
    retardLisse: "Retard du lissage",
    retardVif: "Retard du déclencheur",
  },
  cents: {
    title: "Viser juste : les centièmes",
    legend: "Écart à la gamme, en centièmes, pour chaque position de la main sur la largeur.",
    visee: "Note visée (hauteur continue)",
    jouee: "Note jouée",
    gamme: "Note de la gamme la plus proche",
    ecart: (nombre) => `Écart en centièmes : ${nombre}`,
    aimant: "Force de l'aimant",
    pire: "Position de la main où l'écart est le plus grand (fraction de la largeur)",
    tremblement: (nombre) =>
      `Un tremblement de 0,5 % de la largeur déplace la note de ${nombre} centièmes.`,
  },
  horloges: {
    title: "La couture des deux horloges",
    legend:
      "Rangée du haut : l'horloge des images. Rangée du bas : l'horloge du son, où chaque moment est programmé. Les points de couture relient chaque image à son moment programmé.",
    imagesParSeconde: (nombre) => `${nombre} images par seconde`,
    echantillonsParSeconde: (nombre) => `${nombre} échantillons par seconde`,
    parImage: (nombre) => `${nombre} ms par image`,
    echantillonsParImage: (nombre) => `${nombre} échantillons par image`,
    avance: (nombre) => `Avance de programmation : ${nombre} ms`,
    mesure: (nombre) => `Retard mesuré : ${nombre} ms`,
    camera: (nombre) => `Retard estimé de la caméra : ${nombre} ms`,
    total: (nombre) => `Total : ${nombre} ms`,
    rampe: (nombre) => `Rampe des paramètres : ${nombre} ms — jamais une marche (§7.9, règle 1)`,
    seam:
      "Chaque événement porte un horodatage sur l'horloge du son, pas sur celle des images : c'est cette couture que ce genre d'instrument fait craquer, traîne, ou laisse une note coincée.",
  },
  live: {
    modeLive: "direct — cette séance",
    modeDemo: "exemple — prise de synthèse",
    noData:
      "Pas de données en direct : lance une séance, et tous les nombres ci-dessous seront mesurés sur cette machine. Rien n'est inventé entre-temps.",
    showExample: "Voir l'exemple",
    showLive: "Revenir aux nombres mesurés",
    measured: "mesuré",
    estimated: "estimé",
    analysisMean: (nombre) => `Analyse, moyenne sur les ${nombre} dernières images`,
    analysisMax: "Analyse, image la plus lente",
    frameInterval: "Intervalle entre deux images",
    framesPerSecond: "Images réellement délivrées par seconde",
    thread: "Fil d'exécution de l'analyse",
    threadNone: "pas démarré",
    camera: "Caméra (exposition, capteur, transport)",
    framesAnalysed: "Images analysées",
    playedNote: "Note jouée à ce moment",
    noNote: "silence",
    tremorPending:
      "Le tremblement de la personne qui joue n'est pas encore recueilli : la chaîne de suivi n'expose aucun tampon glissant des positions brutes et filtrées. Les nombres de cette leçon viennent de l'exemple.",
    aimPending:
      "La hauteur visée n'est pas exposée par la séance : seule la note jouée est connue ici.",
  },
};
