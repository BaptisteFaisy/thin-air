/**
 * Les invariants que le fuzz vérifie sur chaque prise (lot t6).
 *
 * Vérifiés au niveau des événements (`processTake`) puis des échantillons
 * (`renderEvents`). Ce sont les invariants qui doivent tenir PARTOUT, nommés
 * d'après les propriétés du cahier : AIR-P-09 (aucune voix active à la fin),
 * AIR-P-10 (voix ≤ plafond), AIR-P-11 (instants non décroissants), aucune
 * valeur non numérique, crête ≤ −1 dB (AIR-P-13).
 */
import type { MusicEvent } from "@thin-air/core";
import { dbToLinear } from "@thin-air/audio";

/** Une propriété violée, avec sa valeur mesurée et le contexte. */
export interface Violation {
  readonly invariant: string;
  readonly detail: string;
}

/** Voix encore « actives » à la fin : un `noteOn` sans `noteOff` (AIR-P-09). */
export function voixRestantes(evenements: readonly MusicEvent[]): Set<string> {
  const actives = new Set<string>();
  for (const e of evenements) {
    if (e.type === "noteOn") actives.add(e.voice);
    else if (e.type === "noteOff") actives.delete(e.voice);
  }
  return actives;
}

/** Le plus grand nombre de voix actives simultanément (AIR-P-10). */
export function voixMax(evenements: readonly MusicEvent[]): number {
  const actives = new Set<string>();
  let max = 0;
  for (const e of evenements) {
    if (e.type === "noteOn") actives.add(e.voice);
    else if (e.type === "noteOff") actives.delete(e.voice);
    max = Math.max(max, actives.size);
  }
  return max;
}

/** Vrais si chaque nombre attendu est fini. */
function nombreFini(valeur: unknown): boolean {
  return typeof valeur !== "number" || Number.isFinite(valeur);
}

/** AIR-P-09 : aucune voix ne reste enclenchée après `finish`. */
export function verifierVoixZero(evenements: readonly MusicEvent[], plafond: number): Violation[] {
  const restantes = voixRestantes(evenements);
  if (restantes.size > 0) {
    return [{ invariant: "AIR-P-09", detail: `${String(restantes.size)} voix actives à la fin : ${[...restantes].join(", ")}` }];
  }
  const maximales = voixMax(evenements);
  if (maximales > plafond) {
    return [{ invariant: "AIR-P-10", detail: `crête ${String(maximales)} voix > plafond ${String(plafond)}` }];
  }
  return [];
}

/** AIR-P-11 + valeurs finies : instants non décroissants, aucun NaN/Infinity. */
export function verifierEvenements(evenements: readonly MusicEvent[]): Violation[] {
  const defauts: Violation[] = [];
  let precedent = -Infinity;
  for (const e of evenements) {
    if (!nombreFini(e.t)) defauts.push({ invariant: "NaN/Infinity", detail: `t non fini sur ${JSON.stringify(e)}` });
    if (e.t < precedent) {
      defauts.push({ invariant: "AIR-P-11", detail: `instant décroissant : ${String(e.t)} < ${String(precedent)}` });
    }
    precedent = e.t;
    const nombres = e.type === "noteOn" ? [e.midi, e.velocity] : e.type === "control" ? [e.value] : [];
    for (const n of nombres) {
      if (!nombreFini(n)) defauts.push({ invariant: "NaN/Infinity", detail: `valeur non finie sur ${JSON.stringify(e)}` });
    }
  }
  return defauts;
}

/** Crête absolue d'un tableau d'échantillons et échantillons non finis. */
export function verifierEchantillons(echantillons: Float32Array, plafondDb: number): Violation[] {
  let crete = 0;
  for (let i = 0; i < echantillons.length; i += 1) {
    const v = echantillons[i]!;
    if (!Number.isFinite(v)) return [{ invariant: "NaN/Infinity", detail: `échantillon non fini à l'indice ${String(i)}` }];
    const absolu = Math.abs(v);
    if (absolu > crete) crete = absolu;
  }
  const borne = dbToLinear(plafondDb) * (1 + 1e-6);
  if (crete > borne) {
    const db = 20 * Math.log10(crete);
    return [{ invariant: "AIR-P-13", detail: `crête ${String(db.toFixed(3))} dB > ${String(plafondDb)} dB` }];
  }
  return [];
}