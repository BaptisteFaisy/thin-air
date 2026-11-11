#!/usr/bin/env node
/**
 * Garde « aucun son » (AIR-N-02, cahier §14.3, recette §18).
 *
 * Déclenchée avant tout usage de l'outil `shell`, elle refuse :
 *   - tout lecteur audio (aplay, paplay, afplay, ffplay, mpv, vlc, …) ;
 *   - tout réglage du volume ou de la sortie (amixer, pactl, wpctl,
 *     osascript avec « volume ») ;
 *   - tout lancement d'un navigateur de test avec écran, ou sans l'option de
 *     son coupé.
 *
 * Le refus passe par le code de sortie non nul et un message sur la sortie
 * d'erreur : Kiro bloque l'outil et l'agent doit passer par le banc d'essai
 * (`bench events`, `bench render`, `bench compare`), qui rend hors ligne.
 *
 * Chaque invocation — refus comme acceptation — est écrite dans
 * `out/hook-log.jsonl`, dossier ignoré par git : c'est le journal joint à la
 * soumission (recette §18 : « le journal du hook no-sound-guard est joint »).
 *
 * Le nom exact du champ qui porte la commande est marqué « à vérifier »
 * (annexe D) : `commandeDeLaChargeUtile` accepte `tool_input.command`,
 * `tool_input.cmd` et `tool_input.input`.
 *
 * Usage : JSON sur l'entrée standard (Kiro) → contrôle ; sans entrée (CI) →
 * rien à contrôler, code 0.
 */
import { accepter, commandeDeLaChargeUtile, journaliser, lireChargeUtile, racine, refuser } from "./lib/io.mjs";

const NOM = "no-sound-guard";

/** Un lecteur qui ouvre une sortie audio. */
const LECTEURS = new Set([
  "aplay", "paplay", "afplay", "ffplay", "mpv", "vlc", "cvlc", "mplayer", "speaker-test",
]);
/** Un réglage du volume, du périphérique ou de la session audio. */
const VOLUME = new Set(["amixer", "pactl", "wpctl", "alsamixer", "pavucontrol"]);
/** Un navigateur de test : exige un son coupé et aucun écran. */
const NAVIGATEURS = new Set([
  "playwright", "puppeteer", "chromium", "chromium-browser", "chrome", "google-chrome",
  "google-chrome-stable", "firefox", "msedge", "headless_shell",
]);
/** Options qui coupent le son d'un navigateur de test. */
const SILENCE = ["--mute-audio", "--mute", "muteAudio", "\"mute\": true", "mute: true"];
/** Options ou variables qui donnent un écran à un navigateur de test. */
const ECRAN = ["--headed", "headless: false", "headless:false", "HEADLESS=0", "--no-headless", "headful"];

function jetons(commande) {
  return commande
    .split(/[\s;|&><()]+/)
    .filter(Boolean)
    .map((jeton) => jeton.split("/").pop().replace(/^["']|["']$/g, ""));
}

function controleLecteur(commande, jeton) {
  if (LECTEURS.has(jeton.toLowerCase())) {
    return `lecteur audio refusé (« ${jeton} ») : la preuve passe par le banc d'essai, jamais par un haut-parleur`;
  }
  if (VOLUME.has(jeton.toLowerCase())) {
    return `réglage du volume refusé (« ${jeton} ») : l'agent ne touche ni au volume ni à la sortie audio`;
  }
  if (jeton.toLowerCase() === "osascript" && /\bvolume\b/i.test(commande)) {
    return "réglage du volume refusé (« osascript … volume »)";
  }
  return null;
}

function controleNavigateur(commande, jetons) {
  const lanceur = jetons.find((jeton) => NAVIGATEURS.has(jeton.toLowerCase()));
  if (!lanceur) return null;
  const minuscule = commande.toLowerCase();
  if (ECRAN.some((marque) => minuscule.includes(marque.toLowerCase()))) {
    return `navigateur de test avec écran refusé (« ${lanceur} ») : sans écran, son coupé (§13.1)`;
  }
  if (!SILENCE.some((marque) => minuscule.includes(marque.toLowerCase()))) {
    return (
      `navigateur de test sans son coupé refusé (« ${lanceur} ») : ` +
      "ajouter --mute-audio, ou le fixer dans la configuration du lanceur (§13.1)"
    );
  }
  return null;
}

/** Rend la raison du refus, ou `null` si la commande est acceptable. */
export function controler(commande) {
  const jetonsListe = jetons(commande);
  for (const jeton of jetonsListe) {
    const refus = controleLecteur(commande, jeton);
    if (refus) return refus;
  }
  return controleNavigateur(commande, jetonsListe);
}

const chargeUtile = await lireChargeUtile();
const commande = commandeDeLaChargeUtile(chargeUtile);

if (commande === null) {
  await journaliser(racine(chargeUtile), { garde: NOM, evenement: "aucune-commande", commande: null });
  accepter("aucune commande sur l'entrée standard : rien à contrôler (hors déclencheur Kiro)");
}

const raison = controler(commande);
const base = racine(chargeUtile);
if (raison) {
  await journaliser(base, { garde: NOM, evenement: "refus", commande, raison });
  refuser(`${NOM} : ${raison}\n  commande : ${commande}`);
}
await journaliser(base, { garde: NOM, evenement: "acceptation", commande, raison: null });
accepter(`commande sans son : ${commande.slice(0, 120)}`);
