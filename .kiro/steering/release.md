---
inclusion: manual
---

# Publication — mesures, séance d'écoute, soumission

Inclusion **manuelle** : ce fichier ne se charge que pour une séance de
publication, pas pendant l'écriture du code.

## 1. Les mesures de retard (AIR-N-05, recette §18)

`docs/latency.md` donne, **pour deux machines au moins**, chaque composante du
retard avec la mention « mesuré » ou « estimé » : intervalle entre images,
analyse, traitement, `baseLatency`, `outputLatency`, caméra. La cible est une
part mesurable sous **60 ms** en sortie filaire ; le résultat est noté, qu'il
tienne ou non. Les ordres de grandeur du §5.1 sont des ordres de grandeur :
ils ne se publient pas comme des mesures.

## 2. La séance d'écoute humaine (§13.4, recette §18)

Les mesures disent quelles notes sonnent, quand, à quelle fréquence et à quel
niveau ; elles ne disent pas si le son est beau. **Une séance d'écoute par
lot**, notée dans `docs/journal.md` avec sa date et ce qui a été réglé à la
suite. C'est la seule ligne de la recette qui ne se prouve pas par un fichier.
L'agent n'y participe pas : il n'entend rien (AIR-N-02).

## 3. La recette (§18) — chaque point par un journal ou un fichier

- les vingt-deux propriétés passent, graines consignées ;
- exemple du thérémine : huit notes dans l'ordre, aux instants de référence à
  une image près ; chaque palier à 5 centièmes ; crête sous −1 dB ; silence
  800 ms après la sortie des mains ;
- exemple de la harpe : quatre notes à 125 ms, force 0,17 ;
- `hand-leaves-mid-note` : aucune voix active à la fin ; `tremor-at-boundary` :
  au plus un changement de note ; `left-hand-only` : côté « gauche » ;
- boucle de quatre mesures à 90 par minute : exactement **512 000
  échantillons** à 48 000 par seconde, soit 10,67 s ;
- journal réseau du navigateur de test : aucune requête après le chargement,
  aucune vers un tiers ;
- aucun fichier sonore dans le dépôt, aucune demande de microphone ;
- **journal du hook `no-sound-guard` joint** (`out/hook-log.jsonl`), et
  configuration du lanceur de tests montrant l'absence d'écran et le son coupé ;
- vocabulaire : aucune occurrence des mots refusés dans le site construit ;
- accessibilité sans erreur, tout au clavier, parcours P2 automatisé ;
- `/.kiro` présent à la racine et non ignoré ; licence ; notices ; README ;
  adresse en HTTPS.

## 4. La soumission (§17)

Vidéo de moins de trois minutes, en anglais, sans marque de tiers ni musique
protégée. Quatre faits à montrer, chiffres à l'appui (§14.6) : l'agent n'a
jamais entendu l'instrument ; les propriétés portent la musique ; Kiro est
luthier (une phrase, le fichier, le rapport de rendu) ; le steering change le
code (le réglage fixé sans rampe avant `two-clocks.md`, la même ligne après,
et la mesure du grésillement dans les deux cas).

Le hook à montrer dans la vidéo est `no-sound-guard` : son journal prouve la
première affirmation. Adresse en HTTPS, accessible gratuitement jusqu'au
**29 janvier 2027** (AIR-N-13). Budget indicatif : 700 à 900 des 4 000
crédits, coût réel d'une spec à mesurer sur `gestures`.
