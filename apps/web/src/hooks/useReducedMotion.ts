/** Le réglage « moins de mouvement » du système (AIR-N-06). */
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduit, setReduit] = useState(() => prefere());
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia === undefined) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduit(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduit;
}

function prefere(): boolean {
  if (typeof window === "undefined" || window.matchMedia === undefined) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
