/**
 * Fuzz nocturne — chaîne complète, aucune oreille (lot t6, AIR-N-02).
 *
 * Usage : `node scripts/fuzz.mjs --runs N --seed S`
 *   - `--seed S` : graine de départ. La prise `i` (0 … N−1) a la graine
 *     `S + i` ; reproduire une prise fautive revient à lancer `--seed <graine>
 *     --runs 1`.
 *   - À la première violation, la prise fautive est écrite dans
 *     `out/fuzz/contre-exemple-<graine>.json` (dossier ignoré) et le script
 *     sort avec un code non nul.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Instrument, Settings, Take } from "@thin-air/core";
import { alea, processTake } from "@thin-air/core";
import { renderEvents } from "@thin-air/audio";
import { chargerInstrument, choisir, listerInstruments, lireArgs, optionsRenduAleatoires, plafondVoix, racineDepot, reglagesAleatoires } from "./commun.ts";
import { verifierEchantillons, verifierEvenements, verifierVoixZero, type Violation } from "./invariants.ts";
import { priseAleatoire } from "./prises-aleatoires.ts";

interface ContreExemple {
  readonly graine: number;
  readonly graineDepart: number;
  readonly rang: number;
  readonly invariant: string;
  readonly detail: string;
  readonly instrument: string;
  readonly reglages: Partial<Settings>;
  readonly rendu: { reverb: number; maxVoices: number };
  readonly prise: Take;
}

function ecrireContreExemple(contre: ContreExemple): string {
  const dossier = join(racineDepot(), "out", "fuzz");
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, `contre-exemple-${String(contre.graine)}.json`);
  writeFileSync(chemin, JSON.stringify(contre, null, 2) + "\n");
  return chemin;
}

/** Écrit le contre-exemple de la première violation, rend son chemin. */
function rendreContre(
  instrument: Instrument,
  reglages: Partial<Settings>,
  rendu: { reverb: number; maxVoices: number },
  graine: number,
  graineDepart: number,
  rang: number,
  violations: readonly Violation[],
  prise: Take,
): string {
  const premiere = violations[0]!;
  return ecrireContreExemple({
    graine,
    graineDepart,
    rang,
    invariant: premiere.invariant,
    detail: premiere.detail,
    instrument: instrument.name,
    reglages,
    rendu,
    prise,
  });
}

export async function fuzz(runs: number, seed: number): Promise<number> {
  const instruments = listerInstruments();
  const t0 = Date.now();
  let prisesSansEvenement = 0;
  for (let rang = 0; rang < runs; rang += 1) {
    const graine = seed + rang;
    const prise = priseAleatoire(graine);
    const rng = alea(graine);
    const instrumentNom = choisir(rng, instruments) as string;
    const instrument = chargerInstrument(instrumentNom);
    const reglages = reglagesAleatoires(rng);
    const rendu = optionsRenduAleatoires(rng);

    const evenements = processTake(prise, instrument, reglages);
    const plafond = plafondVoix(instrument, reglages);
    const violations = [...verifierVoixZero(evenements, plafond), ...verifierEvenements(evenements)];
    if (violations.length > 0) {
      const chemin = rendreContre(instrument, reglages, rendu, graine, seed, rang, violations, prise);
      process.stderr.write(`✗ prise ${String(rang + 1)}/${String(runs)} (graine ${String(graine)}, ${instrumentNom}) : ${violations[0]!.invariant} — ${violations[0]!.detail}\n`);
      process.stderr.write(`  contre-exemple écrit : ${chemin}\n`);
      return 1;
    }

    if (evenements.length === 0) {
      prisesSansEvenement += 1;
      continue;
    }

    const resultat = renderEvents(evenements, { instrument, reverb: rendu.reverb, maxVoices: rendu.maxVoices });
    const defautsRendu = verifierEchantillons(resultat.samples, -1);
    if (resultat.maxVoices > rendu.maxVoices) {
      defautsRendu.push({ invariant: "AIR-P-10", detail: `rendu ${String(resultat.maxVoices)} voix > ${String(rendu.maxVoices)}` });
    }
    if (defautsRendu.length > 0) {
      const chemin = rendreContre(instrument, reglages, rendu, graine, seed, rang, defautsRendu, prise);
      process.stderr.write(`✗ prise ${String(rang + 1)}/${String(runs)} (graine ${String(graine)}, ${instrumentNom}) : ${defautsRendu[0]!.invariant} — ${defautsRendu[0]!.detail}\n`);
      process.stderr.write(`  contre-exemple écrit : ${chemin}\n`);
      return 1;
    }
    if ((rang + 1) % 1000 === 0) {
      const duree = ((Date.now() - t0) / 1000).toFixed(1);
      process.stderr.write(`  … ${String(rang + 1)}/${String(runs)} prises en ${duree} s\n`);
    }
  }
  const duree = ((Date.now() - t0) / 1000).toFixed(1);
  process.stdout.write(`✓ ${String(runs)} prises, 0 violation — ${duree} s (${String(prisesSansEvenement)} prises sans événement)\n`);
  return 0;
}

const { runs, seed } = lireArgs(process.argv.slice(2));
process.exitCode = await fuzz(runs, seed);