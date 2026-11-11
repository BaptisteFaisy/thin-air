/**
 * Les quatre commandes du banc d'essai (cahier §11.6, AIR-F-49).
 *
 * Chacune rend un code de sortie : 0 conforme, 1 écart ou échec, 2 usage.
 * Aucune n'ouvre de périphérique audio et aucune n'écrit sur la sortie son :
 * elles lisent des fichiers, calculent, écrivent des fichiers (AIR-N-02).
 */
import type { MusicEvent } from "@thin-air/core";
import { basename, extname } from "node:path";

import type { ParsedArgs } from "./args.js";
import { numberValue, optionalValue, parseArgs, requireValue, wantsHelp } from "./args.js";
import { compareReports, formatComparison } from "./compare.js";
import { BenchError, UsageError, isUnavailableContract } from "./errors.js";
import type { EventsOptions } from "./events.js";
import { eventsOf, formatEvents } from "./events.js";
import { commandHelp } from "./help.js";
import { fileSize, readJsonFile, writeBytesFile, writeJsonFile } from "./io.js";
import { loadEncoding } from "./contracts.js";
import { readInstrumentFile, readSettingsFile, readTakeFile } from "./load.js";
import { parseReport } from "./report.js";
import { renderedTake, wavOf, writeRenderOut } from "./render.js";
import type { SynthShape } from "./synth.js";
import { SYNTH_SHAPES, isSynthShape, synthTake } from "./synth.js";
import { weighTake } from "./weight.js";
import type { TakeWeight } from "./weight.js";
import { fixed } from "./format.js";

export interface Writers {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

/** La sortie du processus, quand la commande tourne vraiment. */
export const PROCESS_WRITERS: Writers = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
};

const COMMUNES = ["settings", "quiet"] as const;

const SPECS = {
  events: {
    command: "bench events",
    values: ["take", "instrument", ...COMMUNES],
    flags: ["one-hand", "hold", "json"],
  },
  render: {
    command: "bench render",
    values: ["take", "instrument", "out", ...COMMUNES],
    flags: ["one-hand", "hold", "json", "no-wav"],
  },
  compare: {
    command: "bench compare",
    values: [],
    flags: ["json", "quiet"],
    positionals: 2,
  },
  synth: {
    command: "bench synth",
    values: [
      "out",
      "fps",
      "duration",
      "seed",
      "from-u",
      "to-u",
      "from-v",
      "to-v",
      "center-u",
      "center-v",
      "amplitude",
      "leave-at",
      "quiet",
    ],
    flags: ["binary", "json"],
    positionals: 1,
  },
} as const;

/** Options de prise et d'instrument partagées par `events` et `render`. */
function eventOptions(args: ParsedArgs): EventsOptions {
  const settingsPath = optionalValue(args, "settings");
  return {
    settings: settingsPath === undefined ? undefined : readSettingsFile(settingsPath),
    oneHand: args.flags.has("one-hand") ? true : undefined,
    hold: args.flags.has("hold") ? true : undefined,
  };
}

function takeLabel(path: string): string {
  const extension = extname(path);
  return basename(path, extension);
}

function summary(label: string, instrument: string, events: readonly MusicEvent[]): string {
  return `${label} · ${instrument} · ${events.length} événement${events.length > 1 ? "s" : ""}`;
}

function jsonOr(text: string, value: unknown, wantJson: boolean): string {
  return wantJson ? `${JSON.stringify(value, null, 2)}` : text;
}

/** `bench events` : la liste des événements, triée par moment. */
export async function runEvents(argv: readonly string[], writers: Writers = PROCESS_WRITERS): Promise<number> {
  const args = parseArgs(argv, SPECS.events);
  if (wantsHelp(args)) {
    writers.out(commandHelp("events"));
    return 0;
  }
  const label = takeLabel(requireValue(args, "take"));
  const take = await readTakeFile(requireValue(args, "take"));
  const instrument = await readInstrumentFile(requireValue(args, "instrument"));
  const events = eventsOf(take, instrument, eventOptions(args));
  if (args.flags.has("json")) {
    writers.out(jsonOr("", events, true));
  } else if (args.flags.has("quiet")) {
    writers.out(summary(label, instrument.name, events));
  } else {
    writers.out(`${summary(label, instrument.name, events)}\n${formatEvents(events)}`);
  }
  return 0;
}

/** `bench render` : events.json, render.wav et report.json dans un dossier. */
export async function runRender(argv: readonly string[], writers: Writers = PROCESS_WRITERS): Promise<number> {
  const args = parseArgs(argv, SPECS.render);
  if (wantsHelp(args)) {
    writers.out(commandHelp("render"));
    return 0;
  }
  const takePath = requireValue(args, "take");
  const instrumentPath = requireValue(args, "instrument");
  const outDir = requireValue(args, "out");
  const instrument = await readInstrumentFile(instrumentPath);
  const take = await readTakeFile(takePath);
  const rendered = await renderedTake(take, instrument, {
    ...eventOptions(args),
    takeName: takeLabel(takePath),
  });
  const wav = args.flags.has("no-wav") ? undefined : await wavOf(rendered);
  const written = writeRenderOut(rendered.report, outDir, wav, rendered.events);
  if (args.flags.has("quiet")) {
    writers.out(`${rendered.report.notes.length} note(s), ${written.length} fichier(s) dans ${outDir}`);
  } else {
    for (const path of written) writers.out(`écrit ${path} (${fileSize(path)} o)`);
    writers.out("");
  }
  return 0;
}

