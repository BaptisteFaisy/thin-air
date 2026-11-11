/**
 * Du résultat brut du modèle aux mains du contrat (cahier §7.3).
 *
 * Ce fichier ne touche pas au DOM : il reçoit la structure déjà produite par
 * `HandLandmarker.detectForVideo` et rend des `DetectedHand`. Les types
 * MediaPipe n'y sont importés qu'en `import type` (effacés à l'exécution),
 * donc les tests tournent dans Node sans le paquet ni wasm.
 *
 * **Le piège du côté.** La documentation de la tâche Hand Landmarker est
 * explicite : le côté annoncé est celui du SUJET, et « passer une image
 * retournée en miroir inverse ces sorties ». Thin Air affiche en miroir, mais
 * envoie au modèle l'image BRUTE de la caméra (le miroir de l'affichage est un
 * `transform` CSS, il ne touche pas les pixels analysés) : dans ce cas
 * `mirrored = false` et le côté du modèle est déjà le côté du sujet. La
 * convention se prouve sur la prise `left-hand-only` (§7.3, annexe D) : une
 * prise où seule la main gauche est levée DOIT donner « left ».
 */
import type { DetectedHand, HandPoint, HandSide } from "@thin-air/core";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";

/** Le côté opposé. */
export function oppositeSide(side: HandSide): HandSide {
  return side === "left" ? "right" : "left";
}

/**
 * `normaliseSides(hands, mirrored)` : avec `mirrored = true`, l'image analysée
 * était retournée horizontalement, donc chaque côté annoncé est inversé ; avec
 * `mirrored = false` (le cas de la caméra de Thin Air), rien ne bouge.
 * La fonction est pure : elle rend une nouvelle liste, jamais la même.
 */
export function normaliseSides(
  hands: readonly DetectedHand[],
  mirrored: boolean,
): readonly DetectedHand[] {
  if (!mirrored) return hands.map((hand) => ({ ...hand }));
  return hands.map((hand) => ({ ...hand, side: oppositeSide(hand.side) }));
}

/** Un point du modèle, en coordonnées d'image (0..1, 0..1, z relatif). */
function toPoint(landmark: { x: number; y: number; z: number }): HandPoint {
  return [landmark.x, landmark.y, landmark.z];
}

function toSide(entry: { categoryName?: string } | undefined): HandSide {
  const nom = entry?.categoryName?.toLowerCase() ?? "";
  return nom === "left" ? "left" : "right";
}

function toScore(entry: { score?: number } | undefined): number {
  const score = entry?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

/**
 * Traduit un résultat du modèle : 21 points par main, un côté et son score.
 * Une main sans points est ignorée — elle ne dit rien.
 */
export function toDetectedHands(result: HandLandmarkerResult): readonly DetectedHand[] {
  const mains: DetectedHand[] = [];
  result.landmarks.forEach((landmarks, index) => {
    if (landmarks.length === 0) return;
    const cote = result.handedness[index]?.[0];
    mains.push({
      side: toSide(cote),
      score: toScore(cote),
      points: landmarks.map(toPoint),
    });
  });
  return mains;
}

/**
 * `detectForVideo` exige des horodatages strictement croissants et plante
 * sinon. On garde donc le dernier envoyé et on avance d'au moins 1 ms : la
 * mesure du temps d'analyse reste celle de l'appel réel (§5.1).
 */
export function monotonicTimestamp(lastMs: number | null, timestampMs: number): number {
  const voulu = Number.isFinite(timestampMs) ? Math.max(0, Math.round(timestampMs)) : 0;
  if (lastMs === null) return voulu;
  return voulu > lastMs ? voulu : lastMs + 1;
}
