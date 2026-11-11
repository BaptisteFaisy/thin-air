/**
 * `bench synth <forme> [paramètres]` : fabrique une prise de synthèse.
 *
 * Les générateurs viennent de `@thin-air/core` (`takeGen.ts`, lot B1) : le banc
 * ne réinvente aucune trajectoire. Il choisit seulement les poses, dans la
 * zone de jeu par défaut, pour que `u` et `v` soient ceux du cahier.
 */
import type { HandPose, SynthOptions, Take } from "@thin-air/core";
import {
  crossingHandsTake,
  defaultPlayRect,
  handLeavesTake,
  leftHandOnlyTake,
  linearTake,
  makeHand,
  sweepTake,
  tremorTake,
  withHand,
} from "@thin-air/core";

import { BenchError, isUnavailableContract } from "./errors.js";

export type SynthShape = "line" | "tremor" | "sweep" | "leave" | "cross" | "left-only" | "jab";

/** Les sept formes acceptées par la ligne de commande, dans l'ordre de l'aide. */
export const SYNTH_SHAPES: readonly SynthShape[] = [
  "line",
  "tremor",
  "sweep",
  "leave",
  "cross",
  "left-only",
  "jab",
];

/** Durée par défaut de chaque forme, en secondes. */
const DURATIONS: Readonly<Record<SynthShape, number>> = {
  line: 3,
  tremor: 3,
  sweep: 0.5,
  leave: 1.5,
  cross: 2,
  "left-only": 2,
  jab: 0.3,
};

export function isSynthShape(name: string): name is SynthShape {
  return (SYNTH_SHAPES as readonly string[]).includes(name);
}

type SynthArgs = Record<string, number | string>;

function numberArg(args: SynthArgs, key: string, fallback: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BenchError(`paramètre numérique attendu pour « ${key} » : ${String(value)}`);
  }
  return parsed;
}

/** Position d'image correspondant à `u` dans la zone de jeu par défaut. */
export function xFromU(u: number): number {
  const rect = defaultPlayRect();
  return rect.u0 + u * (rect.u1 - rect.u0);
}

/** Position d'image correspondant à `v` dans la zone de jeu par défaut. */
export function yFromV(v: number): number {
  const rect = defaultPlayRect();
  return rect.v0 + v * (rect.v1 - rect.v0);
}

function pose(u: number, v: number, side: "left" | "right"): HandPose {
  return { x: xFromU(u), y: yFromV(v), side };
}

function optionsOf(shape: SynthShape, args: SynthArgs): SynthOptions {
  return {
    fps: numberArg(args, "fps", 30),
    durationS: numberArg(args, "duration", DURATIONS[shape]),
    seed: numberArg(args, "seed", 1),
  };
}

/** Une forme à une main : trait, tremblement, traversée, sortie, coup bref. */
function singleHandTake(shape: SynthShape, args: SynthArgs): Take {
  const options = optionsOf(shape, args);
  const fromU = numberArg(args, "fromU", 0.3);
  const toU = numberArg(args, "toU", 0.6);
  const fromV = numberArg(args, "fromV", 0.5);
  const toV = numberArg(args, "toV", fromV);
  const depart = pose(fromU, fromV, "right");
  switch (shape) {
    case "sweep":
      return sweepTake(fromU, toU, options);
    case "leave":
      return handLeavesTake(depart, numberArg(args, "leaveAt", 0.8), options);
    case "tremor": {
      const centre = pose(numberArg(args, "centerU", fromU), numberArg(args, "centerV", fromV), "right");
      return tremorTake(centre, numberArg(args, "amplitude", 0.02), options);
    }
    case "jab":
    case "line":
      // Le coup bref et le trait : deux positions, l'une à l'autre.
      return linearTake(depart, pose(toU, toV, "right"), options);
    case "cross":
    case "left-only":
      // Ces deux formes demandent deux mains : elles passent par `synthTake`.
      throw new BenchError(`forme à deux mains hors de ce chemin : ${shape}`);
  }
}

/** Fabrique la prise : une forme, des paramètres nommés, aucune caméra. */
export function synthTake(shape: SynthShape, args?: Record<string, number | string>): Take {
  const params: SynthArgs = args ?? {};
  try {
    if (shape === "cross") return crossingHandsTake(optionsOf(shape, params));
    if (shape === "left-only") return leftHandOnlyTake(optionsOf(shape, params));
    return singleHandTake(shape, params);
  } catch (error) {
    if (isUnavailableContract(error)) {
      throw new BenchError(`prise de synthèse indisponible : ${String((error as Error).message)} — lot B1 (takeGen)`);
    }
    throw error;
  }
}

/** Ajoute une main immobile à `v` constant : la main de volume du thérémine. */
export function withVolumeHand(take: Take, v: number, side: "left" | "right" = "left"): Take {
  const y = yFromV(v);
  try {
    return withHand(take, () => makeHand({ x: xFromU(0.5), y, side, open: 1 }));
  } catch (error) {
    if (isUnavailableContract(error)) {
      throw new BenchError(`main de volume indisponible : ${String((error as Error).message)} — lot B1 (takeGen)`);
    }
    throw error;
  }
}
