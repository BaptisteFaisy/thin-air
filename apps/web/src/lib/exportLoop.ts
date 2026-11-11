/**
 * Les exports de la boucle (AIR-F-38, 39) : rendu hors ligne, jamais de
 * capture en direct, aucun fichier audio embarqué (AIR-F-25). Les moteurs sont
 * ceux des lots A3 et A5 ; tant qu'ils ne sont pas livrés, l'export rend
 * `null` et l'écran le dit.
 */
import type { Instrument, MusicEvent, Session, Settings } from "@thin-air/core";

export interface ExportResult {
  readonly blob: Blob | null;
  readonly reason: "empty" | "engine" | null;
}

function vide(reason: "empty" | "engine"): ExportResult {
  return { blob: null, reason };
}

/** La session à exporter : une piste par couche, tempo et mesures du cahier §7.10. */
export function toSession(
  layers: readonly { id: number; instrument: string; events: readonly MusicEvent[]; muted: boolean }[],
  tempo: number,
  bars: number,
  beatsPerBar: number,
  settings: Session["settings"],
): Session {
  return {
    format: "thin-air-session/1",
    tempo,
    bars,
    beatsPerBar,
    layers: layers.filter((couche) => !couche.muted),
    settings,
  };
}

/**
 * Le rendu hors ligne prend un instrument : le mélange de plusieurs couches
 * d'instruments différents appartient au moteur du lot A5. Tant qu'il n'est pas
 * livré, l'export rend la couche en cours avec l'instrument de la scène.
 */
export async function exportWav(
  session: Session,
  instrument: Instrument,
  settings: Settings,
): Promise<ExportResult> {
  if (session.layers.length === 0) return vide("empty");
  try {
    const audio = await import("@thin-air/audio");
    const rendu = audio.renderEvents(session.layers.flatMap((couche) => couche.events), {
      instrument,
      durationS: (session.bars * session.beatsPerBar * 60) / session.tempo,
      masterGainDb: settings.masterGainDb,
      ceilingDb: settings.ceilingDb,
      reverb: settings.reverb,
      maxVoices: settings.maxVoices,
      paramTauMs: settings.paramTauMs,
    });
    const octets = audio.encodeWav(rendu.samples, rendu.sampleRate);
    return { blob: new Blob([octets as unknown as BlobPart], { type: "audio/wav" }), reason: null };
  } catch {
    return vide("engine");
  }
}

export async function exportMidi(session: Session): Promise<ExportResult> {
  if (session.layers.length === 0) return vide("empty");
  try {
    const core = await import("@thin-air/core");
    const octets = core.encodeMidi(session);
    return { blob: new Blob([octets as unknown as BlobPart], { type: "audio/midi" }), reason: null };
  } catch {
    return vide("engine");
  }
}

/** Téléchargement local : aucune requête réseau (AIR-N-01). */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = filename;
  document.body.append(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
