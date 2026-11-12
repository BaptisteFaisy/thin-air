/**
 * Le registre, testé en ligne de commande (cahier §6.2, AIR-F-43, AIR-F-45).
 *
 * `node --test scripts/registre.test.mjs` — Node pur, comme le script testé.
 * Vitest ne ramasse que les tests sous `packages` et `apps` (`vitest.config.ts`,
 * non modifiable ici) : ce banc vit donc hors de Vitest, volontairement.
 *
 * Quatre fichiers en fixture, tous locaux : un instrument valide, un instrument
 * incohérent, un JSON cassé et un JSON qui n'est pas un instrument. Aucune
 * requête réseau (AIR-N-01), aucun son (AIR-N-02), rien d'écrit hors `out/`.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

const SCRIPT = fileURLToPath(new URL("./registre.mjs", import.meta.url));

const VALIDE = {
  format: "thin-air-instrument/1",
  name: "Fixture",
  pointer: "index",
  scale: { root: 60, steps: [0, 4, 7] },
  range: { low: 60, high: 72 },
  snap: 0.5,
  voices: 2,
  sound: { engine: "osc", wave: "triangle" },
};

/** `pluck` exige `decay` : le fichier est refusé en entier, avec la raison. */
const INCOHERENT = { ...VALIDE, name: "Sans decay", sound: { engine: "pluck" } };
const CASSE = '{ "format": "thin-air-instrument/1", "name":';
const PAS_UN_INSTRUMENT = { note: "un texte, pas un instrument", format: "texte/1" };

let source = "";
let travail = "";
let avant = [];

before(() => {
  source = mkdtempSync(join(tmpdir(), "registre-source-"));
  travail = mkdtempSync(join(tmpdir(), "registre-travail-"));
  writeFileSync(join(source, "valide.json"), `${JSON.stringify(VALIDE, null, 2)}\n`);
  writeFileSync(join(source, "invalide.json"), `${JSON.stringify(INCOHERENT, null, 2)}\n`);
  writeFileSync(join(source, "casse.json"), CASSE);
  writeFileSync(join(source, "pas-un-instrument.json"), `${JSON.stringify(PAS_UN_INSTRUMENT, null, 2)}\n`);
  avant = readdirSync(source).sort();
});

after(() => {
  for (const dossier of [source, travail]) {
    if (dossier.startsWith(tmpdir())) rmSync(dossier, { recursive: true, force: true });
  }
});

/** Lance le registre avec `travail` comme dossier courant : `out/` y atterrit. */
function lancer(...args) {
  const resultat = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: travail,
    encoding: "utf8",
  });
  return { code: resultat.status, stdout: resultat.stdout, stderr: resultat.stderr };
}

function lireIndex() {
  return JSON.parse(readFileSync(join(travail, "out", "registre.json"), "utf8"));
}

describe("AIR-F-43 — un fichier invalide est refusé avec sa raison", () => {
  it("indexe le valide et liste les trois autres avec leurs raisons", () => {
    const run = lancer(source);
    assert.equal(run.code, 0, run.stderr);

    const index = lireIndex();
    assert.equal(index.valides.length, 1);
    assert.equal(index.valides[0].nom, "Fixture");
    assert.equal(index.valides[0].chemin, "valide.json");
    assert.equal(index.valides[0].moteur, "osc");
    assert.equal(index.valides[0].aimant, 0.5);
    assert.deepEqual(index.valides[0].gamme, { racine: 60, degres: [0, 4, 7] });
    assert.equal(index.valides[0].geometrie, "étendue 60–72");
    assert.ok(index.valides[0].fragment.length > 0, "le fragment de partage est produit");

    assert.equal(index.refuses.length, 3);
    const raisons = Object.fromEntries(index.refuses.map((r) => [r.chemin, r.raisons.join(" ; ")]));
    assert.match(raisons["casse.json"], /JSON illisible/);
    assert.match(raisons["invalide.json"], /decay/);
    assert.match(raisons["pas-un-instrument.json"], /format/);
    for (const refus of index.refuses) assert.ok(refus.raisons.length > 0, `${refus.chemin} : raison vide`);
  });

  it("n'écrit rien hors out/, et ne touche pas à la source", () => {
    lancer(source);
    assert.deepEqual(readdirSync(travail).sort(), ["out"]);
    assert.deepEqual(readdirSync(join(travail, "out")).sort(), ["registre.json"]);
    assert.deepEqual(readdirSync(source).sort(), avant);
  });

  it("est déterministe : deux runs, deux octets identiques", () => {
    lancer(source, "--out", "out/registre.json");
    const premier = readFileSync(join(travail, "out", "registre.json"), "utf8");
    lancer(source, "--out", "out/registre.json");
    assert.equal(readFileSync(join(travail, "out", "registre.json"), "utf8"), premier);
  });
});

describe("AIR-F-45 — le fragment circule sans serveur", () => {
  it("--publier imprime un Markdown collable, lien de partage compris", () => {
    const run = lancer(source, "--publier");
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, /\| Instrument \| Moteur \| Géométrie \| Aimant \| Voix \| Fichier \| Lien \|/);
    assert.match(run.stdout, /#i=[A-Za-z0-9_-]+/);
    assert.match(run.stdout, /Fichiers refusés/);
  });

  it("sort 1 quand rien n'est valide, 2 quand la source est inexploitable", () => {
    const vide = mkdtempSync(join(tmpdir(), "registre-vide-"));
    assert.equal(lancer(vide).code, 1);
    rmSync(vide, { recursive: true, force: true });
    assert.equal(lancer(join(source, "absent.json")).code, 2);
    assert.equal(lancer().code, 2);
  });
});
