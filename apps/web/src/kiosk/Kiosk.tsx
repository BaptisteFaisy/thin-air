/**
 * La borne : plein écran, aucune commande, aucune caméra montrée. La scène
 * seule, un message discret en cas de panne, le fantôme qui rejoue sa prise.
 * Tout le câblage vit dans `useKiosk` ; ce composant n'affiche que l'état.
 */
import { useMemo, type JSX } from "react";
import { SceneCanvas } from "../scene/SceneCanvas.js";
import { kioskMessagesFor } from "./kiosk.js";
import { useKiosk } from "./useKiosk.js";
import "./kiosk.css";

function rechercheAdresse(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

export function Kiosk(): JSX.Element {
  const messages = useMemo(() => kioskMessagesFor(rechercheAdresse()), []);
  const { fault, videoRef, modele } = useKiosk();
  return (
    <main className="screen stage kiosk">
      <SceneCanvas label={messages.aria.scene} model={modele} showCamera={false} />
      {fault === null ? null : (
        <p className="notice kiosk-message" role="status">
          {messages.degraded[fault]}
        </p>
      )}
      <video ref={videoRef} className="camera-source" playsInline muted aria-hidden="true" />
    </main>
  );
}