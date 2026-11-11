/**
 * La séance (cahier §12) : l'accueil avant tout geste, puis la scène. Tout
 * l'état vit dans `hooks/`, toute la logique dans `state/`, `scene/` et `lib/` ;
 * ce composant ne fait qu'afficher (AIR-F-01 : ni caméra ni son avant un clic).
 *
 * Un fragment d'adresse refusé annonce ses RAISONS dès l'accueil (AIR-F-43,
 * AIR-F-45) : l'instrument par défaut s'applique, mais jamais en silence.
 */
import type { JSX } from "react";
import { useSeance } from "./hooks/useSeance.js";
import { Home } from "./ui/Home.js";
import { SeanceView } from "./ui/Seance.js";
import { RealTakePage } from "./ui/RealTake.js";

/** Route `?record=1` : le mode « prise réelle » du lot N7 (annexe D). */
function recordMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("record") === "1";
}

export function App(): JSX.Element {
  if (recordMode()) return <RealTakePage />;
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
        <Home m={m} onStart={() => void session.startCamera()} onPointer={() => void session.startPointer()} />
      ) : (
        <SeanceView s={seance} />
      )}
    </>
  );
}
