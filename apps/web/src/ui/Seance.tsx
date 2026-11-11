/**
 * L'écran de jeu assemblé (cahier §12.1) : la scène, ses panneaux, et
 * l'éditeur d'instrument. Affichage et câblage seulement.
 */
import type { JSX } from "react";
import { notices as noticeIds } from "../state/machine.js";
import { needsWiredOutput } from "../state/latency.js";
import { isBuiltIn, shareLink } from "../state/instruments.js";
import { storedRect } from "../state/calibration.js";
import { remplacer } from "../state/handlers.js";
import type { Seance } from "../hooks/useSeance.js";
import { Stage } from "./Stage.js";
import { Panels } from "./Panels.js";
import { InstrumentEditor } from "./InstrumentEditor.js";

export function SeanceView({ s }: { readonly s: Seance }): JSX.Element {
  const { data, session, m } = s;
  return (
    <>
      <Stage
        m={m}
        state={session.state}
        instrument={data.instrument}
        display={data.display}
        parts={data.parts}
        wireless={needsWiredOutput(data.parts, data.settings.wirelessWarnMs)}
        notices={noticeIds(session.state, {
          wirelessWarnMs: data.settings.wirelessWarnMs,
          cameraOk: session.state.mode === "camera",
        })}
        rejectionReason={session.state.rejection}
        model={s.modele}
        videoRef={session.videoRef}
        showCamera={data.settings.showCamera}
        reducedMotion={s.reducedMotion}
        openPanel={data.panel}
        onOpenPanel={data.setPanel}
        onResumeAudio={() => void session.resumeAudio()}
        hoveredLabel={survolLabel(data.hovered)}
        stageRef={s.sceneRef}
      />
      <Panels
        panel={data.panel}
        m={m}
        instrument={data.instrument}
        library={data.library}
        loop={data.loop}
        calibration={data.calibration}
        settings={data.settings}
        display={data.display}
        midiAvailable={session.state.midi === "available"}
        reducedMotion={s.reducedMotion}
        link={shareLink(data.instrument, origine())}
        handlers={s.handlers}
      />
      {data.editing === null ? null : <Editeur key={data.editing.name} s={s} />}
    </>
  );
}

/** AIR-F-44 : les instruments livrés se dupliquent avant d'être modifiés. */
function Editeur({ s }: { readonly s: Seance }): JSX.Element {
  const { data, m } = s;
  const edition = data.editing;
  if (edition === null) return <></>;
  return (
    <InstrumentEditor
      m={m}
      instrument={edition}
      readOnly={isBuiltIn(edition)}
      onSave={(suivant) => {
        data.setLibrary((biblio) => remplacer(biblio.filter((autre) => autre.name !== edition.name), suivant));
        if (edition.name === data.instrument.name) data.setInstrument(suivant);
        data.setEditing(null);
      }}
      onClose={() => data.setEditing(null)}
    />
  );
}

/** Le numéro de la corde ou de la zone visée, dit en texte (§12.4). */
function survolLabel(hovered: number | null): string | null {
  return hovered === null ? null : `${hovered + 1}`;
}

function origine(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

export { storedRect };
