#!/usr/bin/env -S tsx
/**
 * Fige les prises de référence du cahier §13.3 dans `takes/reference/`.
 *
 *   npx tsx apps/bench/src/make-reference-takes.ts [--check] [--dir <dossier>]
 *
 * `--check` ne réécrit rien : il compare le fichier sur disque à ce que le
 * générateur produit aujourd'hui, et rend 1 au moindre écart. C'est la garde
 * contre une prise qui dériverait sans que personne ne s'en aperçoive.
 *
 * Aucune caméra, aucun son : des trajectoires calculées, écrites en JSON, puis
 * relues pour mesurer leur poids (cahier §7.11).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Take } from "@thin-air/core";

import { REFERENCE_TAKES, REFERENCE_TAKE_NAMES } from "./takes.js";
import type { ReferenceTakeSpec } from "./takes.js";
import { weighTake } from "./weight.js";
import { formatBytes, fixed } from "./format.js";

const DEFAUT = "takes/reference";

interface Options {
  readonly check: boolean;
  readonly dir: string;
}

function options(argv: readonly string[]): Options {
  let check = false;
  let dir = DEFAUT;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--check") check = true;
    else if (token === "--dir") {
      const valeur = argv[i + 1];
      if (valeur === undefined) throw new Error("--dir attend un dossier");
      dir = valeur;
      i += 1;
    } else if (token === "--help" || token === "-h") {
      process.stdout.write("usage : make-reference-takes [--check] [--dir <dossier>]\n");
      process.exit(0);
    } else {
      throw new Error(`argument inconnu : ${token}`);
    }
  }
  return { check, dir };
}

function serialise(take: Take): string {
  return `${JSON.stringify(take, null, 1)}\n`;
}

function cheminDe(dir: string, spec: ReferenceTakeSpec): string {
  return join(dir, `${spec.name}.json`);
}

/** Écrit, ou vérifie, une prise. Rend le nombre d'écarts vus. */
function handle(spec: ReferenceTakeSpec, take: Take, opts: Options): number {
  const texte = serialise(take);
  const chemin = cheminDe(opts.dir, spec);
  const poids = weighTake(take, Buffer.byteLength(texte, "utf8"));
  const poidsTexte =
    `poids ${formatBytes(poids.bytes)} sur ${fixed(poids.seconds, 2)} s, ` +
    `${fixed(poids.bytesPerSecond / 1024, 1)} Ko/s` +
    (poids.within ? "" : ` — ÉCART au cahier §7.11 (~26 Ko/s), ×${fixed(poids.ratio, 2)}`);

  if (opts.check) {
    let actuel = "";
    try {
      actuel = readFileSync(chemin, "utf8");
    } catch {
      process.stdout.write(`✗ ${spec.name} — fichier absent (${chemin})\n`);
      return 1;
    }
    if (actuel !== texte) {
      process.stdout.write(`✗ ${spec.name} — le fichier ne correspond plus au générateur\n`);
      return 1;
    }
    process.stdout.write(`✓ ${spec.name} — ${poidsTexte}\n`);
    return 0;
  }

  writeFileSync(chemin, texte, "utf8");
  process.stdout.write(`écrit ${chemin} (${take.frames.length} images, ${poidsTexte})\n`);
  return 0;
}

function main(): number {
  const opts = options(process.argv.slice(2));
  mkdirSync(opts.dir, { recursive: true });
  let ecarts = 0;
  for (const spec of REFERENCE_TAKES) {
    try {
      ecarts += handle(spec, spec.build(), opts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`✗ ${spec.name} — ${message}\n`);
      ecarts += 1;
    }
  }
  process.stdout.write(
    opts.check
      ? `${REFERENCE_TAKE_NAMES.length} prises vérifiées, ${ecarts} écart(s)\n`
      : `${REFERENCE_TAKE_NAMES.length} prises dans ${opts.dir}\n`,
  );
  return ecarts === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`échec : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
