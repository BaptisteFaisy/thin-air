/** Le tiroir de panneaux : un seul endroit décide quel écran s'affiche (§12.1). */
import type { JSX } from "react";
import type { Instrument } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import type { StageDisplay } from "../state/display.js";
import type { CalibrationState } from "../state/calibration.js";
import type { LoopState } from "../state/loopState.js";
import type { Settings } from "@thin-air/core";
import type { PanelId } from "./Stage.js";
import { InstrumentsDrawer } from "./InstrumentsDrawer.js";
import { LoopPanel } from "./LoopPanel.js";
import { CalibrationPanel } from "./CalibrationPanel.js";
import { PhysicsPanel } from "./PhysicsPanel.js";
import { SettingsPanel } from "./SettingsPanel.js";

export interface PanelHandlers {
  readonly onUse: (instrument: Instrument) => void;
  readonly onDuplicate: (instrument: Instrument) => void;
  readonly onEdit: (instrument: Instrument) => void;
  readonly onImport: (raw: string) => void;
  readonly onTempo: (tempo: number) => void;
  readonly onBars: (bars: number) => void;
  readonly onRecord: () => void;
  readonly onStopRecord: () => void;
  readonly onRemoveLast: () => void;
  readonly onToggleMute: (id: number) => void;
  readonly onClear: () => void;
  readonly onExportWav: () => void;
  readonly onExportMidi: () => void;
  readonly onCalibrate: () => void;
  readonly onRestart: () => void;
  readonly onKeepDefault: () => void;
  readonly onSettings: (settings: Settings) => void;
  readonly onClose: () => void;
}

export interface PanelsProps {
  readonly panel: PanelId;
  readonly m: Messages;
  readonly instrument: Instrument;
  readonly library: readonly Instrument[];
  readonly loop: LoopState;
  readonly calibration: CalibrationState;
  readonly settings: Settings;
  readonly display: StageDisplay;
  readonly midiAvailable: boolean;
  readonly reducedMotion: boolean;
  readonly link: string;
  readonly handlers: PanelHandlers;
}

export function Panels(props: PanelsProps): JSX.Element | null {
  if (props.panel === null) return null;
  return props.panel === "instruments" || props.panel === "loop" ? tiroir(props) : atelier(props);
}

/** Le tiroir : instruments et boucle. */
function tiroir(props: PanelsProps): JSX.Element | null {
  const { panel, m, handlers } = props;
  if (panel === "instruments") {
    return (
      <InstrumentsDrawer
        m={m}
        library={props.library}
        current={props.instrument}
        link={props.link}
        onUse={handlers.onUse}
        onDuplicate={handlers.onDuplicate}
        onEdit={handlers.onEdit}
        onImport={handlers.onImport}
        onClose={handlers.onClose}
      />
    );
  }
  if (panel === "loop") {
    return (
      <LoopPanel
        m={m}
        loop={props.loop}
        midiAvailable={props.midiAvailable}
        onTempo={handlers.onTempo}
        onBars={handlers.onBars}
        onRecord={handlers.onRecord}
        onStop={handlers.onStopRecord}
        onRemoveLast={handlers.onRemoveLast}
        onToggleMute={handlers.onToggleMute}
        onClear={handlers.onClear}
        onExportWav={handlers.onExportWav}
        onExportMidi={handlers.onExportMidi}
        onClose={handlers.onClose}
      />
    );
  }
  return null;
}

/** L'atelier : calibration, réglages, physique. */
function atelier(props: PanelsProps): JSX.Element {
  const { panel, m, handlers } = props;
  if (panel === "calibration") {
    return (
      <CalibrationPanel
        m={m}
        state={props.calibration}
        onStart={handlers.onCalibrate}
        onRestart={handlers.onRestart}
        onKeepDefault={handlers.onKeepDefault}
        onClose={handlers.onClose}
      />
    );
  }
  if (panel === "settings") {
    return (
      <SettingsPanel
        m={m}
        settings={props.settings}
        instrument={props.instrument}
        reducedMotion={props.reducedMotion}
        onChange={handlers.onSettings}
        onClose={handlers.onClose}
      />
    );
  }
  return (
    <PhysicsPanel
      m={m}
      instrument={props.instrument}
      display={props.display}
      onClose={handlers.onClose}
    />
  );
}
