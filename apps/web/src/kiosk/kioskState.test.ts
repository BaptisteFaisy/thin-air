/**
 * Les transitions du mode kiosque (LOT t7). Aucune attente réelle : le temps
 * est passé dans les événements, donc une nuit de borne se rejoue en quelques
 * appels (AIR-N-09). Aucun son : la machine ne fait que décider.
 */
import { describe, expect, it } from "vitest";
import {
  RETOUR_FANTOME_MS,
  initialKioskState,
  reduceKiosk,
  type KioskEvent,
  type KioskState,
} from "./kioskState.js";

/** Rejoue une suite d'événements et rend le dernier état + toutes les actions. */
function jouer(
  evenements: readonly KioskEvent[],
  depart: KioskState = initialKioskState(),
): { state: KioskState; actions: readonly string[] } {
  let state = depart;
  const actions: string[] = [];
  for (const evenement of evenements) {
    const transition = reduceKiosk(state, evenement);
    state = transition.state;
    actions.push(...transition.actions);
  }
  return { state, actions };
}

describe("kioskState — le cycle de la borne (P11, AIR-F-50)", () => {
  it("démarre dans idle, sans fantôme ni message", () => {
    const state = initialKioskState();
    expect(state.phase).toBe("idle");
    expect(state.ghost).toBe(false);
    expect(state.fault).toBeNull();
  });

  it("le premier battement allume le fantôme", () => {
    const { state, actions } = jouer([{ type: "tick", atMs: 0 }]);
    expect(state.phase).toBe("idle");
    expect(state.ghost).toBe(true);
    expect(actions).toEqual(["ghostStart"]);
  });

  it("une main paraît : le fantôme s'arrête, la borne passe en occupied", () => {
    const { state, actions } = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 5_000 },
    ]);
    expect(state.phase).toBe("occupied");
    expect(state.ghost).toBe(false);
    expect(actions).toContain("ghostStop");
  });

  it("la main repart : returning, puis le fantôme revient après le délai", () => {
    const depart = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 1_000 },
      { type: "handGone", atMs: 4_000 },
    ]).state;
    expect(depart.phase).toBe("returning");
    expect(depart.lastHandMs).toBe(4_000);

    const tropTot = reduceKiosk(depart, { type: "tick", atMs: 4_000 + RETOUR_FANTOME_MS - 1 });
    expect(tropTot.state.phase).toBe("returning");
    expect(tropTot.actions).toEqual([]);

    const retour = reduceKiosk(depart, { type: "tick", atMs: 4_000 + RETOUR_FANTOME_MS });
    expect(retour.state.phase).toBe("idle");
    expect(retour.actions).toEqual(["ghostStart"]);
  });

  it("allers-retours rapides : une main qui apparaît et disparaît ne relance jamais le fantôme", () => {
    const { state, actions } = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 1_000 },
      { type: "handGone", atMs: 1_200 },
      { type: "handSeen", atMs: 1_400 },
      { type: "handGone", atMs: 1_600 },
      { type: "handSeen", atMs: 1_800 },
      { type: "tick", atMs: 2_000 },
      { type: "tick", atMs: 5_000 },
    ]);
    expect(state.phase).toBe("occupied");
    // Le fantôme s'est tu une seule fois (première main), jamais rallumé entre-temps.
    expect(actions.filter((action) => action === "ghostStart")).toHaveLength(1);
    expect(actions.filter((action) => action === "ghostStop")).toHaveLength(1);
  });

  it("le délai de retour repart de zéro après chaque passage de main", () => {
    let state = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 1_000 },
      { type: "handGone", atMs: 2_000 },
    ]).state;
    state = reduceKiosk(state, { type: "handSeen", atMs: 9_000 }).state;
    const partie = reduceKiosk(state, { type: "handGone", atMs: 9_500 }).state;
    const pasEncore = reduceKiosk(partie, { type: "tick", atMs: 9_500 + RETOUR_FANTOME_MS - 1 });
    expect(pasEncore.state.phase).toBe("returning");
    const maintenant = reduceKiosk(partie, { type: "tick", atMs: 9_500 + RETOUR_FANTOME_MS });
    expect(maintenant.state.phase).toBe("idle");
  });
});

