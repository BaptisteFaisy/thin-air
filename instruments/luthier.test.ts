/**
 * Le banc du luthier (cahier §14.4 ; `docs/luthier.md`) : dix instruments-
 * fichiers nés chacun d'une phrase de description, ajoutés aux six du §7.8.
 *
 * Trois vérifications, sans rien faire sonner (AIR-N-02) — le rendu est
 * calculé dans un tableau, jamais dans un haut-parleur :
 *  1. chaque `instruments/*.json` passe `parseInstrument` (schéma strict,
 *     AIR-F-43 : un champ inconnu refuse le fichier entier) ;
 *  2. les seize fichiers et leurs noms sont uniques, liste épinglée ici ;
 *  3. chacun se rend sans exception sur au moins une prise de référence, et
 *     les dix du luthier y sonnent pour de vrai : une crête finie et au moins
 *     un palier mesurable. `docs/luthier.md` recopie les nombres réels.
 *
 * Le banc rend à 16 kHz : les rapports restent conformes (mêmes paliers,
 * mêmes instruments sonnants) et les seize rendus tiennent en ~1 s. Les prises
 * des historiques muets (Choir, Bells, Grid drums sur ces prises) ne prouvent
 * que l'absence d'exception, pas le son — c'est dit plutôt que masqué.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Instrument, Take } from "@thin-air/core";
import { parseInstrument } from "@thin-air/schema";
import { renderedTake } from "../apps/bench/src/render.js";

const DOSSIER = fileURLToPath(new URL(".", import.meta.url));
const RACINE = fileURLToPath(new URL("../", import.meta.url));

const SIX = ["bells", "choir", "drone", "grid-drums", "harp", "phantom"];
const DIX = ["chimes", "dulcimer", "flute", "ghost", "glass", "gong", "koto", "organ", "pad", "tabla"];
const TOUS = [...SIX, ...DIX].sort();

/** La prise où chaque instrument se rend (celle de `docs/luthier.md`). */
const PRISE: Readonly<Record<string, string>> = {
  bells: "two-hands-cross",
  chimes: "slow-rise",
  choir: "two-hands-cross",
  drone: "slow-rise",
  dulcimer: "fast-jab",
  flute: "slow-rise",
  ghost: "left-hand-only",
  glass: "left-hand-only",
  "grid-drums": "fast-jab",
  gong: "fast-jab",
  harp: "fast-jab",
  koto: "fast-jab",
  organ: "left-hand-only",
  pad: "slow-rise",
  phantom: "left-hand-only",
  tabla: "harp-sweep",
};

const TAUX = 16_000;

function lireBrut(nom: string): unknown {
  return JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
}

function lireInstrument(nom: string): Instrument {
  const resultat = parseInstrument(lireBrut(nom));
  if (!resultat.ok) throw new Error(`${nom}.json refusé : ${resultat.reasons.join(" ; ")}`);
  return resultat.value;
}

function lirePrise(nom: string): Take {
  return JSON.parse(readFileSync(join(RACINE, "takes", "reference", `${nom}.json`), "utf8")) as Take;
}

describe("les seize instruments passent le schéma strict", () => {
  it("le dossier contient exactement les seize fichiers attendus", () => {
    const presents = readdirSync(DOSSIER)
      .filter((nom) => nom.endsWith(".json"))
      .map((nom) => nom.replace(/\.json$/, ""))
      .sort();
    expect(presents).toEqual(TOUS);
  });

  it.each(TOUS)("%s.json passe parseInstrument", (nom) => {
    const resultat = parseInstrument(lireBrut(nom));
    expect(resultat.ok, resultat.ok ? "" : resultat.reasons.join(" ; ")).toBe(true);
  });

  it("les seize noms d'instruments sont uniques", () => {
    const noms = TOUS.map((nom) => lireInstrument(nom).name);
    expect(new Set(noms).size).toBe(TOUS.length);
  });
});

describe("chacun se rend sur sa prise de référence, sans exception", () => {
  it.each(TOUS)("%s se rend sur la prise de `docs/luthier.md`", async (nom) => {
    const instrument = lireInstrument(nom);
    const prise = PRISE[nom]!;
    const { report } = await renderedTake(lirePrise(prise), instrument, {
      sampleRate: TAUX,
      takeName: prise,
    });
    expect(report.samples).toBeGreaterThan(0);
    expect(report.durationS).toBeGreaterThan(0);
    expect(report.silenceAfterMs).toBeGreaterThanOrEqual(0);
    if (!DIX.includes(nom)) return;
    // Les dix du luthier sonnent : une crête finie et un palier mesurable.
    expect(Number.isFinite(report.peakDb), `${nom} muet sur ${prise}`).toBe(true);
    expect(report.notes.length).toBeGreaterThanOrEqual(1);
    expect(report.maxVoices).toBeGreaterThanOrEqual(1);
  });
});
