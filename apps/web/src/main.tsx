/** Point d'entrée : rien ne démarre avant un geste de l'utilisateur (AIR-F-01). */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const cible = document.getElementById("root");
if (cible !== null) {
  createRoot(cible).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
