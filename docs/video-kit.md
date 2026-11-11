# Kit de tournage — la vidéo de démonstration (cahier §17.1)

Le script voix et la table temps/image/voix font autorité dans le cahier §17.1
et sont repris dans `docs/submission.md` (section « Video script »). Ce kit
ajoute ce qui manque pour filmer : la préparation, le cadrage, et **où se
trouve la preuve à l'écran dans chaque plan**. La vidéo fait moins de trois
minutes ; la voix est en anglais ; la musique est improvisée dans l'outil, sans
aucun air existant ni musique de tiers (recette §18).

## Préparation avant de filmer

1. **Lumière.** Pièce éclairée uniformément, mains visibles devant un fond
   clair ou neutre ; pas de contre-jour (la détection des mains perd en
   contraste). Aucun flash, aucun stroboscope à l'écran (§12.3).
2. **Distance.** Se placer assis à environ une longueur de bras de la caméra,
   de façon que toute la portée des bras tienne dans les 80 % centraux de
   l'image (la zone par défaut, AIR-F-08). La calibration filmée au plan 4 doit
   capturer les huit secondes de portée sans sortir du cadre.
3. **Sortie filaire.** Casque ou enceintes **en filaire**. Une sortie sans fil
   déclare souvent plus de 100 ms et déclenche l'avertissement à l'écran
   (AIR-F-32) : il apparaîtrait dans le compteur de retard pendant toute la
   vidéo. Le filaire garde aussi le retard mesuré de sortie au plus bas.
