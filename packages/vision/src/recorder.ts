/**
 * Les prises (cahier §7.11, AIR-F-47, AIR-F-48) : le flux des points, jamais
 * l'image. Une prise n'est enregistrée que sur demande explicite et reste sur
 * l'appareil : `downloadTake` produit un fichier local via un `blob:` URL, il
 * n'y a aucun envoi réseau (AIR-N-01, AIR-F-57).
 *
 * Le contenu est borné par construction : l'enregistreur recopie seulement
 * l'instant, le côté, le score et les 21 points — toute autre donnée portée
 * par une image est oubliée au moment du `push`, pas au moment de l'écriture.
 */
import type { DetectedHand, HandPoint, Take, TakeFrame } from "@thin-air/core";
import type { VisionFrame } from "./source.js";

const FORMAT = "thin-air-take/1" as const;
const CADENCE_DEFAUT = 30;

export interface TakeRecorder {
  start(): void;
  push(frame: VisionFrame): void;
  stop(): Take;
  readonly seconds: number;
}

/** Copie un point : la prise ne partage aucune référence avec la source. */
function copyPoint(point: HandPoint): HandPoint {
  return [point[0] ?? 0, point[1] ?? 0, point[2] ?? 0];
}

function copyHand(hand: DetectedHand): DetectedHand {
  return { side: hand.side, score: hand.score, points: hand.points.map(copyPoint) };
}

/** Une image de prise : l'instant et les mains, rien d'autre. */
function toTakeFrame(frame: VisionFrame): TakeFrame {
  return { t: frame.t, hands: frame.hands.map(copyHand) };
}

/**
 * Enregistre le flux des points. `push` ne fait rien avant `start()` et plus
 * rien après `stop()` : une prise commence et s'arrête sur demande (§7.11).
 */
export function createTakeRecorder(fps: number = CADENCE_DEFAUT): TakeRecorder {
  const cadence = Number.isFinite(fps) && fps > 0 ? fps : CADENCE_DEFAUT;
  let images: TakeFrame[] = [];
  let enCours = false;

  return {
    start() {
      images = [];
      enCours = true;
    },
    push(frame: VisionFrame) {
      if (!enCours) return;
      images.push(toTakeFrame(frame));
    },
    stop() {
      enCours = false;
      return { format: FORMAT, fps: cadence, frames: [...images] };
    },
    get seconds() {
      const premiere = images[0]?.t;
      const derniere = images[images.length - 1]?.t;
      if (premiere === undefined || derniere === undefined) return 0;
      return derniere > premiere ? derniere - premiere : 0;
    },
  };
}

/** Les seules clés qu'une prise a le droit de porter (§7.11). */
const CLES_PRISES = new Set(["format", "fps", "frames"]);
const CLES_IMAGE = new Set(["t", "hands"]);
const CLES_MAIN = new Set(["side", "score", "points"]);

function clesAutorisees(objet: object, autorisees: ReadonlySet<string>): boolean {
  return Object.keys(objet).every((cle) => autorisees.has(cle));
}

/**
 * Une prise ne contient QUE des instants, des côtés, des scores et des points
 * (AIR-F-47, AIR-P-20). Aucune image, aucune miniature, aucun identifiant :
 * c'est vérifiable ici, sans réseau ni fichier.
 */
export function takeCarriesPointsOnly(take: Take): boolean {
  if (!clesAutorisees(take, CLES_PRISES)) return false;
  return take.frames.every(
    (image) =>
      clesAutorisees(image, CLES_IMAGE) &&
      Number.isFinite(image.t) &&
      image.hands.every(
        (main) =>
          clesAutorisees(main, CLES_MAIN) &&
          (main.side === "left" || main.side === "right") &&
          Number.isFinite(main.score) &&
          main.points.every(
            (point) =>
              Array.isArray(point) &&
              point.length === 3 &&
              point.every((valeur) => Number.isFinite(valeur)),
          ),
      ),
  );
}

/** Sérialisation exacte de la prise : ce qui sera écrit dans le fichier. */
export function takeToJson(take: Take): string {
  return JSON.stringify(take);
}

/** Nom de fichier par défaut : déterministe, sans date ni compteur caché. */
export function takeFilename(take: Take, filename?: string): string {
  if (filename !== undefined && filename.trim() !== "") return filename;
  return `thin-air-take-${take.frames.length}frames.json`;
}

/** Le minimum de DOM nécessaire au téléchargement : injectable en test. */
export interface DownloadEnvironment {
  readonly createBlobUrl: (json: string) => string;
  readonly releaseBlobUrl: (url: string) => void;
  readonly saveAs: (url: string, filename: string) => void;
}

/** Environnement par défaut : `Blob` + objet URL + lien de téléchargement. */
export function defaultDownloadEnvironment(): DownloadEnvironment {
  return {
    createBlobUrl: (json) => URL.createObjectURL(new Blob([json], { type: "application/json" })),
    releaseBlobUrl: (url) => URL.revokeObjectURL(url),
    saveAs: (url, filename) => {
      const doc = globalThis.document;
      if (doc === undefined) return;
      const lien = doc.createElement("a");
      lien.href = url;
      lien.download = filename;
      lien.rel = "noopener";
      doc.body?.append(lien);
      lien.click();
      lien.remove();
    },
  };
}

/**
 * Propose la prise en téléchargement local. Aucun `fetch`, aucune requête :
 * l'URL est un `blob:` qui vit dans la page (AIR-F-57).
 */
export function downloadTake(
  take: Take,
  filename?: string,
  environment: DownloadEnvironment = defaultDownloadEnvironment(),
): void {
  const url = environment.createBlobUrl(takeToJson(take));
  try {
    environment.saveAs(url, takeFilename(take, filename));
  } finally {
    environment.releaseBlobUrl(url);
  }
}
