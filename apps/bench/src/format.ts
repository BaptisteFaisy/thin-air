/**
 * Mise en forme des nombres pour la sortie humaine du banc d'essai.
 * Virgule décimale française, sans dépendre d'un formateur dont la sortie
 * changerait avec la version de Node (déterminisme des rapports, AIR-N-09).
 */

/** Nombre à `decimals` décimales, virgule décimale : `0.139` → `0,139`. */
export function fixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? "indéfini" : `${value > 0 ? "+" : ""}infini`;
  return value.toFixed(decimals).replace("-", "−").replace(".", ",");
}

/** Instant lisible en secondes : `0,139 s`. */
export function formatSeconds(t: number): string {
  return `${fixed(t, 3)} s`;
}

/** Écart ou tolérance lisible, avec son unité. */
export function formatWithUnit(value: number, unit: string | undefined): string {
  if (unit === undefined) return fixed(value, 3);
  switch (unit) {
    case "s":
      return formatSeconds(value);
    case "ms":
      return `${fixed(value, 1)} ms`;
    case "dB":
      return `${fixed(value, 2)} dB`;
    case "cents":
      return `${fixed(value, 2)} cents`;
    case "Hz":
      return `${fixed(value, 2)} Hz`;
    case "échantillons":
      return `${Math.round(value)} échantillons`;
    case "images":
      return `${value} image${value > 1 ? "s" : ""}`;
    default:
      return `${fixed(value, 3)} ${unit}`;
  }
}

/** Une colonne de largeur fixe, utile aux tableaux en texte brut. */
export function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

/** Poids en octets, lisible : `26,0 Ko`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const ko = bytes / 1024;
  if (ko < 1024) return `${fixed(ko, 1)} Ko`;
  return `${fixed(ko / 1024, 2)} Mo`;
}
