/**
 * Structure d'un fichier d'instrument (cahier §11.4, annexe B).
 *
 * Le contrat de référence est `packages/core/src/types.ts` : ce module en
 * reprend les clés, rien d'autre. La validation par schéma Zod — et donc
 * la propriété AIR-P-19 — est le lot A4 (`packages/schema`) ; cette
 * structure est le contrôle minimal que la garde peut faire sans dépendre
 * d'un paquet encore en chantier.
 *
 * Un fichier est refusé EN ENTIER, avec la liste des raisons (AIR-F-43) :
 * jamais de valeur par défaut silencieuse.
 */

export const FORMAT = "thin-air-instrument/1";

export const CLES_RACINE = new Set([
  "format", "name", "pointer", "scale", "range", "strings", "zones",
  "snap", "voices", "controls", "gestures", "oneHand", "sound", "defaults",
]);

const POINTEURS = new Set(["index", "palm"]);
const MOTEURS = new Set(["osc", "pluck", "fm", "drum"]);
const ONDES = new Set(["sine", "triangle", "sawtooth", "square"]);
const MESURES = new Set(["u", "v", "pinch", "open", "speedU", "speedV"]);
const CIBLES = new Set(["pitch", "gain", "cutoff", "vibrato"]);
const COURBES = new Set(["linear", "db48"]);
const ROLES = new Set(["pitch", "volume"]);
const GESTES = new Set(["pinch", "fist", "cross", "enter", "leave", "dwell", "handLost"]);
const ACTIONS = new Set(["pluck", "damp", "mute", "hold", "strike"]);
const FORCES = new Set(["speed", "fixed"]);
/** Les clés de `Settings` (types.ts) : un instrument peut en surcharger une part. */
export const CLES_REGLAGES = new Set([
  "frameRateIdeal", "numHands", "graceMs", "fcMin", "beta", "fcD", "fcTrigger",
  "pinchOn", "pinchOff", "fistOn", "fistOff", "zoneMargin", "noteHysteresis",
  "stringRearmMs", "minPluckSpeed", "paramTauMs", "lookaheadMs", "maxVoices",
  "masterGainDb", "ceilingDb", "cameraLatencyMs", "tempo", "loopBars",
  "beatsPerBar", "dwellMs", "wirelessWarnMs", "stallReleaseMs", "magnet",
  "leftHanded", "oneHand", "hold", "reverb", "quantize", "quantizeStrength",
  "showCamera",
]);

/** Les six instruments du cahier §7.8 (AIR-F-21, 22, 23). */
export const INSTRUMENTS_ATTENDUS = ["phantom", "harp", "choir", "bells", "drone", "grid-drums"];

function estNombre(valeur) {
  return typeof valeur === "number" && Number.isFinite(valeur);
}

function estEntier(valeur, borneInf, borneSup) {
  return Number.isInteger(valeur) && valeur >= borneInf && valeur <= borneSup;
}

function dans(objet, cle, valeurs) {
  const valeur = objet[cle];
  if (!valeurs.has(valeur)) {
    return `${cle} : « ${String(valeur)} » n'est pas dans { ${[...valeurs].join(", ")} }`;
  }
  return null;
}

function clesInconnues(objet, autorisees) {
  return Object.keys(objet).filter((cle) => !autorisees.has(cle));
}

function paire(objet, cle, erreurs) {
  const valeur = objet[cle];
  if (!Array.isArray(valeur) || valeur.length !== 2 || !valeur.every(estNombre)) {
    erreurs.push(`${cle} : doit être une paire de nombres`);
    return;
  }
  if (valeur[0] === valeur[1]) erreurs.push(`${cle} : les deux bornes sont identiques`);
}

function validerGamme(gamme, erreurs) {
  if (!gamme || typeof gamme !== "object") return erreurs.push("scale : objet attendu");
  const inconnues = clesInconnues(gamme, new Set(["root", "steps"]));
  if (inconnues.length) erreurs.push(`scale : clés inconnues ${inconnues.join(", ")}`);
  if (!estEntier(gamme.root, 0, 127)) erreurs.push("scale.root : entier entre 0 et 127 attendu");
  if (!Array.isArray(gamme.steps) || gamme.steps.length === 0) {
    return erreurs.push("scale.steps : liste non vide attendue");
  }
  if (!gamme.steps.every((pas) => estEntier(pas, 0, 11))) {
    erreurs.push("scale.steps : entiers entre 0 et 11 attendus");
  }
}

