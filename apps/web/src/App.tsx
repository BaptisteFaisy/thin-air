/**
 * La séance (cahier §12) : l'accueil avant tout geste, puis la scène. Tout
 * l'état vit dans `hooks/`, toute la logique dans `state/`, `scene/` et `lib/` ;
 * ce composant ne fait qu'afficher (AIR-F-01 : ni caméra ni son avant un clic).
 *
 * Deux routes d'adresse priment sur la séance, sans rien changer à son corps :
 * `?kiosk=1` rend la borne plein écran (§12.2, P11) et `?record=1` le mode
 * « prise réelle » (annexe D). L'accueil annonce la borne par un lien discret.
 *
 * Un fragment d'adresse refusé annonce ses RAISONS dès l'accueil (AIR-F-43,
 * AIR-F-45) : l'instrument par défaut s'applique, mais jamais en silence.
 */
import type { JSX } from "react";
import { useSeance } from "./hooks/useSeance.js";
import { Kiosk } from "./kiosk/Kiosk.js";
import { kioskWanted } from "./kiosk/kiosk.js";
import { Home } from "./ui/Home.js";
import { KioskEntry } from "./ui/KioskEntry.js";
import { SeanceView } from "./ui/Seance.js";
import { RealTakePage } from "./ui/RealTake.js";
import { LessonsPanel } from "./ui/LessonsPanel.js";

/** Les paramètres de l'adresse courante, vides hors navigateur. */
function recherche(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

/** Route `?record=1` : le mode « prise réelle » du lot N7 (annexe D). */
function recordMode(): boolean {
  return new URLSearchParams(recherche()).get("record") === "1";
}

/** Route `?lecons=1` : les trois leçons chiffrées (parcours P5, §12.1). */
function lessonsMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("lecons") === "1";
}

export function App(): JSX.Element {
  if (kioskWanted(recherche())) return <Kiosk />;
  if (recordMode()) return <RealTakePage />;
  if (lessonsMode()) {
    return (
      <main>
        <p><a href="?">Back to the stage</a></p>
        <LessonsPanel />
      </main>
    );
  }
  const seance = useSeance();
  const { session, m } = seance;
  const refus = seance.data.fragmentRefus;
  return (
    <>
      {refus === null ? null : (
        <p className="notice notice-instrumentRejected" role="alert">
          {m.instruments.rejected(refus.join(" ; "))}
        </p>
      )}
      {session.state.phase === "idle" ? (
        <>
          <Home m={m} onStart={() => void session.startCamera()} onPointer={() => void session.startPointer()} />
          <KioskEntry m={m} search={recherche()} />
        </>
      ) : (
        <SeanceView s={seance} />
      )}
    </>
  );
}
