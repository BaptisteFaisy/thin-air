/**
 * La séance (cahier §12) : l'accueil avant tout geste, puis la scène. Tout
 * l'état vit dans `hooks/`, toute la logique dans `state/`, `scene/` et `lib/` ;
 * ce composant ne fait qu'afficher (AIR-F-01 : ni caméra ni son avant un clic).
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
  if (session.state.phase === "idle") {
    return <Home m={m} onStart={() => void session.startCamera()} onPointer={() => void session.startPointer()} />;
  }
  return <SeanceView s={seance} />;
}
