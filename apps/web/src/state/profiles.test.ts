import { describe, expect, it } from "vitest";
import {
  alphaFor,
  cutoffFor,
  DEFAULT_SETTINGS,
  defaultPlayRect,
  pitchFromU,
  toPlayPosition,
  type PlayRect,
  type Settings,
} from "@thin-air/core";
import {
  applyRect,
  applySettings,
  noProfileRect,
  PROFILES,
  PROFILS_ASSIS,
  PROFILS_TREMBLEMENT,
  PROFILS_UNE_MAIN,
  profileById,
} from "./profiles.js";

/** Les options de filtre d'un profil, complétées par les défauts (§7.5). */
function optionsDe(partiel: Partial<Settings>): { fcMin: number; beta: number; fcD: number } {
  return {
    fcMin: partiel.fcMin ?? DEFAULT_SETTINGS.fcMin,
    beta: partiel.beta ?? DEFAULT_SETTINGS.beta,
    fcD: partiel.fcD ?? DEFAULT_SETTINGS.fcD,
  };
}

describe("profils de mobilité (§3, §12.4, AIR-F-10 à 12, AIR-N-06)", () => {
  it("AIR-N-06 — il y a exactement trois profils, aux identifiants stables", () => {
    expect(PROFILES.map((p) => p.id)).toEqual(["seated", "oneHand", "tremor"]);
    for (const id of ["seated", "oneHand", "tremor"] as const) {
      expect(profileById(id).id).toBe(id);
    }
  });

  it("§3 — « assis, portée courte » : zone petite et proche du centre", () => {
    expect(PROFILS_ASSIS.playRect).not.toBeNull();
    const zone = PROFILS_ASSIS.playRect as PlayRect;
    // 40 % de l'image (moitié des 80 % centraux du défaut, AIR-F-08), centrée.
    expect(zone.u1 - zone.u0).toBeCloseTo(0.4);
    expect(zone.v1 - zone.v0).toBeCloseTo(0.4);
    expect(zone.u0).toBeCloseTo(0.3);
    expect(zone.v0).toBeCloseTo(0.3);
    // Un préréglage n'est pas une calibration : la date reste en blanc.
    expect(zone.calibratedAt).toBeNull();
  });

  it("AIR-F-10 — « une main » active le jeu à une main sans réduire la tessiture", () => {
    const reglages = applySettings(DEFAULT_SETTINGS, PROFILS_UNE_MAIN);
    expect(reglages.oneHand).toBe(true);
    // Le profil ne touche pas à la zone : la portée reste celle en place.
    expect(applyRect(defaultPlayRect(), PROFILS_UNE_MAIN)).toEqual(defaultPlayRect());

    // La tessiture vit dans le fichier d'instrument, pas dans un réglage :
    // même sur la zone la plus petite (celle d'« assis »), `u` couvre toujours
    // tout [0, 1], donc les notes couvrent toute l'étendue (§7.4, §7.7).
    const range = { low: 45, high: 81 }; // Phantom §7.8
    for (const rect of [defaultPlayRect(), PROFILS_ASSIS.playRect as PlayRect]) {
      const gauche = toPlayPosition(1 - rect.u0, 0.5, rect, 1);
      const droite = toPlayPosition(1 - rect.u1, 0.5, rect, 1);
      expect(gauche.u).toBeCloseTo(0, 5);
      expect(droite.u).toBeCloseTo(1, 5);
      expect(pitchFromU(gauche.u, range)).toBeCloseTo(range.low);
      expect(pitchFromU(droite.u, range)).toBeCloseTo(range.high);
    }
  });

  it("§12.4 — « mains qui tremblent » lisse plus fort que le défaut", () => {
    const te = 1 / DEFAULT_SETTINGS.frameRateIdeal; // 1/30 s, §7.5
    const defaut = optionsDe({});
    const tremble = optionsDe(PROFILS_TREMBLEMENT.settings);
    // À l'arrêt (vitesse nulle), la coupure vaut la coupure minimale : plus elle
    // est basse, plus α est petit, plus la sortie tient la valeur précédente —
    // c'est-à-dire plus le filtre lisse (§7.5 : α à l'arrêt = 0,24 à 30 img/s).
    const alphaDefaut = alphaFor(cutoffFor(defaut, 0), te);
    const alphaTremble = alphaFor(cutoffFor(tremble, 0), te);
    expect(alphaTremble).toBeLessThan(alphaDefaut);
  });

  it("chaque profil ne change que ce qu'il annonce, et rien d'autre", () => {
    for (const profil of PROFILES) {
      const applique = applySettings(DEFAULT_SETTINGS, profil);
      const annoncees = Object.keys(profil.settings) as (keyof Settings)[];
      expect([...profil.unchanged].sort()).toEqual(
        Object.keys(DEFAULT_SETTINGS)
          .filter((cle) => !(cle in profil.settings))
          .sort(),
      );
      for (const cle of profil.unchanged) {
        expect(applique[cle]).toBe(DEFAULT_SETTINGS[cle]);
      }
      for (const cle of annoncees) {
        expect(applique[cle]).toBe(profil.settings[cle]);
      }
    }
  });

  it("« aucun profil » rend la zone par défaut (AIR-F-08)", () => {
    expect(noProfileRect()).toEqual(defaultPlayRect());
  });
});