/** Le panneau des réglages (cahier §7.13, §12.1, AIR-N-06) : des contrôles ordinaires. */
import type { JSX } from "react";
import type { Instrument, Settings } from "@thin-air/core";
import { DEFAULT_SETTINGS } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import { effectiveMagnet, filterStrength, patchSettings, withFilterStrength } from "../state/settings.js";
import type { ProfileId } from "../state/profiles.js";
import { Panel, Slider, Toggle } from "./Controls.js";
import { Profiles } from "./Profiles.js";

export interface SettingsPanelProps {
  readonly m: Messages;
  readonly settings: Settings;
  readonly instrument: Instrument;
  readonly reducedMotion: boolean;
  /** Le profil choisi, ou `null` : les profils sont des réglages proposés d'un coup. */
  readonly profileId: ProfileId | null;
  readonly onApplyProfile: (id: ProfileId) => void;
  readonly onClearProfile: () => void;
  readonly onChange: (settings: Settings) => void;
  readonly onClose: () => void;
}

export function SettingsPanel(props: SettingsPanelProps): JSX.Element {
  const { m, settings, instrument, reducedMotion, onChange } = props;
  const patch = (partiel: Partial<Settings>) => onChange(patchSettings(settings, partiel));
  return (
    <Panel title={m.settings.title} onClose={props.onClose} closeLabel={m.common.close}>
      <Profiles
        m={m.profiles}
        active={props.profileId}
        onApply={props.onApplyProfile}
        onClear={props.onClearProfile}
      />
      <ReglagesJeu m={m} settings={settings} instrument={instrument} patch={patch} />
      <ReglagesSon m={m} settings={settings} patch={patch} />
      <ReglagesRetard m={m} settings={settings} patch={patch} onChange={onChange} />
      {reducedMotion ? <p className="help" role="status">{m.settings.reducedMotion}</p> : null}
      <p className="help">{m.settings.stored}</p>
    </Panel>
  );
}

/** Le jeu : aimant, gaucher, une main, maintien (AIR-F-10, 11, 12, 19). */
function ReglagesJeu(props: {
  readonly m: Messages;
  readonly settings: Settings;
  readonly instrument: Instrument;
  readonly patch: (partiel: Partial<Settings>) => void;
}): JSX.Element {
  const { m, settings, instrument, patch } = props;
  return (
    <>
      <Slider
        id="setting-snap"
        label={m.settings.snap}
        value={effectiveMagnet(settings, instrument)}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => patch({ magnet: value })}
      />
      <Toggle
        id="setting-left-handed"
        label={m.settings.leftHanded}
        checked={settings.leftHanded}
        onChange={(value) => patch({ leftHanded: value })}
      />
      <Toggle
        id="setting-one-hand"
        label={m.settings.oneHand}
        checked={settings.oneHand}
        onChange={(value) => patch({ oneHand: value })}
      />
      <Toggle
        id="setting-hold"
        label={m.settings.hold}
        help={m.settings.holdHelp}
        checked={settings.hold}
        onChange={(value) => patch({ hold: value })}
      />
    </>
  );
}

/** Le son : volume général et réverbération (AIR-F-28, 30 ; AIR-N-03). */
function ReglagesSon(props: {
  readonly m: Messages;
  readonly settings: Settings;
  readonly patch: (partiel: Partial<Settings>) => void;
}): JSX.Element {
  const { m, settings, patch } = props;
  return (
    <>
      <Slider
        id="setting-volume"
        label={m.settings.volume}
        unit="dB"
        value={settings.masterGainDb}
        min={-60}
        max={0}
        step={1}
        help={`${m.stage.volume}: ${DEFAULT_SETTINGS.masterGainDb} dB`}
        onChange={(value) => patch({ masterGainDb: value })}
      />
      <Slider
        id="setting-reverb"
        label={m.settings.reverb}
        value={settings.reverb}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => patch({ reverb: value })}
      />
    </>
  );
}

/** Le retard et l'image : caméra supposée, filtrage, image affichée (§5.2, AIR-F-52). */
function ReglagesRetard(props: {
  readonly m: Messages;
  readonly settings: Settings;
  readonly patch: (partiel: Partial<Settings>) => void;
  readonly onChange: (settings: Settings) => void;
}): JSX.Element {
  const { m, settings, patch, onChange } = props;
  return (
    <>
      <Slider
        id="setting-camera-latency"
        label={m.settings.cameraLatency}
        unit="ms"
        help={m.settings.cameraLatencyUnit}
        value={settings.cameraLatencyMs}
        min={0}
        max={120}
        step={1}
        onChange={(value) => patch({ cameraLatencyMs: value })}
      />
      <Slider
        id="setting-filter"
        label={m.settings.filter}
        help={m.settings.filterHelp}
        value={Number(filterStrength(settings).toFixed(2))}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onChange(withFilterStrength(settings, value))}
      />
      <Toggle
        id="setting-show-camera"
        label={m.settings.showCamera}
        help={m.settings.showCameraHelp}
        checked={settings.showCamera}
        onChange={(value) => patch({ showCamera: value })}
      />
    </>
  );
}