4. **Modèle déjà en cache.** Le premier chargement télécharge ≈ 22 Mo (modèle
   7 819 105 octets + variante d'exécution 13,93 Mo, `docs/latency.md`). Ouvrir
   la page une fois **avant** de lancer la capture, attendre la fin du
   téléchargement, puis recharger : aucune roue de téléchargement ne doit
   apparaître à l'image. En local : `npm run fetch-model` une fois.
5. **Profil navigateur propre.** Profil neuf, sans extension ni barre de
   favoris visible : la vidéo ne doit montrer aucune marque de tiers
   (recette §18). Zoom navigateur à 100 %.
6. **Lisibilité.** Capturer l'écran en 1080p ou plus, débit suffisant : le
   compteur de retard, les centièmes du `report.json` et le nom des notes
   doivent rester lisibles après compression — le film doit pouvoir se lire
   sans le son.
7. **Voix.** Enregistrer la voix off séparément, au calme, en anglais. Ne
   jamais prononcer les mots interdits (dernière section).
8. **Banc d'essai prêt.** Avant le plan 5, avoir lancé une fois les commandes
   du banc (ci-dessous) pour que rien ne télécharge ni ne compile à l'image.

## Table de tournage

| Temps | Image | Voix (anglais, §17.1) | Preuve à l'écran |
|---|---|---|---|
| 0:00 – 0:12 | Écran noir, deux mains de fantôme apparaissent, une note monte | silence puis « No instrument. No install. A webcam, and thin air. » | Aucune image caméra à l'écran, jamais : seulement les mains de fantôme (§12.3). Le nom de la note s'affiche en texte. |
| 0:12 – 0:40 | Phantom : phrase lente aimantée ; aimant coupé puis remis | « Notes snap to a scale, so you can't play a wrong one. Unless you want the ghost. » | Le réglage de l'aimant dans le panneau (case « snap ») ; le nom des notes reste dans la gamme à l'écran, puis le glissé libre quand l'aimant est coupé. |
| 0:40 – 1:25 | La boucle sans coupe : bourdon, harpe, chœur, thérémine par-dessus | « The camera sees thirty frames a second. Sound needs forty-eight thousand samples a second. The seam between those two clocks is the whole project. The loop even gives back the tenth of a second the camera takes. » | **Le compteur de retard reste visible tout le plan** : chaque composante listée avec sa mention **mesuré** ou **estimé** (AIR-F-31, `docs/latency.md`) ; le compteur de couches de la boucle monte de 1 à 4. |
| 1:25 – 1:45 | Calibration assise ; jeu à une main ; maintien | « It fits the reach you have. » | L'écran de calibration qui relève la portée (huit secondes, §7.4) ; les cases « one hand » et « hold » du panneau de réglages cochées à l'image. |
| 1:45 – 2:35 | Kiro : le garde anti-son refuse une commande ; prise rejouée ; rapport ; propriété et contre-exemple ; `luthier` écrit un instrument | « The agent that built this instrument was never allowed to hear it. Every musical behaviour is a property test on recorded hand movements, rendered to a file and measured. » | Voir le détail plan 5 ci-dessous : message de refus du garde, les huit notes imprimées, les centièmes du rapport, le test qui échoue avec son contre-exemple. |
| 2:35 – 2:55 | Retour à la scène ; fin de la pièce ; l'adresse | « Open source. Nothing leaves your browser. » | L'adresse du site en HTTPS, lisible, sans marque de tiers. |

## Plan 5 — la séquence Kiro, détail des preuves

Filmer un terminal en gros plan, police assez grande pour être lue en 1080p.

1. **Le garde anti-son refuse une commande.** Dans Kiro, demander une commande
   qui lirait le fichier rendu (par exemple ouvrir un lecteur audio sur
   `bench-out/render.wav`). Le hook `no-sound-guard` bloque l'outil : le
   message de refus s'affiche, et une ligne est ajoutée à `out/hook-log.jsonl`
   — montrer les deux. C'est ce journal qui est joint à la soumission
   (recette §18).
2. **`bench events` imprime les huit notes du thérémine.** Taper la commande
   exacte de `docs/recette.md` :

   ```bash
   npx tsx apps/bench/src/cli.ts events --take takes/reference/slow-rise.json \
       --instrument instruments/phantom.json --settings '{"magnet":1}'
   ```

   Les huit notes sortent dans l'ordre : 55, 57, 58, 61, 62, 64, 65, 67 —
   sol, la, si bémol, do dièse, ré, mi, fa, sol (recette §18, cahier §7.14).
   Cadrer la liste complète à l'écran.
3. **Le `report.json` et ses centièmes.**

   ```bash
   npx tsx apps/bench/src/cli.ts render --take takes/reference/slow-rise.json \
       --instrument instruments/phantom.json --out bench-out
   cat bench-out/report.json
   ```

   Montrer à l'écran : l'écart maximal en **centièmes de demi-ton** (3,05 pour
   une tolérance de 5), la **crête en dB** (−35,3 dB), le **silence après la
   sortie des mains** (723 ms pour une cible de 800 ms). Le banc écrit le
   fichier WAV sans jamais l'ouvrir : aucun périphérique audio.
4. **Une propriété et son contre-exemple.** Lancer `npx vitest run -t` sur une
   propriété (par exemple AIR-P-06, le tremblement sous la marge) puis montrer
   dans le journal de bord (`docs/journal.md`) un contre-exemple réel trouvé
   par les tests — la vitesse non finie qui déclenchait un pincement parce que
   comparer `NaN` à un seuil est toujours faux.
5. **`luthier` écrit un instrument.** Montrer l'agent `luthier` (§14.4)
   recevant une phrase unique, écrivant un fichier `thin-air-instrument/1`,
   le faisant valider par le schéma, puis le rendant sur une prise de
   référence et lisant le rapport — jamais d'écoute.

## Contraintes de montage

- Moins de trois minutes au total ; aucune coupe pendant le plan boucle
  (0:40 – 1:25) : c'est une seule prise.
- Aucun fichier sonore dans la vidéo sauf la musique jouée dans l'outil et la
  voix off ; aucune musique protégée (recette §18).
- L'image de la caméra n'apparaît jamais ; la pièce et les visages restent
  hors champ (§12.3, repris dans `docs/submission.md`).

## Les mots à ne jamais dire (ni écrire à l'écran) — §5.4

Le tableau du §5.4 est vérifié par la garde `wording-guard` ; la voix off et
les textes à l'écran s'y conforment. Ne jamais prononcer :

- l'expression en « real-t…e » et son équivalent français « temps r…l » ;
- le mot en « insta… » (français ou anglais) ;
- « zero lat… » / « zéro lat… » ;
- « always in t… » / « toujours j… » — dire « notes snap to a scale »,
  « aimanté sur la gamme » ;
- « sécurisé » ou « anonyme » sans dire pourquoi — dire « nothing leaves your
  browser » et montrer que la page est statique (AIR-N-01) ;
- prétendre à des « sons d'instruments réels » — dire « synthesized sounds »,
  « sons synthétisés ».

À la place, nommer le retard honnêtement : « estimated latency », « measured
latency » — chaque composante à l'écran porte déjà sa mention.