describe("kioskState — l'état dégradé (§12.2, AIR-N-08)", () => {
  it("caméra perdue pendant qu'une main joue : degraded, notes relâchées, message", () => {
    const occupee = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 1_000 },
    ]).state;
    const { state, actions } = jouer([{ type: "cameraLost" }], occupee);
    expect(state.phase).toBe("degraded");
    expect(state.fault).toBe("cameraLost");
    expect(actions).toContain("releaseAll");
    expect(actions).toContain("messageShow");
  });

  it("le fantôme continue en degraded : il se rallume au battement suivant", () => {
    const occupee = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 1_000 },
    ]).state;
    const degrade = jouer([{ type: "cameraLost" }], occupee).state;
    expect(degrade.ghost).toBe(false);
    const { state, actions } = jouer([{ type: "tick", atMs: 2_000 }], degrade);
    expect(state.phase).toBe("degraded");
    expect(state.ghost).toBe(true);
    expect(actions).toEqual(["ghostStart"]);
  });

  it("caméra refusée au démarrage : degraded, et le fantôme joue quand même", () => {
    const { state, actions } = jouer([
      { type: "cameraDenied" },
      { type: "tick", atMs: 1_000 },
    ]);
    expect(state.phase).toBe("degraded");
    expect(state.fault).toBe("cameraDenied");
    expect(state.ghost).toBe(true);
    expect(actions).toContain("messageShow");
    expect(actions).toContain("ghostStart");
  });

  it("erreur du modèle : degraded avec sa cause", () => {
    const { state } = jouer([{ type: "modelError" }]);
    expect(state.phase).toBe("degraded");
    expect(state.fault).toBe("modelError");
  });

  it("caméra rétablie : le message s'efface, le délai de retour recommence", () => {
    const degrade = jouer([{ type: "cameraDenied" }, { type: "tick", atMs: 0 }]).state;
    const { state, actions } = jouer([{ type: "cameraBack", atMs: 60_000 }], degrade);
    expect(state.phase).toBe("returning");
    expect(state.fault).toBeNull();
    expect(actions).toEqual(["messageHide"]);
    const main = reduceKiosk(state, { type: "handSeen", atMs: 61_000 });
    expect(main.state.phase).toBe("occupied");
  });

  it("une main vue pendant degraded ramène à occupied : la caméra remarche", () => {
    const degrade = jouer([{ type: "cameraLost" }, { type: "tick", atMs: 0 }]).state;
    const { state, actions } = jouer([{ type: "handSeen", atMs: 5_000 }], degrade);
    expect(state.phase).toBe("occupied");
    expect(state.fault).toBeNull();
    expect(actions).toContain("ghostStop");
    expect(actions).toContain("messageHide");
  });
});

describe("kioskState — onglet masqué puis visible (AIR-N-08)", () => {
  it("onglet masqué : tout est relâché, le fantôme se met en pause", () => {
    const joue = jouer([{ type: "tick", atMs: 0 }]).state;
    const { state, actions } = jouer([{ type: "tabHidden", atMs: 1_000 }], joue);
    expect(state.tabHidden).toBe(true);
    expect(state.ghost).toBe(false);
    expect(actions).toEqual(["releaseAll", "ghostStop"]);
  });

  it("pendant l'onglet masqué, aucun autre événement ne change rien", () => {
    const masquee = jouer([
      { type: "tick", atMs: 0 },
      { type: "tabHidden", atMs: 1_000 },
    ]).state;
    const { state, actions } = jouer(
      [
        { type: "handSeen", atMs: 2_000 },
        { type: "handGone", atMs: 3_000 },
        { type: "tick", atMs: 4_000 },
      ],
      masquee,
    );
    expect(state).toEqual(masquee);
    expect(actions).toEqual([]);
  });

  it("onglet visible en idle : le fantôme reprend tout de suite", () => {
    const masquee = jouer([
      { type: "tick", atMs: 0 },
      { type: "tabHidden", atMs: 1_000 },
    ]).state;
    const { state, actions } = jouer([{ type: "tabVisible", atMs: 600_000 }], masquee);
    expect(state.tabHidden).toBe(false);
    expect(state.phase).toBe("idle");
    expect(state.ghost).toBe(true);
    expect(actions).toEqual(["ghostStart"]);
  });

  it("onglet visible pendant une partie : returning, délai recompté de zéro", () => {
    let state = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 1_000 },
      { type: "tabHidden", atMs: 2_000 },
    ]).state;
    const visible = reduceKiosk(state, { type: "tabVisible", atMs: 90_000 });
    state = visible.state;
    expect(state.phase).toBe("returning");
    expect(visible.actions).toEqual([]);
    const tropTot = reduceKiosk(state, { type: "tick", atMs: 90_000 + RETOUR_FANTOME_MS - 1 });
    expect(tropTot.state.phase).toBe("returning");
    const retour = reduceKiosk(state, { type: "tick", atMs: 90_000 + RETOUR_FANTOME_MS });
    expect(retour.state.phase).toBe("idle");
    expect(retour.actions).toEqual(["ghostStart"]);
  });

  it("onglet visible en degraded : le fantôme reprend, le message reste", () => {
    const state = jouer([
      { type: "cameraDenied" },
      { type: "tabHidden", atMs: 1_000 },
    ]).state;
    const { state: apres, actions } = jouer([{ type: "tabVisible", atMs: 2_000 }], state);
    expect(apres.phase).toBe("degraded");
    expect(apres.ghost).toBe(true);
    expect(apres.fault).toBe("cameraDenied");
    expect(actions).toEqual(["ghostStart"]);
  });
});

describe("kioskState — une nuit entière", () => {
  it("douze heures de battements sans main : le fantôme joue, jamais de message", () => {
    let state = initialKioskState();
    const nuitMs = 12 * 60 * 60 * 1_000;
    for (let atMs = 0; atMs <= nuitMs; atMs += 1_000) {
      state = reduceKiosk(state, { type: "tick", atMs }).state;
    }
    expect(state.phase).toBe("idle");
    expect(state.ghost).toBe(true);
    expect(state.fault).toBeNull();
  });

  it("visiteur nocturne : la chaîne idle → occupied → returning → idle", () => {
    const { state, actions } = jouer([
      { type: "tick", atMs: 0 },
      { type: "handSeen", atMs: 3_600_000 },
      { type: "handGone", atMs: 3_660_000 },
      { type: "tick", atMs: 3_660_000 + RETOUR_FANTOME_MS },
    ]);
    expect(state.phase).toBe("idle");
    expect(state.ghost).toBe(true);
    expect(actions).toEqual(["ghostStart", "ghostStop", "ghostStart"]);
  });
});
