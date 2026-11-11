/**
 * Budget de performance (lot t6) — mesure la chaîne hors ligne, sans écran.
 *
 * Mesure le MINIMUM chaud (sur plusieurs répétitions) de :
 *   - `processTake` sur la prise de référence (3 s à 30 im/s, instrument
 *     `phantom`) ;
 *   - `renderEvents` de ces mêmes événements, à 48 kHz.
 *
 * Compare aux budgets de `perf-budget.json` (racine). Dépasse ? code non nul.
 * `--etalonner` recalcule les budgets (minimum × 1,25) et réécrit le fichier :
 * c'est ainsi que le budget est fixé puis révisé (voir `docs/fuzz.md`).
 * Les mesures brutes sont écrites dans `out/perf/mesures.json` (dossier ignoré).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Instrument } from "@thin-air/core";
import { processTake, SAMPLE_RATE } from "@thin-air/core";
import { renderEvents } from "@thin-air/audio";
import { chargerInstrument, lireArgs, priseDeReference, racineDepot } from "./commun.ts";

interface Budget {
  readonly comment: string;
  readonly version: number;
  readonly reference: Record<string, number | string>;
  readonly marge: number;
  readonly budgetMs: { processTake: number; renderEvents: number };
  readonly mesuresInitialesMs: { processTake: number; renderEvents: number };
}

function defaut(): Budget {
  return {
    comment: "",
    version: 1,
    reference: { dureeS: 3, fps: 30, sampleRate: SAMPLE_RATE, instrument: "phantom" },
    marge: 0.25,
    budgetMs: { processTake: 0, renderEvents: 0 },
    mesuresInitialesMs: { processTake: 0, renderEvents: 0 },
  };
}

function cheminBudget(): string {
  return join(racineDepot(), "perf-budget.json");
}

/** Lit le budget ; recrée un budget vide si le fichier manque. */
function lireBudget(): Budget {
  const chemin = cheminBudget();
  if (!existsSync(chemin)) return defaut();
  return { ...defaut(), ...(JSON.parse(readFileSync(chemin, "utf8")) as Budget) };
}

function minimum(valeurs: readonly number[]): number {
  return Math.min(...valeurs);
}

/**
 * Répétitions avec chauffe : la première exécution paie les allocations,
 * les suivantes donnent le plancher. On retient le MINIMUM, qui reflète la
 * vitesse réelle du moteur et non la contention passagère des autres
 * processus — sur un runner auto-hébergé partagé, la médiane serait faussée
 * par les pauses d'ordonnancement, pas par une régression du code.
 */
function mesure(fn: () => number, repetitions: number): number[] {
  const valeurs: number[] = [];
  for (let i = 0; i < repetitions; i += 1) valeurs.push(fn());
  return valeurs;
}

function outDossier(): string {
  const dossier = join(racineDepot(), "out", "perf");
  mkdirSync(dossier, { recursive: true });
  return dossier;
}

interface MesuresBrutes {
  readonly repetitionsProcess: number;
  readonly repetitionsRendu: number;
  readonly tempsProcess: readonly number[];
  readonly tempsRendu: readonly number[];
  readonly minProcess: number;
  readonly minRendu: number;
}

/** Chauffe puis répétitions ; rend toutes les mesures et les minimums. */
function mesurerEtages(
  instrument: Instrument,
  prise: ReturnType<typeof priseDeReference>,
  evenements: ReturnType<typeof processTake>,
): MesuresBrutes {
  const repetitionsProcess = 50;
  const repetitionsRendu = 100;
  // Chauffe : la première exécution paie les allocations et le chargement des
  // modules de synthèse ; elle n'entre pas dans les mesures.
  processTake(prise, instrument, {});
  renderEvents(evenements, { instrument });
  const tempsProcess = mesure(() => {
    const debut = performance.now();
    processTake(prise, instrument, {});
    return performance.now() - debut;
  }, repetitionsProcess);
  const tempsRendu = mesure(() => {
    const debut = performance.now();
    renderEvents(evenements, { instrument });
    return performance.now() - debut;
  }, repetitionsRendu);
  return {
    repetitionsProcess,
    repetitionsRendu,
    tempsProcess,
    tempsRendu,
    minProcess: minimum(tempsProcess),
    minRendu: minimum(tempsRendu),
  };
}

