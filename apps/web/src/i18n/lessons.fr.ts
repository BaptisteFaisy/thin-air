/**
 * Les libellés des trois leçons du parcours P5, en français (AIR-N-14). Même
 * forme que `lessons.en.ts` ; le vocabulaire respecte le cahier §5.4 : on dit
 * « retard mesuré » et « retard estimé », jamais un mot qui promet un retard
 * nul ou imperceptible. Les nombres arrivent déjà mis en forme : aucun n'est
 * écrit en dur ici, ils viennent des fonctions pures de `src/lessons/`.
 */
import type { LessonMessages } from "./lessons.en.js";

export const lessonsFr: LessonMessages = {
  lang: "fr",
  title: "Les trois leçons",
  close: "Fermer",
  ms: "ms",
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
  },
};
