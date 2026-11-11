/**
 * Les instruments livrés (cahier §7.8, AIR-F-21) : les fichiers
 * `instruments/*.json` du dépôt, embarqués au build par Vite. Site statique :
 * aucun serveur, aucune requête tierce (AIR-N-01). Chaque fichier est validé
 * par le schéma du lot A4 au chargement — un fichier refusé n'entre pas dans
 * la liste, il ne devient jamais un instrument par défaut silencieux.
 */
import type { Instrument } from "@thin-air/core";
import { parseInstrument } from "@thin-air/schema";

/** L'ordre du cahier §7.8 : indispensables, puis souhaitables, puis option. */
const ORDRE: readonly string[] = ["Phantom", "Harp", "Choir", "Bells", "Drone", "Grid drums"];

/**
 * Les fichiers JSON, lus au build. `import.meta.glob` est résolu par Vite :
 * en test comme en production, le contenu est dans le paquet, jamais chargé
 * par le réseau.
 */
const MODULES = import.meta.glob("../../../../instruments/*.json", {
  eager: true,
}) as Record<string, { default: unknown }>;

/** Fonction pure : des fichiers bruts vers la liste triée et validée. */
export function chargerLivres(fichiers: Record<string, unknown>): readonly Instrument[] {
  const valides: Instrument[] = [];
  for (const cle of Object.keys(fichiers).sort()) {
    const resultat = parseInstrument(fichiers[cle]);
    if (resultat.ok) valides.push(resultat.value);
  }
  return valides.sort((a, b) => rang(a.name) - rang(b.name));
}

function rang(nom: string): number {
  const index = ORDRE.indexOf(nom);
  return index < 0 ? ORDRE.length : index;
}

export const BUILT_IN: readonly Instrument[] = chargerLivres(
  Object.fromEntries(Object.entries(MODULES).map(([chemin, module]) => [chemin, module.default])),
);

export function builtInByName(name: string): Instrument | null {
  return BUILT_IN.find((instrument) => instrument.name === name) ?? null;
}

export function isBuiltInName(name: string): boolean {
  return BUILT_IN.some((instrument) => instrument.name === name);
}

/** L'instrument de départ : le premier livré (Phantom, §7.8). */
export function premierLivre(): Instrument | null {
  return BUILT_IN[0] ?? null;
}
