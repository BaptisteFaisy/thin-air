/**
 * L'aide du banc d'essai. Elle est aussi un test : `bench --help` doit
 * s'exécuter sans exception et rendre le code 0 (cahier §11.6).
 */
import { SYNTH_SHAPES } from "./synth.js";

export const EXIT_CODES = "Codes de sortie : 0 conforme · 1 écart ou échec · 2 erreur d'usage";

export const GENERAL_HELP = [
  "bench — le banc d'essai de Thin Air (cahier §11.6)",
  "",
  "Aucune de ces commandes n'émet un son : la preuve est un fichier et des nombres.",
  "",
  "  bench events  --take <prise> --instrument <fichier> [options]",
  "  bench render  --take <prise> --instrument <fichier> --out <dossier> [options]",
  "  bench compare <rapport> <référence> [options]",
  "  bench synth   <forme> [options]",
  "",
  "Formes de synthèse : " + SYNTH_SHAPES.join(", "),
  "",
  "Détail d'une commande : bench <commande> --help",
  EXIT_CODES,
].join("\n");

const AIDE_COMMUNE = [
  "  --settings <fichier>  réglages partiels (JSON), fusionnés sur les défauts §7.13",
  "  --quiet               n'imprimer que le résumé",
  "  --help                cette aide",
];

const AIDES: Readonly<Record<string, readonly string[]>> = {
  events: [
    "bench events — la liste des événements d'une prise (niveau 1 de preuve)",
    "",
    "  bench events --take <prise> --instrument <fichier> [options]",
    "",
    "  --take <prise>       prise JSON, format thin-air-take/1",
    "  --instrument <fichier>  instrument JSON, format thin-air-instrument/1",
    "  --one-hand           forcer le jeu à une main",
    "  --hold               forcer le maintien des notes",
    "  --json               sortir la liste brute, en JSON",
    ...AIDE_COMMUNE,
  ],
  render: [
    "bench render — événements, WAV et rapport d'une prise (niveau 2 de preuve)",
    "",
    "  bench render --take <prise> --instrument <fichier> --out <dossier> [options]",
    "",
    "  --take <prise>       prise JSON, format thin-air-take/1",
    "  --instrument <fichier>  instrument JSON, format thin-air-instrument/1",
    "  --out <dossier>      dossier de sortie, créé s'il manque",
    "  --no-wav             ne pas écrire render.wav (CI)",
    "  --one-hand           forcer le jeu à une main",
    "  --hold               forcer le maintien des notes",
    "  --json               sortir le rapport brut, en JSON",
    ...AIDE_COMMUNE,
    "",
    "Écrit events.json, render.wav et report.json. Aucun périphérique audio.",
  ],
  compare: [
    "bench compare — deux rapports, les tolérances de la section 13",
    "",
    "  bench compare <rapport> <référence> [options]",
    "",
    "  justesse            5 centièmes de demi-ton",
    "  instants de note    une image, soit 33 ms",
    "  crête, niveau moyen ±0,5 dB",
    "  silence final       ±100 ms",
    "",
    "  --json               sortir les écarts bruts, en JSON",
    "  --quiet              n'imprimer que le verdict",
    "  --help               cette aide",
    "",
    "Rend 0 si conforme, 1 dès le premier écart.",
  ],
  synth: [
    "bench synth — fabriquer une prise de synthèse",
    "",
    "  bench synth <forme> [options]",
    "",
    "  formes : " + SYNTH_SHAPES.join(", "),
    "",
    "  --out <fichier>      où écrire (défaut : takes/synth/<forme>.json)",
    "  --binary             codage compact de @thin-air/schema (encodeTake)",
    "  --fps <n>            cadence, 30 par défaut",
    "  --duration <s>       durée, celle de la forme par défaut",
    "  --seed <n>           graine du générateur, 1 par défaut",
    "  --from-u, --to-u     positions de départ et d'arrivée en u (0..1)",
    "  --from-v, --to-v     positions en v (0..1)",
    "  --center-u, --center-v, --amplitude  tremblement autour d'un centre",
    "  --leave-at <s>       instant de sortie du cadre",
    "  --quiet, --help",
  ],
};

/** L'aide d'une commande, ou l'aide générale si elle est inconnue. */
export function commandHelp(command?: string): string {
  if (command === undefined) return GENERAL_HELP;
  const lignes = AIDES[command];
  return lignes === undefined ? GENERAL_HELP : lignes.join("\n");
}