function validerForme(forme, erreurs) {
  const donnees = [forme.range, forme.strings, forme.zones].filter((valeur) => valeur !== undefined);
  if (donnees.length === 0) return erreurs.push("ni range, ni strings, ni zones : §11.5");
  if (donnees.length > 1) erreurs.push("range, strings et zones sont exclusifs (§11.5)");
  if (forme.range !== undefined) {
    const { low, high } = forme.range;
    const inconnues = clesInconnues(forme.range, new Set(["low", "high"]));
    if (inconnues.length) erreurs.push(`range : clés inconnues ${inconnues.join(", ")}`);
    if (!estEntier(low, 0, 127) || !estEntier(high, 0, 127)) {
      erreurs.push("range : low et high doivent être des entiers entre 0 et 127");
    } else if (low >= high) {
      erreurs.push("range : low doit être strictement inférieur à high");
    }
  }
  if (forme.strings !== undefined) {
    const { count, axis } = forme.strings;
    const inconnues = clesInconnues(forme.strings, new Set(["count", "axis"]));
    if (inconnues.length) erreurs.push(`strings : clés inconnues ${inconnues.join(", ")}`);
    if (!estEntier(count, 1, 64)) erreurs.push("strings.count : entier entre 1 et 64 attendu");
    if (axis !== "u" && axis !== "v") erreurs.push("strings.axis : « u » ou « v » attendu");
  }
  if (forme.zones !== undefined) validerZones(forme.zones, erreurs);
}

function validerZones(zones, erreurs) {
  if (!zones || !Array.isArray(zones.zones) || zones.zones.length === 0) {
    return erreurs.push("zones.zones : liste non vide attendue");
  }
  const vus = new Set();
  for (const zone of zones.zones) {
    const inconnues = clesInconnues(zone, new Set(["id", "u0", "u1", "v0", "v1", "midi", "degree"]));
    if (inconnues.length) erreurs.push(`zone ${zone.id} : clés inconnues ${inconnues.join(", ")}`);
    if (typeof zone.id !== "string" || !zone.id.trim()) erreurs.push("zone : id texte non vide attendu");
    else if (vus.has(zone.id)) erreurs.push(`zone ${zone.id} : identifiant en double`);
    else vus.add(zone.id);
    for (const cle of ["u0", "u1", "v0", "v1"]) {
      if (!estNombre(zone[cle]) || zone[cle] < 0 || zone[cle] > 1) {
        erreurs.push(`zone ${zone.id} : ${cle} doit être un nombre entre 0 et 1`);
      }
    }
    if (zone.u0 >= zone.u1) erreurs.push(`zone ${zone.id} : u0 doit être inférieur à u1`);
    if (zone.v0 >= zone.v1) erreurs.push(`zone ${zone.id} : v0 doit être inférieur à v1`);
    const notes = [zone.midi, zone.degree].filter((valeur) => valeur !== undefined);
    if (notes.length !== 1) erreurs.push(`zone ${zone.id} : midi ou degree, exactement un des deux`);
  }
}

function validerMesures(liste, nom, erreurs) {
  if (liste === undefined) return;
  if (!Array.isArray(liste)) return erreurs.push(`${nom} : liste attendue`);
  liste.forEach((carte, index) => {
    const etiquette = `${nom}[${index}]`;
    const inconnues = clesInconnues(carte, new Set(["hand", "feature", "to", "curve", "from", "into"]));
    if (inconnues.length) erreurs.push(`${etiquette} : clés inconnues ${inconnues.join(", ")}`);
    if (carte.hand !== undefined && !ROLES.has(carte.hand)) {
      erreurs.push(`${etiquette}.hand : « pitch » ou « volume » attendu`);
    }
    const mesure = dans(carte, "feature", MESURES);
    if (mesure) erreurs.push(`${etiquette}.${mesure}`);
    const cible = dans(carte, "to", CIBLES);
    if (cible) erreurs.push(`${etiquette}.${cible}`);
    if (carte.curve !== undefined) {
      const courbe = dans(carte, "curve", COURBES);
      if (courbe) erreurs.push(`${etiquette}.${courbe}`);
    }
    if (carte.from !== undefined) paire(carte, "from", erreurs);
    if (carte.into !== undefined) paire(carte, "into", erreurs);
  });
}

