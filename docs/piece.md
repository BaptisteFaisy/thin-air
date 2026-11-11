# La pièce de démonstration — `takes/pieces/seance-1min.json`

La musique de la vidéo du cahier (§17.1, 0:40 – 1:25) : une boucle de quatre
mesures à 90 battements par minute, jouée environ une minute, en **ré mineur
harmonique** (la gamme de saison du §7.7 : ré, mi, fa, sol, la, si bémol,
do dièse). Musique originale, composée pour l'occasion ; aucun air existant.

Rien ici n'a été écouté : les preuves sont des nombres, mesurés par le moteur
hors ligne de `@thin-air/audio` (le même que celui des tests, cahier §7.10).
Aucun son n'est émis pendant le rendu (AIR-N-02).

## Les nombres mesurés

Sortie réelle de `npx tsx apps/bench/src/piece.ts` :

```
pièce                : takes/pieces/seance-1min.json — 6 tours de boucle
échantillons         : 3072000 à 48000 Hz
durée                : 64.000 s
crête                : -5.94 dB (plafond -1 dB)
voix simultanées max : 6
notes par couche     : choir 8, drone 3, harp 16, phantom 15
WAV                  : out/piece.wav
```

- **3 072 000 échantillons** = 6 tours × 512 000 (la boucle de quatre mesures à
  90 vaut exactement 512 000 échantillons à 48 000 Hz, recette §18), soit
  64,000 s — « environ une minute » en boucle (§7.10).
- **Crête −5,94 dB** : sous le plafond de −1 dB (AIR-P-13), avec de la marge.
- **6 voix simultanées au plus**, sous la borne de 8 (§7.9) : le parcours du
  flux d'événements déroulé (noteOn ouvre une voix, noteOff la ferme), toutes
  couches confondues.
- **42 notes par tour** (3 + 16 + 8 + 15), soit 252 attaques sur le rendu.
- Le WAV écrit fait 6 144 044 octets (en-tête RIFF de 44 octets + 16 bits mono) ;
  il vit dans `out/`, dossier ignoré — aucun fichier sonore n'est versionné.

## Reproduire

```sh
npx tsx apps/bench/src/piece.ts        # rend out/piece.wav et imprime les nombres
npx vitest run apps/bench/src/piece.test.ts   # 11 tests : schéma, boucle, crête, déterminisme
```

Déterminisme (AIR-N-09) : aucune horloge, aucune graine aléatoire — deux
rendus donnent les mêmes échantillons, bit à bit (vérifié par le test).

## Structure de la pièce

Boucle : 4 mesures × 4 temps à 90 (une mesure = 2,667 s, la boucle = 10,667 s).
Progression harmonique : **ré m — si ♭ — la — ré m** (i — VI — V — i de la
mineure harmonique ; l'accord de la porte le do dièse de la gamme).

| Couche | Instrument (`instruments/`) | Rôle | Contenu par boucle |
|---|---|---|---|
| 1 | `drone` (bourdon) | Pédale | ré 2 tenu ; la 1 mesure 3 ; retour ré 2 mesure 4 — 3 notes, legato sans extinction |
| 2 | `harp` (harpe) | Arpèges | 4 notes par mesure (ré-fa-la-ré, si♭-ré-fa-si♭, la-do♯-mi-la, ré-fa-la-ré) sur les temps — 16 notes, étouffées à 0,9 s |
| 3 | `choir` (chœur) | Nappe | Deux voix en accords tenus, un accord par mesure, legato — 8 notes |
| 4 | `phantom` (thérémine) | Mélodie | Une phrase par mesure (la-ré-do♯-la-fa ; sol-si♭-la ; mi-sol-do♯-mi ; ré-la-fa), glissé de 30 ms entre les notes, respiration en fin de boucle — 15 notes |

Le rendu (`apps/bench/src/piece.ts`) déroule la boucle avec `loopEventsAt`
(`@thin-air/core`), rend chaque couche sèche avec `renderEvents`
(`@thin-air/audio`), mélange, puis applique la chaîne du §7.9 dans l'ordre du
moteur : réverbération (0,25) → gain général (−12 dB) → plafond (−1 dB). Un
relâchement final est ajouté à 1 s de la fin pour que la dernière mesure ne
soit pas tronquée net. Aucune logique de rendu n'est réécrite ici.

Les événements de la session sont des `MusicEvent` datés en secondes sur
l'horloge du son (§11.3) : la session ne contient **aucun échantillon**.

## Ce qui reste à un humain

1. **Écouter** `out/piece.wav` (le seul point de la recette §18 qui ne se
   prouve pas par un fichier) et noter la séance d'écoute dans
   `docs/journal.md`, avec ce qui est réglé ensuite.
2. **Filmer** la séquence 0:40 – 1:25 de la vidéo (§17.1) : la boucle sans
   coupe, un bourdon, la harpe, le chœur, puis le thérémine par-dessus,
   compteur de retard visible.
3. Rejouer éventuellement la pièce à la main dans l'app (fantôme ou caméra) et
   comparer au rendu mesuré ici.

## Collision de contrat signalée (règle 1 de `docs/CONTRACT.md`)

`take-privacy-guard.mjs` (lot A7) valide **tout** fichier `.json` sous `takes/`
comme une prise `thin-air-take/1` ; il refuse donc `takes/pieces/seance-1min.json`,
qui est une **session** (événements musicaux, aucune donnée corporelle — le
format que le §7.10 exporte justement sous `takes/`). Correction suggérée au
lot A7 : ignorer les fichiers dont le `format` est `thin-air-session/1` (validés
par `parseSession`, lot A4). Toutes les autres gardes passent, dont
`no-audio-asset-guard` nommément exigée par le lot.