function readTwoReports(args: ParsedArgs): {
  readonly actual: ReturnType<typeof parseReport>;
  readonly expected: ReturnType<typeof parseReport>;
} {
  const [rapport, reference] = args.positionals;
  if (rapport === undefined || reference === undefined) {
    throw new UsageError("deux rapports sont attendus", "usage : bench compare <rapport> <référence>");
  }
  return {
    actual: parseReport(readJsonFile(rapport), rapport),
    expected: parseReport(readJsonFile(reference), reference),
  };
}

/** `bench compare` : 0 si tout est dans les tolérances, 1 au premier écart. */
export async function runCompare(argv: readonly string[], writers: Writers = PROCESS_WRITERS): Promise<number> {
  const args = parseArgs(argv, SPECS.compare);
  if (wantsHelp(args)) {
    writers.out(commandHelp("compare"));
    return 0;
  }
  const { actual, expected } = readTwoReports(args);
  const diffs = compareReports(actual, expected);
  if (args.flags.has("json")) {
    writers.out(JSON.stringify(diffs, null, 2));
  } else if (args.flags.has("quiet")) {
    writers.out(diffs.length === 0 ? "conforme" : `${diffs.length} écart(s)`);
  } else {
    writers.out(formatComparison(diffs));
  }
  return diffs.length === 0 ? 0 : 1;
}

function synthParams(args: ParsedArgs): Record<string, number> {
  const params: Record<string, number> = {};
  for (const name of SPECS.synth.values) {
    if (name === "out" || name === "quiet") continue;
    const value = numberValue(args, name);
    if (value === undefined) continue;
    const cle = name.replace(/-([a-z])/g, (_m, lettre: string) => lettre.toUpperCase());
    params[cle] = value;
  }
  return params;
}

function shapeOf(args: ParsedArgs): SynthShape {
  const shape = args.positionals[0];
  if (shape === undefined) {
    throw new UsageError("forme manquante", `formes : ${SYNTH_SHAPES.join(", ")}`);
  }
  if (!isSynthShape(shape)) {
    throw new UsageError(`forme inconnue : « ${shape} »`, `formes : ${SYNTH_SHAPES.join(", ")}`);
  }
  return shape;
}

function weighLine(weight: TakeWeight, binary: boolean): string {
  const parts = [
    `${fixed(weight.seconds, 2)} s`,
    `${weight.bytes} o`,
    `${fixed(weight.bytesPerSecond / 1024, 1)} Ko/s`,
  ];
  const verdict = binary
    ? "(codage compact, cahier §7.11 : ~7,6 Ko/s)"
    : weight.within
      ? "(cahier §7.11 : ~26 Ko/s en JSON brut)"
      : `écart au poids annoncé du cahier §7.11 (~26 Ko/s en JSON brut), rapport ×${fixed(weight.ratio, 2)}`;
  return `poids ${parts.join(" · ")} ${verdict}`;
}

/** `bench synth` : fabrique une prise et l'écrit (JSON, ou binaire compact). */
export async function runSynth(argv: readonly string[], writers: Writers = PROCESS_WRITERS): Promise<number> {
  const args = parseArgs(argv, SPECS.synth);
  if (wantsHelp(args)) {
    writers.out(commandHelp("synth"));
    return 0;
  }
  const shape = shapeOf(args);
  const take = synthTake(shape, synthParams(args));
  const binary = args.flags.has("binary");
  const path = optionalValue(args, "out") ?? `takes/synth/${shape}${binary ? ".take" : ".json"}`;
  if (binary) {
    const encoding = await loadEncoding();
    await pushOrExplain("le codage compact de la prise", "A4", async () => {
      writeBytesFile(path, encoding.encodeTake(take));
    });
  } else {
    writeJsonFile(path, take);
  }
  const weight = weighTake(take, fileSize(path));
  writers.out(args.flags.has("quiet") ? `${shape} → ${path}` : `${shape} → ${path}\n${weighLine(weight, binary)}`);
  return 0;
}

async function pushOrExplain<T>(what: string, lot: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isUnavailableContract(error)) {
      throw new BenchError(`${what} indisponible : ${String((error as Error).message)} — lot ${lot}`);
    }
    throw error;
  }
}

/** Les commandes, par nom, avec leur point d'entrée. */
export const COMMANDS: Readonly<Record<string, (argv: readonly string[], writers?: Writers) => Promise<number>>> = {
  events: runEvents,
  render: runRender,
  compare: runCompare,
  synth: runSynth,
};
