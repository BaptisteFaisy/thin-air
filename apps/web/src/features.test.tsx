// @vitest-environment happy-dom
/**
 * L'inventaire des features (cahier §8, §12.1) : ce qui existe doit se voir.
 * Chaque feature montée est vérifiée DANS LE DOM rendu — un module présent mais
 * jamais monté ne compte pas. Rien n'est joué ici : les composants sont rendus
 * hors navigateur, donc sans effet, sans caméra et sans son (AIR-F-01, AIR-N-02).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SETTINGS, defaultPlayRect, type Instrument } from "@thin-air/core";
import { en } from "./i18n/en.js";
import { App } from "./App.js";
import { BUILT_IN } from "./state/library.js";
import { PROFILES } from "./state/profiles.js";
import { emptyDisplay } from "./state/display.js";
import { emptyLoop } from "./state/loopState.js";
import { latencyInitiale } from "./state/latency.js";
import { instrumentFromFragment, shareLink } from "./state/instruments.js";
import { initialUiState, notices, reduceUi } from "./state/machine.js";
import { kioskWanted } from "./kiosk/kiosk.js";
import { Kiosk } from "./kiosk/Kiosk.js";
import { KioskEntry, kioskHref } from "./ui/KioskEntry.js";
import { Home } from "./ui/Home.js";
import { InstrumentsDrawer } from "./ui/InstrumentsDrawer.js";
import { LatencyReadout } from "./ui/LatencyReadout.js";
import { LoopPanel } from "./ui/LoopPanel.js";
import { Notices } from "./ui/Notices.js";
import { SettingsPanel } from "./ui/SettingsPanel.js";
import { Stage } from "./ui/Stage.js";
import type { SceneModel } from "./scene/geometry.js";

const rien = () => undefined;
const instrument: Instrument = BUILT_IN[0] as Instrument;

/** Le panneau des réglages, tel qu'il est monté dans la séance. */
function reglages(): string {
  return renderToStaticMarkup(
    <SettingsPanel
      m={en}
      settings={DEFAULT_SETTINGS}
      instrument={instrument}
      reducedMotion={false}
      profileId={null}
      onApplyProfile={rien}
      onClearProfile={rien}
      onChange={rien}
      onClose={rien}
    />,
  );
}

/** Le panneau de la boucle, avec le MIDI déclaré disponible. */
function boucle(): string {
  return renderToStaticMarkup(
    <LoopPanel
      m={en}
      loop={emptyLoop(DEFAULT_SETTINGS)}
      midiAvailable
      onTempo={rien}
      onBars={rien}
      onRecord={rien}
      onStop={rien}
      onRemoveLast={rien}
      onToggleMute={rien}
      onClear={rien}
      onExportWav={rien}
      onExportMidi={rien}
      onSaveSession={() => true}
      onOpenSession={() => ({ ok: true })}
      onClose={rien}
    />,
  );
}

/** Le tiroir d'instruments, avec le lien de partage de l'instrument courant. */
function tiroir(): string {
  return renderToStaticMarkup(
    <InstrumentsDrawer
      m={en}
      library={BUILT_IN}
      current={instrument}
      link={shareLink(instrument, "https://exemple.test/thin-air/")}
      onUse={rien}
      onDuplicate={rien}
      onEdit={rien}
      onImport={rien}
      onClose={rien}
    />,
  );
}