/** Budget ciblé : recalcule (et réécrit) si `--etalonner` ou budget absent. */
function budgetCible(budget: Budget, m: MesuresBrutes, etalonner: boolean): Budget {
  if (!etalonner && budget.budgetMs.processTake !== 0) return budget;
  const marge = budget.marge;
  const cible: Budget = {
    ...budget,
    budgetMs: {
      // Arrondi au supérieur : le budget ne descend jamais sous la mesure.
      processTake: Math.max(2, Math.ceil(m.minProcess * (1 + marge))),
      renderEvents: Math.max(2, Math.ceil(m.minRendu * (1 + marge))),
    },
    mesuresInitialesMs: {
      processTake: +m.minProcess.toFixed(3),
      renderEvents: +m.minRendu.toFixed(3),
    },
    comment:
      "Budget = minimum chaud × 1,25, arrondi au supérieur (ligne « mesuresInitialesMs » conservée). Révise avec `node scripts/perf-budget.mjs --etalonner` sur la machine cible au repos.",
  };
  writeFileSync(cheminBudget(), JSON.stringify(cible, null, 2) + "\n");
  return cible;
}

/** Écrit les mesures brutes dans `out/perf/mesures.json` (dossier ignoré). */
function ecrireMesures(budget: Budget, m: MesuresBrutes, etalonner: boolean): void {
  const mesures = {
    horodatage: new Date().toISOString(),
    reference: budget.reference,
    prise: "3 s, 30 im/s, linear",
    repetitionsProcess: m.repetitionsProcess,
    repetitionsRendu: m.repetitionsRendu,
    tempsProcessMs: m.tempsProcess,
    tempsRenduMs: m.tempsRendu,
    minProcessMs: +m.minProcess.toFixed(3),
    minRenduMs: +m.minRendu.toFixed(3),
    budgetMs: budget.budgetMs,
    etalonner,
  };
  writeFileSync(join(outDossier(), "mesures.json"), JSON.stringify(mesures, null, 2) + "\n");
}

/** Affiche chaque étage face à son budget ; rend 1 si l'un dépasse. */
function rapporter(m: MesuresBrutes, budget: Budget, etalonner: boolean): number {
  const lignes = [
    [m.minProcess, budget.budgetMs.processTake, "processTake"],
    [m.minRendu, budget.budgetMs.renderEvents, "renderEvents"],
  ] as const;
  for (const [mesuree, plafond, nom] of lignes) {
    const statut = mesuree > plafond ? "✗ DÉPASSÉ" : "✓";
    process.stdout.write(`${statut} ${nom} : ${mesuree.toFixed(2)} ms (budget ${String(plafond)} ms)\n`);
  }
  if (etalonner) process.stdout.write(`budget réécrit : ${cheminBudget()}\n`);
  if (lignes.some(([mesuree, plafond]) => mesuree > plafond)) {
    process.stderr.write("budget de performance dépassé — voir out/perf/mesures.json\n");
    return 1;
  }
  return 0;
}

export function perf(etalonner: boolean): number {
  const instrument: Instrument = chargerInstrument("instruments/phantom.json");
  const prise = priseDeReference();
  const evenements = processTake(prise, instrument, {});
  const m = mesurerEtages(instrument, prise, evenements);
  const budget = budgetCible(lireBudget(), m, etalonner);
  ecrireMesures(budget, m, etalonner);
  return rapporter(m, budget, etalonner);
}

const { etalonner } = lireArgs(process.argv.slice(2));
process.exitCode = perf(etalonner);