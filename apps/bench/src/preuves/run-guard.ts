/**
 * Lancer le garde `no-sound-guard` en processus enfant, comme Kiro le fait :
 * la charge utile JSON sur l'entrée standard, le verdict dans le code de
 * sortie et le message sur la sortie d'erreur (refus) ou standard
 * (acceptation). Rien d'autre n'est exécuté : la commande de la charge utile
 * n'est jamais lancée, aucun son n'est émis (AIR-N-02).
 *
 * Partagé par la preuve figée (`make-guard-log.ts`) et par le test
 * (`no-sound-guard.test.ts`) : une seule implémentation.
 */
import { spawn } from "node:child_process";

export interface ReponseGarde {
  /** Code de sortie : 0 = acceptation, 1 = refus. */
  readonly code: number;
  /** Le message du garde (sortie d'erreur si refus, standard sinon). */
  readonly message: string;
}

export function lancerGarde(hook: string, payload: unknown): Promise<ReponseGarde> {
  return new Promise((resoudre) => {
    const enfant = spawn(process.execPath, [hook], { stdio: ["pipe", "pipe", "pipe"] });
    let sortie = "";
    let erreur = "";
    enfant.stdout.on("data", (bloc) => {
      sortie += String(bloc);
    });
    enfant.stderr.on("data", (bloc) => {
      erreur += String(bloc);
    });
    enfant.on("error", () => resoudre({ code: 1, message: "impossible de lancer le garde" }));
    enfant.on("close", (code) =>
      resoudre({
        code: code ?? 1,
        message: (code === 0 ? sortie : erreur).trim(),
      }),
    );
    enfant.stdin.write(JSON.stringify(payload));
    enfant.stdin.end();
  });
}
