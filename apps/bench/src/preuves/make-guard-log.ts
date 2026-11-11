/**
 * Génère la preuve figée `docs/preuves/no-sound-guard.log` : chaque cas de
 * `guard-cases.ts` est déposé sur l'entrée standard du garde, exactement
 * comme Kiro le fait, et le verdict (code + message) est imprimé.
 *
 * Exécution (depuis la racine du dépôt) :
 *   npx tsx apps/bench/src/preuves/make-guard-log.ts > docs/preuves/no-sound-guard.log
 *
 * Le script sort en code 1 dès qu'un verdict diffère de l'attendu (le
 * journal ne serait alors pas une preuve). Les désaccords sont signalés sur
 * la sortie d'erreur, pas dans le journal.
 *
 * Aucun son n'est émis (AIR-N-02) : les commandes du journal sont des chaînes
 * de caractères, jamais exécutées.
 */
import { CAS, chargeUtile, type CasGarde } from "./guard-cases.js";
import { lancerGarde, type ReponseGarde } from "./run-guard.js";

const HOOK = "scripts/hooks/no-sound-guard.mjs";

const ENTETE = [
  "# Journal du garde no-sound-guard (cahier §14.3, AIR-N-02) — preuve, lot W8.",
  "#",
  "# Chaque cas est une charge utile JSON déposée sur l'entrée standard du hook,",
  "# comme Kiro le fait : { hook_event_name, cwd, session_id, tool_name,",
  "# tool_input.command }. AUCUNE commande n'est exécutée : le hook les lit et",
  "# les refuse ou les accepte — aucun son n'est jamais émis.",
  "#",
  "# Refus : code 1, raison sur la sortie d'erreur (Kiro bloque l'outil).",
  "# Acceptation : code 0.",
  "#",
  "# Régénérer ce journal :",
  "#   npx tsx apps/bench/src/preuves/make-guard-log.ts > docs/preuves/no-sound-guard.log",
].join("\n");

/** Un bloc du journal : la commande, le code, le message. */
function bloc(index: number, cas: CasGarde, reponse: ReponseGarde): string {
  const numero = String(index + 1).padStart(2, "0");
  const message = reponse.message
    .split("\n")
    .map((ligne, i) => (i === 0 ? ligne : `           ${ligne}`))
    .join("\n");
  return [
    `── ${numero} · ${cas.nom} ──`,
    `commande : ${cas.commande}`,
    `attendu  : ${cas.attendu}`,
    `code     : ${reponse.code}`,
    `message  : ${message}`,
  ].join("\n");
}

function conforme(cas: CasGarde, reponse: ReponseGarde): boolean {
  return cas.attendu === "refus" ? reponse.code !== 0 : reponse.code === 0;
}

let refus = 0;
let acceptations = 0;
const desaccords: string[] = [];

console.log(ENTETE);
console.log("");
for (let i = 0; i < CAS.length; i += 1) {
  const cas = CAS[i];
  if (!cas) continue;
  const reponse = await lancerGarde(HOOK, chargeUtile(cas.commande, process.cwd()));
  if (!conforme(cas, reponse)) desaccords.push(`${cas.nom} : attendu ${cas.attendu}, code ${reponse.code}`);
  if (reponse.code !== 0) refus += 1;
  else acceptations += 1;
  console.log(bloc(i, cas, reponse));
  console.log("");
}

console.log(`# Bilan : ${refus} refus, ${acceptations} acceptations, sur ${CAS.length} charges utiles.`);
if (desaccords.length > 0) {
  for (const desaccord of desaccords) console.error(`✗ ${desaccord}`);
  process.exit(1);
}
console.error(`✓ ${CAS.length}/${CAS.length} cas conformes à l'attendu.`);