describe("inventaire des features — ce qui existe est visible (cahier §8, §12.1)", () => {
  it("1. les profils de mobilité sont dans les réglages (§3, AIR-F-10 à 12)", () => {
    const html = reglages();
    expect(html).toContain(en.profiles.title);
    for (const profil of PROFILES) expect(html).toContain(en.profiles[profil.id].name);
    expect(html).toContain('aria-pressed="false"');
    // Ce que les profils pilotent reste réglable à la main, dans le même panneau.
    expect(html).toContain(en.settings.oneHand);
    expect(html).toContain(en.settings.hold);
    expect(html).toContain(en.settings.filter);
  });

  it("2. la borne est annoncée depuis l'accueil, par un vrai lien (§12.2)", () => {
    const html = renderToStaticMarkup(
      <>
        <Home m={en} onStart={rien} onPointer={rien} />
        <KioskEntry m={en} search="" />
      </>,
    );
    expect(html).toContain(en.home.kiosk);
    expect(html).toContain("<a href=");
    expect(html).toContain("kiosk=1");
    expect(kioskWanted(kioskHref(""))).toBe(true);
  });

  it("3. la borne se rend : la scène seule, aucun réglage visible (P11)", () => {
    const html = renderToStaticMarkup(<Kiosk />);
    expect(html).toContain("kiosk");
    expect(html).toContain("<canvas");
    expect(html).not.toContain(en.stage.settings);
    expect(html).not.toContain(en.settings.title);
  });

  it("4. le tiroir d'instruments porte le lien de partage (P8, AIR-F-45)", () => {
    const html = tiroir();
    expect(html).toContain(en.instruments.copyLink);
    expect(html).toContain("#i=");
    expect(html).toContain(en.instruments.shareHint);
  });

  it("5. le panneau Boucle porte les deux exports (§7.10, P4)", () => {
    const html = boucle();
    expect(html).toContain(en.loop.exportWav);
    expect(html).toContain(en.loop.exportMidi);
  });

  it("6. le fichier de session s'écrit et se rouvre depuis la Boucle (§7.10)", () => {
    const html = boucle();
    expect(html).toContain(en.loop.saveSession);
    expect(html).toContain(en.loop.openSession);
    expect(html).toContain('type="file"');
  });

  it("7. le fantôme est dit à l'écran pendant qu'il joue (P11, AIR-F-50)", () => {
    const etat = reduceUi(reduceUi(initialUiState(), { type: "cameraGranted" }), { type: "ghost", playing: true });
    const html = renderToStaticMarkup(
      <Notices m={en} state={etat} ids={notices(etat)} rejectionReason={null} onResumeAudio={rien} />,
    );
    expect(html).toContain(en.stage.ghost);
  });

  it("8. le retard est affiché dans la scène, composante par composante (§5.2)", () => {
    const html = scene();
    expect(html).toContain(en.latency.heading);
    expect(html).toContain(en.common.measured);
    const seul = renderToStaticMarkup(
      <LatencyReadout m={en} parts={latencyInitiale(DEFAULT_SETTINGS)} wireless={false} />,
    );
    expect(seul).toContain(en.latency.heading);
  });

  it("9. l'accueil rendu par l'app porte la borne, et dit les raisons d'un fragment illisible (P8)", () => {
    window.location.hash = "#i=illisible";
    const refus = instrumentFromFragment("illisible");
    const html = renderToStaticMarkup(<App />);
    window.location.hash = "";
    expect(refus.ok).toBe(false);
    if (refus.ok) return;
    expect(html).toContain(en.instruments.rejected(refus.reasons.join(" ; ")));
    expect(html).toContain(en.home.start);
    expect(html).toContain("kiosk=1");
  });
});

/** La scène montée, avec un modèle vide : rien n'est dessiné, rien n'est joué. */
function scene(): string {
  const modele = (): SceneModel => ({
    width: 640,
    height: 480,
    hands: [],
    strings: [],
    zones: [],
    curve: [],
    playRect: defaultPlayRect(),
    reducedMotion: false,
    showCamera: false,
    hovered: null,
  });
  return renderToStaticMarkup(
    <Stage
      m={en}
      state={initialUiState()}
      instrument={instrument}
      display={emptyDisplay()}
      parts={latencyInitiale(DEFAULT_SETTINGS)}
      wireless={false}
      notices={[]}
      rejectionReason={null}
      model={modele}
      videoRef={{ current: null }}
      showCamera={false}
      reducedMotion={false}
      openPanel={null}
      onOpenPanel={rien}
      onResumeAudio={rien}
      hoveredLabel={null}
      stageRef={{ current: null }}
    />,
  );
}
