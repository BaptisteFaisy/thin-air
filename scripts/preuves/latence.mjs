#!/usr/bin/env node
/**
 * La mesure du retard, composante par composante (cahier §5.1, §5.2 ;
 * AIR-F-31, AIR-F-32, AIR-N-05, AIR-N-12).
 *
 * L'outil construit le site (`vite build apps/web`) s'il manque, le sert en
 * local (`vite preview`, port 4178), ouvre Chromium en headless avec une
 * caméra simulée et **sans son**, puis relève dans la page : `baseLatency`,
 * `outputLatency`, `sampleRate`, l'intervalle réel entre images, le temps
 * d'analyse du modèle s'il se charge, et le temps de `TakeProcessor.push`.
 * Il écrit `out/latency-<machine>.json`, affiche un tableau lisible, et la
 * seconde machine se mesure avec la même commande (`--machine "r630"`).
 *
 * AUCUN son : `--mute-audio` est obligatoire, aucun oscillateur n'est créé,
 * aucun volume n'est touché (AIR-N-02). AUCUNE requête vers l'extérieur :
 * tout est servi en local (AIR-N-01).
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const RACINE = fileURLToPath(new URL("../..", import.meta.url));
const DOSSIER = join(RACINE, "out");
const BIN = join(RACINE, "node_modules", ".bin");
const PORT = 4178;
const CHEMIN_SITE = "/thin-air/";
const DUREE_CAMERA_MS = 2500;

/* La sonde : du code exécuté dans la page, bundlé par esbuild. */

