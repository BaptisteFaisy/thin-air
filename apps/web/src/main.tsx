import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const cible = document.getElementById("root");
if (cible) {
  createRoot(cible).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