function validerGestes(liste, erreurs) {
  if (liste === undefined) return;
  if (!Array.isArray(liste)) return erreurs.push("gestures : liste attendue");
  liste.forEach((carte, index) => {
    const etiquette = `gestures[${index}]`;
    const inconnues = clesInconnues(carte, new Set(["hand", "gesture", "do", "velocity", "value"]));
    if (inconnues.length) erreurs.push(`${etiquette} : clés inconnues ${inconnues.join(", ")}`);
    if (!carte.hand || (!ROLES.has(carte.hand) && carte.hand !== "any")) {
      erreurs.push(`${etiquette}.hand : « pitch », « volume » ou « any » attendu`);
    }
    const geste = dans(carte, "gesture", GESTES);
    if (geste) erreurs.push(`${etiquette}.${geste}`);
    const action = dans(carte, "do", ACTIONS);
    if (action) erreurs.push(`${etiquette}.${action}`);
    if (carte.velocity !== undefined) {
      const force = dans(carte, "velocity", FORCES);
      if (force) erreurs.push(`${etiquette}.${force}`);
    }
    if (carte.value !== undefined && !estNombre(carte.value)) {
      erreurs.push(`${etiquette}.value : nombre attendu`);
    }
  });
}

function validerSon(son, erreurs) {
  if (!son || typeof son !== "object") return erreurs.push("sound : objet attendu");
  const inconnues = clesInconnues(son, new Set([
    "engine", "wave", "second", "attackMs", "releaseMs", "glideMs", "decay",
    "brightness", "fmRatio", "fmIndex", "detuneCents", "noiseMs", "toneHz",
  ]));
  if (inconnues.length) erreurs.push(`sound : clés inconnues ${inconnues.join(", ")}`);
  const moteur = dans(son, "engine", MOTEURS);
  if (moteur) erreurs.push(`sound.${moteur}`);
  if (son.wave !== undefined) {
    const onde = dans(son, "wave", ONDES);
    if (onde) erreurs.push(`sound.${onde}`);
  }
  for (const cle of ["second", "attackMs", "releaseMs", "glideMs", "decay", "fmRatio", "fmIndex", "detuneCents", "noiseMs", "toneHz"]) {
    if (son[cle] !== undefined && !estNombre(son[cle])) erreurs.push(`sound.${cle} : nombre attendu`);
  }
  if (son.brightness !== undefined) {
    const { feature, into } = son.brightness;
    if (feature !== "u" && feature !== "v") erreurs.push("sound.brightness.feature : « u » ou « v » attendu");
    if (!Array.isArray(into) || into.length !== 2 || !into.every(estNombre)) {
      erreurs.push("sound.brightness.into : paire de nombres attendue");
    }
  }
}

function validerReglages(reglages, erreurs) {
  if (reglages === undefined) return;
  if (!reglages || typeof reglages !== "object") return erreurs.push("defaults : objet attendu");
  const inconnues = clesInconnues(reglages, CLES_REGLAGES);
  if (inconnues.length) erreurs.push(`defaults : clés inconnues ${inconnues.join(", ")}`);
}

/**
 * Valide un fichier d'instrument déjà décodé.
 * Rend `{ ok: true }` ou `{ ok: false, erreurs: [...] }`.
 */
export function validerInstrument(forme) {
  const erreurs = [];
  if (!forme || typeof forme !== "object" || Array.isArray(forme)) {
    return { ok: false, erreurs: ["le fichier doit contenir un objet"] };
  }
  const inconnues = clesInconnues(forme, CLES_RACINE);
  if (inconnues.length) erreurs.push(`clés inconnues : ${inconnues.join(", ")}`);
  if (forme.format !== FORMAT) erreurs.push(`format : « ${FORMAT} » attendu`);
  if (typeof forme.name !== "string" || !forme.name.trim()) erreurs.push("name : texte non vide attendu");
  const pointeur = dans(forme, "pointer", POINTEURS);
  if (pointeur) erreurs.push(pointeur);
  validerGamme(forme.scale, erreurs);
  validerForme(forme, erreurs);
  if (!estNombre(forme.snap) || forme.snap < 0 || forme.snap > 1) {
    erreurs.push("snap : nombre entre 0 et 1 attendu");
  }
  if (!estEntier(forme.voices, 1, 64)) erreurs.push("voices : entier entre 1 et 64 attendu");
  validerMesures(forme.controls, "controls", erreurs);
  validerMesures(forme.oneHand, "oneHand", erreurs);
  validerGestes(forme.gestures, erreurs);
  validerSon(forme.sound, erreurs);
  validerReglages(forme.defaults, erreurs);
  return erreurs.length === 0 ? { ok: true } : { ok: false, erreurs };
}
