/**
 * Les dates du récapitulatif — un seul endroit qui sait ce qu'est « aujourd'hui ».
 *
 * Le récapitulatif parle d'une journée : celle du jour, en heure locale (le
 * dépôt travaille en Europe/Paris). Les horodatages lus sur GitHub sont en
 * UTC : ils sont convertis avant d'être comparés, sinon une PR mergée à
 * 23 h 30 UTC compterait pour le lendemain.
 */

/** La date du jour, au format `AAAA-MM-JJ` (heure locale). */
export function dateDuJour(maintenant = new Date()) {
  return `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`;
}

/** La date locale d'un horodatage ISO, au format `AAAA-MM-JJ`. */
export function dateLocale(horodatage) {
  const instant = new Date(horodatage);
  if (Number.isNaN(instant.getTime())) return "";
  return `${instant.getFullYear()}-${deuxChiffres(instant.getMonth() + 1)}-${deuxChiffres(instant.getDate())}`;
}

/** L'heure d'un horodatage ISO, en `HH:MM` local. */
export function heureLocale(horodatage) {
  const instant = new Date(horodatage);
  if (Number.isNaN(instant.getTime())) return "";
  return `${deuxChiffres(instant.getHours())}:${deuxChiffres(instant.getMinutes())}`;
}

/** Le jour de la semaine, en français, pour l'en-tête du récapitulatif. */
export function jourDeLaSemaine(date) {
  const noms = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  return noms[new Date(`${date}T12:00:00`).getDay()] ?? "";
}

function deuxChiffres(valeur) {
  return String(valeur).padStart(2, "0");
}