const SONDE_TS = `/**
 * La sonde de mesure du retard, exécutée dans la page (lot W9).
 * Elle ne fait aucun son : pas d'oscillateur, pas de lecture, pas de volume.
 */
import { DEFAULT_SETTINGS, TakeProcessor } from "@thin-air/core";
import { computeLatencyReport } from "../../packages/audio/src/graph/latency.js";
import instrumentJson from "../../instruments/harp.json";

const IMAGE_TRAITEMENT = 300;

function mediane(valeurs) {
  if (valeurs.length === 0) return Number.NaN;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 1 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

async function mesurerAudio() {
  const Contexte = window.AudioContext || window.webkitAudioContext;
  if (Contexte === undefined) {
    return {
      baseLatencyMs: null,
      outputLatencyMs: null,
      sampleRate: null,
      outputLatencyDeclare: false,
      raison: "pas d'AudioContext dans ce navigateur",
    };
  }
  const ctx = new Contexte({ latencyHint: "interactive" });
  try {
    const sortie = ctx.outputLatency;
    return {
      baseLatencyMs: ctx.baseLatency * 1000,
      outputLatencyMs: typeof sortie === "number" ? sortie * 1000 : null,
      sampleRate: ctx.sampleRate,
      outputLatencyDeclare: typeof sortie === "number",
    };
  } finally {
    await ctx.close();
  }
}

function resumerImages(horodatages, methode) {
  const deltas = [];
  for (let i = 1; i < horodatages.length; i++) deltas.push(horodatages[i] - horodatages[i - 1]);
  const milieu = mediane(deltas);
  return {
    methode: methode,
    images: horodatages.length,
    intervalleMedianeMs: Number.isFinite(milieu) ? milieu : null,
    fps: Number.isFinite(milieu) && milieu > 0 ? 1000 / milieu : null,
  };
}

function collecterImages(video, dureeMs) {
  return new Promise((resoudre) => {
    const horodatages = [];
    const fin = performance.now() + dureeMs;
    if (typeof video.requestVideoFrameCallback === "function") {
      const pas = (maintenant) => {
        horodatages.push(maintenant);
        if (maintenant < fin) video.requestVideoFrameCallback(pas);
        else resoudre(resumerImages(horodatages, "requestVideoFrameCallback"));
      };
      video.requestVideoFrameCallback(pas);
      return;
    }
    const pas = (maintenant) => {
      horodatages.push(maintenant);
      if (maintenant < fin) requestAnimationFrame(pas);
      else resoudre(resumerImages(horodatages, "requestAnimationFrame"));
    };
    requestAnimationFrame(pas);
  });
}

function texteRaison(raison) {
  if (raison instanceof Error) return raison.message;
  if (typeof raison === "object" && raison !== null && raison.type !== undefined) {
    return "evenement " + String(raison.type);
  }
  return String(raison);
}

async function cameraSimulee() {
  const video = { width: { ideal: 640 }, height: { ideal: 480 } };
  const contraintes = [
    { video: Object.assign({ frameRate: { exact: 30 } }, video), audio: false },
    { video: Object.assign({ frameRate: { ideal: 30 } }, video), audio: false },
    { video: video, audio: false },
  ];
  let flux = null;
  for (const contrainte of contraintes) {
    try {
      flux = await navigator.mediaDevices.getUserMedia(contrainte);
      break;
    } catch (raison) {
      flux = null;
    }
  }
  if (flux === null) throw new Error("camera simulee refusee par le navigateur");
  const piste = flux.getVideoTracks()[0];
  const reglages = piste === undefined ? {} : piste.getSettings();
  const element = document.createElement("video");
  element.muted = true;
  element.playsInline = true;
  element.srcObject = flux;
  await element.play();
  return {
    video: element,
    fpsDemande: typeof reglages.frameRate === "number" ? reglages.frameRate : null,
    stop: () => flux.getTracks().forEach((p) => p.stop()),
  };
}

async function mesurerCamera(dureeMs) {
  try {
    const camera = await cameraSimulee();
    const resume = await collecterImages(camera.video, dureeMs);
    camera.stop();
    resume.fpsDemande = camera.fpsDemande;
    return resume;
  } catch (raison) {
    return {
      methode: "aucune",
      images: 0,
      intervalleMedianeMs: null,
      fps: null,
      fpsDemande: null,
      raison: texteRaison(raison),
    };
  }
}

async function modelePresent(urlModele) {
  try {
    const rep = await fetch(urlModele, { method: "HEAD" });
    const type = rep.headers.get("content-type") || "";
    return rep.ok && type.indexOf("text/html") === -1;
  } catch (raison) {
    return false;
  }
}

async function boucleAnalyse(detecteur, dureeMs) {
  const camera = await cameraSimulee();
  const durees = [];
  const debut = performance.now();
  let horodatage = 0;
  while (performance.now() - debut < dureeMs) {
    const t0 = performance.now();
    detecteur.detect(camera.video, horodatage);
    durees.push(performance.now() - t0);
    horodatage += 33;
    await new Promise((r) => requestAnimationFrame(r));
  }
  camera.stop();
  detecteur.close();
  const milieu = mediane(durees);
  return {
    mesure: true,
    medianeMs: Number.isFinite(milieu) ? milieu : null,
    images: durees.length,
    raison: "",
  };
}

async function mesurerAnalyse(dureeMs) {
  const loader = window.__vision;
  if (typeof loader !== "function") {
    return { mesure: false, medianeMs: null, images: 0, raison: "detecteur non charge dans la page" };
  }
  const urlModele = new URL("models/hand_landmarker.task", location.href).href;
  if (!(await modelePresent(urlModele))) {
    return {
      mesure: false,
      medianeMs: null,
      images: 0,
      raison: "modele absent du site (fichiers non versionnes, jamais telecharges ici)",
    };
  }
  try {
    const detecteur = await loader({
      modelUrl: urlModele,
      wasmRoot: new URL("models/wasm", location.href).href,
    });
    return await boucleAnalyse(detecteur, dureeMs);
  } catch (raison) {
    return { mesure: false, medianeMs: null, images: 0, raison: texteRaison(raison) };
  }
}

function pointsMain(cx, cy) {
  const points = [];
  for (let i = 0; i < 21; i++) {
    const angle = (i / 21) * Math.PI * 2;
    points.push([cx + 0.06 * Math.cos(angle), cy + 0.06 * Math.sin(angle), 0]);
  }
  return points;
}

function mainsSynthetiques(t) {
  return [
    { side: "right", score: 0.95, points: pointsMain(0.35 + 0.08 * Math.sin(t * 2), 0.5) },
    { side: "left", score: 0.9, points: pointsMain(0.65 - 0.08 * Math.sin(t * 2), 0.45) },
  ];
}

function mesurerTraitement() {
  const instrument = instrumentJson;
  const processeur = new TakeProcessor(instrument, DEFAULT_SETTINGS, { finish: false });
  const durees = [];
  for (let i = 0; i < IMAGE_TRAITEMENT; i++) {
    const image = { t: i / 30, hands: mainsSynthetiques(i / 30) };
    const debut = performance.now();
    processeur.push(image);
    durees.push(performance.now() - debut);
  }
  const milieu = mediane(durees);
  return {
    images: durees.length,
    medianeMs: Number.isFinite(milieu) ? milieu : 0,
    moyenneMs: durees.reduce((acc, valeur) => acc + valeur, 0) / durees.length,
    maxMs: Math.max.apply(null, durees),
  };
}

const sonde = {
  async mesurer(dureeMs) {
    const audio = await mesurerAudio();
    const camera = await mesurerCamera(dureeMs);
    const analyse = await mesurerAnalyse(dureeMs);
    const traitement = mesurerTraitement();
    const rapport = computeLatencyReport(
      {
        frameIntervalMs: camera.intervalleMedianeMs === null ? 0 : camera.intervalleMedianeMs,
        inferenceMs: analyse.medianeMs === null ? 0 : analyse.medianeMs,
        inferenceUnknown: analyse.mesure !== true,
        processingMs: traitement.medianeMs,
        audioBaseMs: audio.baseLatencyMs === null ? 0 : audio.baseLatencyMs,
        audioOutputMs: audio.outputLatencyMs,
      },
      DEFAULT_SETTINGS.cameraLatencyMs,
    );
    return { audio: audio, camera: camera, analyse: analyse, traitement: traitement, rapport: rapport };
  },
};

window.__sonde = sonde;
`;

