/**
 * Le poids d'une prise, confronté à ce que le cahier annonce en §7.11 :
 * 126 nombres par image, environ 26 Ko par seconde en JSON brut, 7,6 Ko par
 * seconde en entiers de 16 bits. Un écart est signalé, il n'est pas corrigé
 * en silence.
 */
import type { Take } from "@thin-air/core";

/** Poids annoncé par le cahier §7.11 pour du JSON brut, en octets par seconde. */
export const ANNOUNCED_JSON_BYTES_PER_SECOND = 26 * 1024;

/** Poids annoncé pour le codage compact (entiers de 16 bits), octets/seconde. */
export const ANNOUNCED_BINARY_BYTES_PER_SECOND = 7.6 * 1024;

/** Un facteur 2 est toléré : « dans cet ordre de grandeur ». */
export const WEIGHT_FACTOR = 2;

export interface TakeWeight {
  readonly bytes: number;
  /** Durée couverte par la prise, en secondes. */
  readonly seconds: number;
  readonly bytesPerSecond: number;
  /** Poids mesuré / poids annoncé. */
  readonly ratio: number;
  readonly within: boolean;
}

/** Durée d'une prise : le nombre d'images rapporté à la cadence. */
export function takeDurationS(take: Take): number {
  const fps = take.fps > 0 ? take.fps : 30;
  const dernier = take.frames[take.frames.length - 1];
  if (take.frames.length === 0) return 0;
  return dernier === undefined ? take.frames.length / fps : dernier.t + 1 / fps;
}

/** Compare le poids réel d'un fichier au poids annoncé du cahier. */
export function weighTake(take: Take, bytes: number): TakeWeight {
  const seconds = takeDurationS(take);
  const bytesPerSecond = seconds > 0 ? bytes / seconds : 0;
  const ratio = bytesPerSecond / ANNOUNCED_JSON_BYTES_PER_SECOND;
  return {
    bytes,
    seconds,
    bytesPerSecond,
    ratio,
    within: ratio <= WEIGHT_FACTOR && ratio >= 1 / WEIGHT_FACTOR,
  };
}
