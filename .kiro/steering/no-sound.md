---
inclusion: always
---

# Aucun son, jamais (AIR-N-02)

**L'agent n'émet aucun son.** Il ne lance aucun lecteur, ne règle ni le volume
ni la sortie audio de la machine, n'ouvre aucun périphérique, ne démarre aucun
navigateur de test avec écran ou sans l'option de son coupé.

## Ce qui est refusé

Le hook `no-sound-guard` (`scripts/hooks/no-sound-guard.mjs`) se déclenche
avant tout usage de l'outil `shell` et refuse :

- les lecteurs : `aplay`, `paplay`, `afplay`, `ffplay`, `mpv`, `vlc`, `cvlc`,
  `mplayer`, `speaker-test` ;
- les réglages de volume ou de sortie : `amixer`, `pactl`, `wpctl`,
  `alsamixer`, `pavucontrol`, `osascript` avec « volume » ;
- un navigateur de test avec écran (`--headed`, `headless: false`) ou sans
  option de son coupé (`--mute-audio`).

Refus = code de sortie non nul et message sur la sortie d'erreur : Kiro bloque
l'outil et transmet le message. Chaque invocation — refus comme acceptation —
est écrite dans **`out/hook-log.jsonl`**, dossier ignoré par git ; ce journal
est joint à la soumission (recette §18 : « le journal du hook `no-sound-guard`
est joint »).

## Comment prouver sans entendre

Toute preuve passe par le **banc d'essai** (§11.6) :

| Commande | Preuve |
|---|---|
| `bench events --take <prise> --instrument <fichier>` | la liste des événements : notes, instants, forces |
| `bench render --take <prise> --instrument <fichier> --out <dossier>` | `events.json`, `render.wav`, `report.json` — le WAV est un fichier, jamais joué |
| `bench compare <rapport> <référence>` | les écarts, avec les tolérances du §13 ; code non nul en cas d'écart |

Le rendu hors ligne calcule les échantillons dans un tableau, plus vite que le
temps vrai, et les écrit dans un fichier : aucun périphérique audio n'est
ouvert (§11.6). Pendant la construction, le serveur MCP du projet
(`render_take`, `list_notes`, `compare_reports`) sert d'oreilles en chiffres
(§11.7).

## La part qui reste à l'humain

Les mesures disent quelles notes sonnent, quand, à quelle fréquence et à quel
niveau ; elles ne disent pas si le son est beau (§13.4). Une séance d'écoute
humaine par lot, notée dans `docs/journal.md` avec sa date et ce qui a été
réglé à la suite (recette §18). L'agent ne la remplace jamais.
