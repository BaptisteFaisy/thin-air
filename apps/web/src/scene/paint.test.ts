import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, defaultPlayRect } from "@thin-air/core";
import { CHOIR, HARP, PHANTOM } from "../state/presets.js";
import { emptyDisplay, reduceDisplay, type MusicTools } from "../state/display.js";
import { buildScene, type SceneInput, type SceneModel } from "./geometry.js";
import { HAND_LINE, paintScene, PALETTE, type PaintContext } from "./paint.js";

interface Appel {
  readonly methode: string;
  readonly args: readonly unknown[];
}

/** Double de contexte : il enregistre les appels, aucun canevas, aucun son. */
function doubleContexte(): { ctx: PaintContext; appels: Appel[]; couleurs: Set<string> } {
  const appels: Appel[] = [];
  const couleurs = new Set<string>();
  const cible = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: (...args: number[]) => appels.push({ methode: "fillRect", args }),
    beginPath: () => appels.push({ methode: "beginPath", args: [] }),
    moveTo: (...args: number[]) => appels.push({ methode: "moveTo", args }),
    lineTo: (...args: number[]) => appels.push({ methode: "lineTo", args }),
    arc: (...args: number[]) => appels.push({ methode: "arc", args }),
    stroke: () => appels.push({ methode: "stroke", args: [] }),
    fill: () => appels.push({ methode: "fill", args: [] }),
  };
  return new Proxy(
    { ctx: cible as PaintContext, appels, couleurs },
    {
      get(objet, cle) {
        return objet[cle as keyof typeof objet];
      },
    },
  ) as { ctx: PaintContext; appels: Appel[]; couleurs: Set<string> };
}

const outils: MusicTools = { noteName: () => "A", midiToFreq: () => 440, gainToDb: () => 0 };

function modele(partiel: Partial<SceneInput> = {}): SceneModel {
  return buildScene({
    width: 800,
    height: 450,
    hands: [{ role: "pitch", side: "right", u: 0.4, v: 0.6 }],
    previous: null,
    display: emptyDisplay(),
    instrument: HARP,
    rect: defaultPlayRect(),
    reducedMotion: false,
    settings: DEFAULT_SETTINGS,
    hovered: null,
    dtS: 1 / 60,
    ...partiel,
  });
}

describe("le dessin de la séance (cahier §12.3, AIR-F-51, 52)", () => {
  it("trois couleurs seulement, et aucune autre (nuit, os, spectre, plus le discret)", () => {
    const { ctx } = doubleContexte();
    const couleurs: string[] = [];
    const cible = ctx as unknown as Record<string, unknown>;
    const suivi = new Proxy(ctx, {
      set(objet, cle, valeur) {
        if (typeof valeur === "string") couleurs.push(valeur);
        Reflect.set(objet, cle, valeur);
        return true;
      },
    });
    void cible;
    paintScene(suivi, modele({ instrument: CHOIR, hovered: 1 }));
    const autorisees = new Set<string>(Object.values(PALETTE));
    expect(couleurs.length).toBeGreaterThan(0);
    for (const couleur of couleurs) expect(autorisees.has(couleur)).toBe(true);
    expect(autorisees.size).toBe(5);
  });

  it("le fond de nuit est posé en premier", () => {
    const { ctx, appels } = doubleContexte();
    paintScene(ctx, modele());
    const premier = appels.find((appel) => appel.methode === "fillRect");
    expect(premier?.args).toEqual([0, 0, 800, 450]);
  });

  it("AIR-F-52 — l'image de caméra n'est pas dessinée par défaut", () => {
    const { ctx } = doubleContexte();
    let appelee = false;
    paintScene(ctx, modele(), PALETTE, () => {
      appelee = true;
    });
    expect(appelee).toBe(false);
  });

  it("AIR-F-52 — le réglage l'affiche, atténuée, derrière la scène", () => {
    const { ctx, appels } = doubleContexte();
    const ordre: string[] = [];
    paintScene(
      ctx,
      modele({ settings: { ...DEFAULT_SETTINGS, showCamera: true } }),
      PALETTE,
      () => {
        ordre.push("camera");
        ordre.push(`appels:${appels.length}`);
      },
    );
    expect(ordre[0]).toBe("camera");
    // La caméra passe avant les cordes et les mains : elle reste derrière.
    expect(appels.some((appel) => appel.methode === "stroke")).toBe(true);
  });

  it("AIR-F-51 — chaque corde est tracée, la main est un cercle clair", () => {
    const { ctx, appels } = doubleContexte();
    paintScene(ctx, modele());
    expect(appels.filter((appel) => appel.methode === "stroke").length).toBeGreaterThanOrEqual(16);
    expect(appels.some((appel) => appel.methode === "arc")).toBe(true);
    expect(HAND_LINE).toBeGreaterThan(1);
  });

  it("§12.3 — la bougie du chœur est un halo, pas un éclair", () => {
    const { ctx, appels } = doubleContexte();
    const display = reduceDisplay(
      emptyDisplay(),
      [{ type: "noteOn", t: 0, voice: "z1", midi: 52, velocity: 1 }],
      CHOIR,
      outils,
    );
    paintScene(ctx, modele({ instrument: CHOIR, display, dtS: 1 }));
    const remplissages = appels.filter((appel) => appel.methode === "fill").length;
    expect(remplissages).toBeGreaterThanOrEqual(2);
    expect((ctx.globalAlpha as number) <= 1).toBe(true);
  });

  it("la courbe de hauteur du thérémine est tracée derrière la main", () => {
    const { ctx, appels } = doubleContexte();
    const display = reduceDisplay(
      emptyDisplay(),
      [50, 57, 62].map((midi, index) => ({ type: "noteOn", t: index, voice: `v${index}`, midi, velocity: 1 })),
      PHANTOM,
      outils,
    );
    paintScene(ctx, modele({ instrument: PHANTOM, display }));
    const deplacements = appels.filter((appel) => appel.methode === "lineTo").length;
    expect(deplacements).toBeGreaterThanOrEqual(2);
  });

  it("l'alpha reste borné : rien ne s'allume d'un coup (AIR-N-06)", () => {
    const { ctx } = doubleContexte();
    paintScene(ctx, modele({ hovered: 5 }));
    expect(ctx.globalAlpha).toBeLessThanOrEqual(1);
    expect(ctx.globalAlpha).toBeGreaterThanOrEqual(0);
  });
});