/** Le détecteur de vision, bundlé à part : il n'est chargé que si le modèle est là. */
const VISION_TS = `import { loadLandmarker } from "@thin-air/vision";
window.__vision = loadLandmarker;
`;

/* Les outils du script. */

/** Les arguments : `--machine "…"`, `--rebuild`, `--port`. */
function lireArgs(argv) {
  const valeur = (nom, defaut) => {
    const i = argv.indexOf(nom);
    const suivant = i >= 0 ? argv[i + 1] : undefined;
    return suivant !== undefined && !suivant.startsWith("--") ? suivant : defaut;
  };
  const machine = valeur("--machine", "pc — baptiste-MS-7D18");
  return { machine: machine, rebuild: argv.includes("--rebuild"), port: Number(valeur("--port", String(PORT))) };
}

/** Un nom de fichier lisible à partir du nom de la machine. */
function slug(nom) {
  const sansAccent = nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return sansAccent.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Lance un binaire local et rend son code de sortie et ses sorties. */
function lancer(binaire, args) {
  return new Promise((resoudre) => {
    const enfant = spawn(binaire, args, { cwd: RACINE, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    enfant.stdout.on("data", (bloc) => {
      out += String(bloc);
    });
    enfant.stderr.on("data", (bloc) => {
      err += String(bloc);
    });
    enfant.on("error", (raison) => resoudre({ code: 1, out: out, err: String(raison) }));
    enfant.on("close", (code) => resoudre({ code: code === null ? 1 : code, out: out, err: err }));
  });
}

/** Le site est-il déjà construit ? */
async function siteConstruit() {
  try {
    await access(join(RACINE, "apps", "web", "dist", "index.html"));
    return true;
  } catch {
    return false;
  }
}

/** Construit le site s'il manque. */
async function construireSite(rebuild) {
  if (!rebuild && (await siteConstruit())) return "déjà construit";
  const resultat = await lancer(join(BIN, "vite"), ["build", "apps/web"]);
  if (resultat.code !== 0) throw new Error("la construction du site a échoué :\n" + resultat.err.slice(-1500));
  return "construit";
}

/** Bundle une source TypeScript ; renvoie le code, ou null si esbuild refuse. */
async function bundler(source, sortie, nomGlobal) {
  const resultat = await lancer(join(BIN, "esbuild"), [
    source,
    "--bundle",
    "--format=iife",
    "--global-name=" + nomGlobal,
    "--platform=browser",
    "--target=es2022",
    "--define:process.env.NODE_ENV=\"production\"",
    "--outfile=" + sortie,
  ]);
  if (resultat.code !== 0) return null;
  return readFile(sortie, "utf8");
}

/** Écrit la sonde et la bundle ; renvoie le code JS et une note d'échec. */
async function bundlerSonde() {
  const dossier = join(DOSSIER, "sonde");
  await mkdir(dossier, { recursive: true });
  const sources = { "sonde.ts": SONDE_TS, "vision.ts": VISION_TS };
  for (const [nom, source] of Object.entries(sources)) {
    await writeFile(join(dossier, nom), source, "utf8");
  }
  const sourceSonde = join(dossier, "sonde.ts");
  const code = await bundler(sourceSonde, join(dossier, "sonde.js"), "__sondeBundle");
  if (code === null) throw new Error("la sonde n'a pas pu être bundlée (esbuild a échoué)");
  const vision = await bundler(join(dossier, "vision.ts"), join(dossier, "vision.js"), "__visionBundle");
  return {
    code: code,
    vision: vision,
    note: vision === null ? "paquet de vision non bundlable : l'analyse du modèle ne sera pas mesurée" : "",
  };
}

/** Démarre `vite preview` et attend qu'il réponde ; renvoie l'URL ou null. */
async function demarrerSite(port) {
  const enfant = spawn(join(BIN, "vite"), ["preview", "apps/web", "--port", String(port), "--strictPort"], {
    cwd: RACINE,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const arreter = () => enfant.exitCode === null && enfant.kill("SIGTERM");
  const url = "http://localhost:" + port + CHEMIN_SITE;
  for (let essai = 0; essai < 60; essai++) {
    if (enfant.exitCode !== null) return null;
    try {
      const rep = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (rep.ok) return { url: url, arreter: arreter };
    } catch {
      /* le serveur n'écoute pas encore */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  arreter();
  return null;
}

/** Les options de Chromium : pas de son, caméra simulée, permission accordée. */
const OPTIONS_CHROMIUM = {
  headless: true,
  args: [
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
};

/** Ouvre la page, injecte la sonde et relève les mesures. */
async function mesurerDansLaPage(site, sonde) {
  const navigateur = await chromium.launch(OPTIONS_CHROMIUM);
  try {
    const contexte = await navigateur.newContext({ permissions: ["camera"] });
    const page = await contexte.newPage();
    const erreurs = [];
    page.on("pageerror", (raison) => erreurs.push(String(raison)));
    if (site === null) {
      await page.setContent('<!doctype html><html lang="fr"><body></body></html>');
    } else {
      await page.goto(site.url, { waitUntil: "load", timeout: 30000 });
    }
    await page.addScriptTag({ content: sonde.code });
    if (sonde.vision !== null) await page.addScriptTag({ content: sonde.vision });
    const mesures = await page.evaluate((duree) => window.__sonde.mesurer(duree), DUREE_CAMERA_MS);
    if (erreurs.length > 0) mesures.erreursPage = erreurs;
    return mesures;
  } finally {
    await navigateur.close();
  }
}

/** Formate une valeur mesurée ; « — » quand elle n'existe pas. */
function nombre(valeur, decimales) {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur.toFixed(decimales) : "—";
}

/** Les lignes du tableau : composante, valeur, statut (mesuré/estimé), note. */
function lignes(mesures) {
  const { audio, camera, analyse, traitement, rapport } = mesures;
  const imageOk = typeof camera.intervalleMedianeMs === "number";
  const sortieOk = audio.outputLatencyDeclare === true;
  const rows = [
    ["Attente de l'image suivante", nombre(camera.intervalleMedianeMs, 1) + " ms", imageOk ? "mesuré" : "estimé", String(camera.methode) + ", " + nombre(camera.fps, 1) + " im/s (demandé : " + nombre(camera.fpsDemande, 0) + ")"],
    ["Analyse des mains", nombre(analyse.medianeMs, 1) + " ms", analyse.mesure === true ? "mesuré" : "estimé", analyse.mesure === true ? "" : String(analyse.raison)],
    ["Traitement (TakeProcessor.push)", nombre(traitement.medianeMs, 3) + " ms", "mesuré", "médiane sur " + String(traitement.images) + " images ; moyenne " + nombre(traitement.moyenneMs, 3) + " ms, max " + nombre(traitement.maxMs, 2) + " ms"],
    ["Sortie audio — baseLatency", nombre(audio.baseLatencyMs, 1) + " ms", "mesuré", "sampleRate " + String(audio.sampleRate) + " Hz"],
    ["Sortie audio — outputLatency", nombre(audio.outputLatencyMs, 1) + " ms", sortieOk ? "mesuré" : "mesure partielle", sortieOk ? "" : "le navigateur ne déclare pas outputLatency"],
    ["Caméra (capteur, transport)", String(rapport.cameraAssumedMs) + " ms", "estimé", "non mesurable dans le navigateur"],
    ["Total mesurable", nombre(rapport.measuredTotalMs, 1) + " ms", "mesuré", rapport.partial === true ? "mesure partielle" : ""],
    ["Total estimé", nombre(rapport.estimatedTotalMs, 1) + " ms", "estimé", "mesurable + caméra estimée"],
  ];
  return rows.map(([composant, valeur, statut, note]) => ({ composant, valeur, statut, note }));
}

/** Le tableau lisible, dans la sortie du script. */
function afficher(lignes) {
  process.stdout.write("\n| Composante | Valeur | Statut | Note |\n|---|---|---|---|\n");
  for (const ligne of lignes) {
    process.stdout.write("| " + ligne.composant + " | " + ligne.valeur + " | " + ligne.statut + " | " + ligne.note + " |\n");
  }
  process.stdout.write("\n");
}

async function main() {
  const options = lireArgs(process.argv.slice(2));
  await mkdir(DOSSIER, { recursive: true });
  process.stdout.write("Machine : " + options.machine + "\n");
  process.stdout.write("Site : " + (await construireSite(options.rebuild)) + "\n");
  const sonde = await bundlerSonde();
  if (sonde.note !== "") process.stdout.write("Note : " + sonde.note + "\n");
  const site = await demarrerSite(options.port);
  if (site === null) {
    process.stdout.write("Le site n'a pas pu être servi : la mesure se fait sur une page minimale.\n");
  }
  let mesures;
  try {
    mesures = await mesurerDansLaPage(site, sonde);
  } finally {
    if (site !== null) site.arreter();
  }
  const rapport = {
    machine: options.machine,
    date: new Date().toISOString().slice(0, 10),
    navigateur: "Chromium (headless), sans son, caméra simulée",
    site: site === null ? "page minimale (site non servi)" : site.url,
    mesures: mesures,
  };
  const fichier = join(DOSSIER, "latency-" + slug(options.machine) + ".json");
  await writeFile(fichier, JSON.stringify(rapport, null, 2) + "\n", "utf8");
  process.stdout.write("Relevé écrit : " + fichier + "\n");
  afficher(lignes(mesures));
}

main().catch((raison) => {
  process.stderr.write("ÉCHEC : " + (raison instanceof Error ? raison.message : String(raison)) + "\n");
  process.exitCode = 1;
});
