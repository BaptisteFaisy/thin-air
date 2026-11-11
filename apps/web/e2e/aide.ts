/**
 * Les outils partagés par les deux specs de bout en bout : le journal réseau,
 * les sondes posées dans la page (caméra, moteur audio, messages d'état), la
 * vidéo de la fausse caméra, l'injection d'axe-core et la lecture des noms
 * accessibles. Un seul endroit, aucune duplication (règle du dépôt).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const require_ = createRequire(import.meta.url);

/** Où atterrissent les preuves écrites (dossier ignoré par git). */
export const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), "..", "out", "e2e");

/** L'origine du site servi par `vite preview` : rien ne doit sort d'ici. */
export const ORIGINE = "http://127.0.0.1:4173";

/**
 * Les arguments du navigateur : aucun son (AIR-N-02), fausse caméra et
 * fausse autorisation, lecture audio permise pour que le moteur s'ouvre.
 */
export const ARGS = [
  "--mute-audio",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--autoplay-policy=no-user-gesture-required",
];

/** Écrit une preuve JSON dans `out/e2e/` et rend son chemin. */
export function ecrisJson(nom: string, valeur: unknown): string {
  mkdirSync(DOSSIER, { recursive: true });
  const chemin = join(DOSSIER, nom);
  writeFileSync(chemin, `${JSON.stringify(valeur, null, 2)}\n`, "utf8");
  return chemin;
}

export interface Entree {
  readonly phase: string;
  readonly t: number;
  readonly methode: string;
  readonly url: string;
}

export interface Journal {
  readonly entrees: Entree[];
  readonly phase: (nom: string) => void;
}

/** Note chaque requête de la page, avec la phase du parcours en cours. */
export function journalise(page: Page): Journal {
  const entrees: Entree[] = [];
  let phase = "chargement";
  page.on("request", (requete) => {
    entrees.push({ phase, t: Date.now(), methode: requete.method(), url: requete.url() });
  });
  return { entrees, phase: (nom: string) => void (phase = nom) };
}

export interface Sondes {
  readonly contraintes: readonly unknown[];
  readonly audio: number;
  readonly etats: readonly string[];
}

/**
 * Pose des sondes dans la page AVANT son chargement : les contraintes de la
 * caméra demandée, la construction du moteur audio, et tous les messages
 * d'état apparus (même les plus brefs).
 */
export async function installeSondes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fenetre = window as unknown as Record<string, unknown>;
    const sondes = { contraintes: [] as unknown[], audio: 0, etats: [] as string[] };
    fenetre.__sondes = sondes;
    const media = navigator.mediaDevices;
    if (media) {
      const vrai = media.getUserMedia.bind(media);
      media.getUserMedia = (contraintes: unknown) => {
        sondes.contraintes.push(contraintes === undefined ? null : JSON.parse(JSON.stringify(contraintes)));
        return vrai(contraintes as MediaStreamConstraints);
      };
    }
    const AudioContextBase = window.AudioContext;
    if (AudioContextBase) {
      class AudioSonde extends AudioContextBase {
        constructor(...args: ConstructorParameters<typeof AudioContextBase>) {
          super(...args);
          sondes.audio += 1;
        }
      }
      fenetre.AudioContext = AudioSonde;
    }
    const noter = () => {
      document.querySelectorAll(".notice").forEach((noeud) => {
        const texte = (noeud.textContent ?? "").trim();
        if (texte !== "" && !sondes.etats.includes(texte)) sondes.etats.push(texte);
      });
    };
    new MutationObserver(noter).observe(document, { childList: true, subtree: true, characterData: true });
    document.addEventListener("DOMContentLoaded", noter);
  });
}

/** Relit les sondes posées par `installeSondes`. */
export async function lisSondes(page: Page): Promise<Sondes> {
  return page.evaluate(() => {
    const fenetre = window as unknown as Record<string, unknown>;
    return (fenetre.__sondes ?? { contraintes: [], audio: 0, etats: [] }) as Sondes;
  });
}

/**
 * Une vidéo de synthèse en guise de caméra : 30 images YUV 4:2:0, une tache
 * claire qui bouge. Aucun fichier binaire dans le dépôt : elle est écrite dans
 * `out/e2e/`, au moment du test.
 */
export function genereVideo(chemin: string): string {
  const largeur = 320;
  const hauteur = 240;
  const images = 30;
  const morceaux: Buffer[] = [Buffer.from(`YUV4MPEG2 W${largeur} H${hauteur} F30:1 Ip A1:1 C420mpeg2\n`, "ascii")];
  for (let index = 0; index < images; index += 1) {
    const luminance = Buffer.alloc(largeur * hauteur, 40);
    const cb = Buffer.alloc((largeur / 2) * (hauteur / 2), 90);
    const cr = Buffer.alloc((largeur / 2) * (hauteur / 2), 200);
    const origineX = 20 + index * 8;
    for (let dy = 0; dy < 60; dy += 1) {
      for (let dx = 0; dx < 60; dx += 1) {
        const px = origineX + dx;
        const py = 60 + dy;
        if (px < largeur && py < hauteur) luminance[py * largeur + px] = 220;
      }
    }
    morceaux.push(Buffer.from("FRAME\n", "ascii"), luminance, cb, cr);
  }
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, Buffer.concat(morceaux));
  return chemin;
}

/** Charge axe-core dans la page (le paquet est déjà installé). */
export async function injecteAxe(page: Page): Promise<void> {
  await page.addScriptTag({ path: require_.resolve("axe-core/axe.min.js") });
}

export interface ViolationAxe {
  readonly id: string;
  readonly impact: string | null;
  readonly help: string;
  readonly nodes: readonly { readonly target: readonly string[]; readonly failureSummary?: string }[];
}

/** Lance axe-core sur la page : WCAG 2.0 à 2.2, niveaux A et AA. */
export async function violationsAxe(page: Page): Promise<ViolationAxe[]> {
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<unknown> } }).axe;
    const resultat = (await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
    })) as { violations: { id: string; impact: string | null; help: string; nodes: { target: string[]; failureSummary?: string }[] }[] };
    return resultat.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((noeud) => ({ target: noeud.target, failureSummary: noeud.failureSummary })),
    }));
  });
}

/** Ce qui compte pour la recette : rien de critique, rien de sérieux. */
export function graves(violations: readonly ViolationAxe[]): ViolationAxe[] {
  return violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
}

/** Le nom accessible de l'élément qui a le focus. */
export async function nomAccessible(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (element === null) return "";
    const aria = element.getAttribute("aria-label");
    if (aria !== null && aria.trim() !== "") return aria.trim();
    const labels = (element as unknown as { labels?: NodeListOf<HTMLElement> }).labels;
    if (labels !== undefined && labels.length > 0) return (labels[0].innerText ?? "").trim();
    if (element.id !== "") {
      const etiquette = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (etiquette !== null) return (etiquette.innerText ?? "").trim();
    }
    return (element.innerText ?? element.textContent ?? "").trim();
  });
}

/** L'identifiant de l'élément qui a le focus ("" s'il n'en a pas). */
export async function identifiantActif(page: Page): Promise<string> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.id ?? "");
}

/** Le texte de la note en cours, tel qu'il est lu à l'écran (§12.4). */
export async function noteAffichee(page: Page): Promise<string> {
  return (await page.locator("p.note").innerText()).trim();
}
