/**
 * Les charges utiles du garde `no-sound-guard` (cahier §14.3, AIR-N-02).
 *
 * Une seule liste, partagée par la preuve figée (`make-guard-log.ts`, qui
 * écrit `docs/preuves/no-sound-guard.log`) et par le test
 * (`no-sound-guard.test.ts`) : zéro duplication.
 *
 * AUCUNE de ces commandes n'est exécutée : ce sont des chaînes de caractères
 * posées sur l'entrée standard du garde, qui les refuse ou les accepte sans
 * jamais rien lancer. Aucun son n'est émis (AIR-N-02) : on teste le GARDE,
 * pas le lecteur.
 */

/** Ce que le garde doit répondre à une commande. */
export type Verdict = "refus" | "acceptation";

export interface CasGarde {
  /** Étiquette lisible du cas. */
  readonly nom: string;
  /** La commande que l'agent s'apprête à lancer (chaîne, jamais exécutée). */
  readonly commande: string;
  readonly attendu: Verdict;
}

/** Charge utile complète déposée par Kiro sur l'entrée standard du hook. */
export function chargeUtile(commande: string, cwd: string, session = "preuve-w8"): unknown {
  return {
    hook_event_name: "PreToolUse",
    cwd,
    session_id: session,
    tool_name: "shell",
    tool_input: { command: commande },
  };
}

/** Lecteurs audio, réglages de volume, navigateurs de test mal configurés. */
export const CAS_REFUSES: readonly CasGarde[] = [
  { nom: "lecteur audio : aplay", commande: "aplay -D hw:0,0 bench-out/slow-rise.wav", attendu: "refus" },
  { nom: "lecteur audio : paplay", commande: "paplay bench-out/slow-rise.wav", attendu: "refus" },
  { nom: "lecteur audio : ffplay", commande: "ffplay -nodisp -autoexit bench-out/slow-rise.wav", attendu: "refus" },
  { nom: "lecteur audio : mpv", commande: "mpv --no-video bench-out/slow-rise.wav", attendu: "refus" },
  { nom: "lecteur audio : vlc", commande: "vlc bench-out/harp-sweep.wav", attendu: "refus" },
  { nom: "lecteur audio : speaker-test", commande: "speaker-test -c 2 -t sine -f 440", attendu: "refus" },
  { nom: "volume : amixer", commande: "amixer sset Master 50%", attendu: "refus" },
  { nom: "volume : pactl", commande: "pactl set-sink-volume @DEFAULT_SINK@ 40%", attendu: "refus" },
  { nom: "volume : wpctl", commande: "wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.4", attendu: "refus" },
  { nom: "volume : osascript … volume", commande: "osascript -e 'set volume output volume 50'", attendu: "refus" },
  { nom: "navigateur de test avec écran", commande: "npx playwright test --headed", attendu: "refus" },
  { nom: "navigateur de test sans son coupé", commande: "npx playwright test e2e/scene.spec.ts", attendu: "refus" },
  {
    nom: "navigateur de test avec écran (écran dans une config JSON, son coupé)",
    commande: `npx playwright test --mute-audio --config='{"headless": false}'`,
    attendu: "refus",
  },
];

/** Commandes sans aucun son : le banc d'essai, les tests, les gardes. */
export const CAS_ACCEPTES: readonly CasGarde[] = [
  { nom: "suite de tests", commande: "npx vitest run", attendu: "acceptation" },
  { nom: "banc d'essai", commande: "npm run bench", attendu: "acceptation" },
  { nom: "contrôle du bundle", commande: "node scripts/check-dist.mjs", attendu: "acceptation" },
  {
    nom: "navigateur de test sans écran, son coupé",
    commande: "npx playwright test --mute-audio",
    attendu: "acceptation",
  },
];

/** Les deux listes, dans l'ordre du journal. */
export const CAS: readonly CasGarde[] = [...CAS_REFUSES, ...CAS_ACCEPTES];
