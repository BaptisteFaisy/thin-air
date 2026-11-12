/**
 * Ce que font les boutons des panneaux (cahier §12.1) : changer d'instrument,
 * dupliquer, importer un fichier, piloter la boucle, calibrer, régler.
 * Aucune logique musicale ici — seulement de l'aiguillage.
 */
import { DEFAULT_SETTINGS, type Instrument } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import type { LoopState } from "./loopState.js";
import {
  beginCalibration,
  idleCalibration,
  keepDefault,
  restartCalibration,
  startCountdown,
  type CalibrationState,
} from "./calibration.js";
import {
  clearLayers,
  removeLastLayer,
  startRecording,
  stopRecording,
  toggleMute,
  withBars,
  withTempo,
} from "./loopState.js";
import { duplicate, validate } from "./instruments.js";
import { decodeSession, encodeSession, loopFromSession, sessionFromLoop, SESSION_FILE, type SessionResult } from "./sessionFile.js";
import {
  applySettings,
  noProfileRect,
  profileById,
  type ProfileId,
} from "./profiles.js";
import { download, exportMidi, exportWav, toSession } from "../lib/exportLoop.js";
import type { PanelId } from "../ui/Stage.js";
import type { PanelHandlers } from "../ui/Panels.js";
import type { SeanceData } from "../hooks/useSeanceData.js";
import type { SessionApi } from "../hooks/useSession.js";
import type { Settings } from "@thin-air/core";

export interface HandlersDeps {
  readonly data: SeanceData;
  readonly session: SessionApi;
  readonly m: Messages;
}

/** Remplace un instrument de la bibliothèque, ou l'ajoute s'il est nouveau. */
export function remplacer(bibliotheque: readonly Instrument[], instrument: Instrument): readonly Instrument[] {
  const index = bibliotheque.findIndex((candidat) => candidat.name === instrument.name);
  if (index < 0) return [...bibliotheque, instrument];
  return bibliotheque.map((candidat, i) => (i === index ? instrument : candidat));
}

export function gestionnaires(deps: HandlersDeps): PanelHandlers {
  const { data, session, m } = deps;
  return {
    onUse: (instrument) => {
      data.setInstrument(instrument);
      session.setInstrument(instrument);
      session.dispatch({ type: "instrumentAccepted" });
    },
    onDuplicate: (source) => {
      const copie = duplicate(source, m.instruments.duplicateOf);
      data.setLibrary((biblio) => [...biblio, copie]);
      data.setEditing(copie);
    },
    onEdit: (instrument) => data.setEditing(instrument),
    onImport: (raw) => importer(raw, deps),
    onTempo: (tempo) => data.setLoop((avant) => withTempo(avant, tempo)),
    onBars: (bars) => data.setLoop((avant) => withBars(avant, bars)),
    onRecord: () => {
      data.enregistres.current.length = 0;
      data.setLoop(startRecording);
    },
    onStopRecord: () => data.setLoop((avant) => finEnregistrement(avant, deps)),
    onRemoveLast: () => data.setLoop(removeLastLayer),
    onToggleMute: (id) => data.setLoop((avant) => toggleMute(avant, id)),
    onClear: () => data.setLoop(clearLayers),
    onExportWav: () => void exporter("wav", deps),
    onExportMidi: () => void exporter("midi", deps),
    onCalibrate: () => data.setCalibration((avant) => startCountdown(beginCalibration(avant))),
    onRestart: () => data.setCalibration(restartCalibration),
    onKeepDefault: () => data.setCalibration(keepDefault),
    onSettings: (settings) => data.setSettings(settings),
    onApplyProfile: (id: ProfileId) => appliquerProfil(id, data),
    onClearProfile: () => effacerProfil(data),
    onSaveSession: () => enregistrerSession(deps),
    onOpenSession: (raw) => ouvrirSession(raw, deps),
    onClose: () => data.setPanel(null),
  };
}

/**
 * Un profil de mobilité (cahier §3, §12.4, AIR-F-10 à 12) : les réglages qu'il
 * porte sont posés par-dessus ceux en place, et sa zone de jeu — quand il en
 * définit une — devient la zone stockée. Rien d'autre ne bouge : l'étendue
 * d'un instrument vit dans son fichier, jamais dans un réglage.
 */
function appliquerProfil(id: ProfileId, data: SeanceData): void {
  const profil = profileById(id);
  data.setSettings(applySettings(data.settings, profil));
  const zone = profil.playRect;
  if (zone !== null) data.setCalibration(() => idleCalibration(zone));
  data.setProfileId(id);
}

/** « Aucun profil » : les réglages et la zone reviennent à leurs défauts. */
function effacerProfil(data: SeanceData): void {
  data.setProfileId(null);
  data.setSettings({ ...DEFAULT_SETTINGS });
  data.setCalibration(() => idleCalibration(noProfileRect()));
}

/**
 * Le fichier de session (cahier §7.10) : la boucle courante et les réglages,
 * écrits en `thin-air-session/1` et téléchargés sur l'appareil. Aucun son dans
 * le fichier, aucune requête réseau (AIR-N-01).
 */
function enregistrerSession(deps: HandlersDeps): boolean {
  const { loop, settings } = deps.data;
  try {
    const texte = encodeSession(sessionFromLoop(loop, settings as Settings));
    download(new Blob([texte], { type: "application/json" }), SESSION_FILE);
    return true;
  } catch {
    return false;
  }
}

/** AIR-F-43 : un fichier de session refusé l'est en entier, avec ses raisons. */
function ouvrirSession(raw: string, deps: HandlersDeps): SessionResult {
  const lu = decodeSession(raw);
  const session = lu.session;
  if (session === null) return { ok: false, reasons: lu.reasons };
  deps.data.setLoop(() => loopFromSession(session));
  deps.data.setSettings(session.settings);
  return { ok: true };
}

function finEnregistrement(avant: LoopState, deps: HandlersDeps): LoopState {
  return stopRecording(avant, deps.data.instrument.name, deps.data.enregistres.current);
}

/** AIR-F-43 : un fichier refusé l'est en entier, avec ses raisons à l'écran. */
function importer(raw: string, deps: HandlersDeps): void {
  const resultat = validate(raw);
  if (!resultat.ok) {
    deps.session.dispatch({ type: "instrumentRejected", reason: resultat.reasons.join(" ; ") });
    return;
  }
  deps.session.dispatch({ type: "instrumentAccepted" });
  deps.data.setLibrary((biblio) => remplacer(biblio, resultat.value));
  deps.data.setInstrument(resultat.value);
  deps.session.setInstrument(resultat.value);
}

/** AIR-F-38, 39 : export rendu hors ligne, téléchargé localement. */
async function exporter(kind: "wav" | "midi", deps: HandlersDeps): Promise<void> {
  const { loop, settings, instrument } = deps.data;
  const session = toSession(loop.layers, loop.tempo, loop.bars, loop.beatsPerBar, settings as Settings);
  const resultat = kind === "wav" ? await exportWav(session, instrument, settings) : await exportMidi(session);
  if (resultat.blob !== null) download(resultat.blob, `thin-air-loop.${kind}`);
}

export type { PanelId, CalibrationState };
