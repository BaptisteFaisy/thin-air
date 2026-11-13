# Les fonctionnalités promises

Ce document est **dérivé** de `docs/features.json`, la source de vérité :
`node scripts/check-features.mjs --markdown` le régénère, et le contrôle
refuse le dépôt si le fichier dérive de la liste. Ne pas l'éditer à la main.

> **Une fonctionnalité non listée n'existe pas ; une fonctionnalité listée sans preuve n'est pas livrée.**

La liste compte 58 fonctionnalités : 52 livrées, 3 à faire, 3 hors périmètre.
Chaque ligne porte son exigence du cahier (§9), les parcours qu'elle sert (§8),
l'écran où elle se voit, et la preuve qui la fait tenir.

Les trois états : **livré** — la promesse tient dans le code et une preuve
(test ou commande) la démontre ; **à faire** — le cahier l'exige mais rien
ne la prouve encore dans le code (sa preuve est la ligne du cahier) ;
**hors périmètre** — cette édition l'exclut d'office, elle n'est pas attendue
dans le code.

| ID | Fonctionnalité | Nom (anglais) | Écran | Exigence | Parcours | État | Preuve |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | Démarrage : la caméra est demandée au clic « Start » | Start: the camera is asked for on the Start click | Accueil | AIR-F-01 | P1 | livré | `apps/web/src/state/machine.test.ts` |
| F-02 | Repli sans caméra : le jeu au pointeur et au clavier | No-camera fallback: play with the pointer and the keyboard | Accueil | AIR-F-02 | P2, P6 | livré | `apps/web/src/state/machine.test.ts` |
| F-03 | Une image, une analyse, avec son horodatage | One frame, one analysis, with its timestamp | Scène | AIR-F-03 | P1 | livré | `apps/web/src/lib/engine.test.ts` |
| F-04 | Deux mains suivies, le rôle conservé par continuité | Two tracked hands, the role kept by continuity | Scène | AIR-F-04 | P1 | livré | `packages/vision/src/camera-source.test.ts` |
| F-05 | Miroir : l'affichage et l'interprétation sont en miroir | Mirror: the display and the interpretation are mirrored | Scène | AIR-F-05 | P1 | livré | `packages/core/src/space.test.ts` |
| F-06 | Conseils quand aucune main n'est reconnue | Advice when no hand is recognised | Scène | AIR-F-06 | P6 | livré | `packages/vision/src/no-hands.test.ts` |
| F-07 | Analyse déportée hors du fil principal de la page | Analysis off the page's main thread | Scène | AIR-F-07 | P1 | livré | `packages/vision/src/worker/host.test.ts` |
| F-08 | Zone de jeu par défaut : les 80 % centraux de l'image | Default play area: the central 80 % of the image | Calibration | AIR-F-08 | P3 | livré | `apps/web/src/state/calibration.test.ts` |
| F-09 | Calibration : la portée des mains, gardée sur l'appareil | Calibration: the reach of the hands, kept on the device | Calibration | AIR-F-09 | P3 | livré | `apps/web/src/state/calibration.test.ts` |
| F-10 | Jeu à une main : l'instrument entier tient dans une main | One-hand play: the whole instrument fits in one hand | Réglages | AIR-F-10 | P3 | livré | `apps/web/src/state/profiles.test.ts` |
| F-11 | Gaucher : un réglage inverse les rôles des mains | Left-handed: a setting swaps the roles of the hands | Réglages | AIR-F-11 | P3 | livré | `packages/core/src/roles.test.ts` |
| F-12 | Maintien : 400 ms dans une zone verrouillent la note | Hold: 400 ms in a zone lock the note | Réglages | AIR-F-12 | P3 | livré | `packages/core/src/gestures.test.ts` |
| F-13 | Filtrage des coordonnées : un canal lissé, un canal vif | Coordinate filtering: a smooth channel, a fast channel | Réglages | AIR-F-13 | P3 | livré | `packages/core/src/filter.test.ts` |
| F-14 | Deux seuils par geste : un d'enclenchement, un de relâchement | Two thresholds per gesture: one to fire, one to release | Scène | AIR-F-14 | P1 | livré | `packages/core/src/gestures.test.ts` |
| F-15 | Main perdue : les valeurs sont tenues 150 ms, puis relâchées | Lost hand: the values are held 150 ms, then released | Scène | AIR-F-15 | P6 | livré | `packages/core/src/features.test.ts` |
| F-16 | Aucune note coincée : onglet masqué ou image absente | No stuck note: hidden tab or missing frame | Scène | AIR-F-16 | P6 | livré | `apps/web/src/state/machine.test.ts` |
| F-17 | Une traversée de corde, un seul déclenchement | One string crossing, a single trigger | Scène | AIR-F-17 | P1 | livré | `packages/core/src/gestures.test.ts` |
| F-18 | Gammes : le choix de la fondamentale et de l'étendue | Scales: the choice of the root and of the range | Éditeur d'instrument | AIR-F-18 | P8 | livré | `packages/core/src/music.test.ts` |
| F-19 | Aimant réglable de 0 à 1, une valeur par instrument | Magnet adjustable from 0 to 1, one value per instrument | Réglages | AIR-F-19 | P5 | livré | `apps/web/src/state/settings.test.ts` |
| F-20 | Volume : l'échelle en décibels du cahier | Volume: the decibel scale of the spec | Réglages | AIR-F-20 | P1 | livré | `packages/core/src/music.test.ts` |
| F-21 | Trois instruments livrés : Phantom, Harp et Choir | Three shipped instruments: Phantom, Harp and Choir | Instruments | AIR-F-21 | P1, P8 | livré | `apps/web/src/state/instruments.test.ts` |
| F-22 | Deux instruments de plus : Bells et Drone | Two more instruments: Bells and Drone | Instruments | AIR-F-22 | P1 | livré | `apps/web/src/state/library.test.ts` |
| F-23 | Percussions : Grid drums, les frappes replacées sur la grille | Percussion: Grid drums, the hits snapped to the grid | Instruments | AIR-F-23 | P4 | à faire | `docs/cahier-des-charges.md` |
| F-24 | Changement d'instrument : les voix s'éteignent en fondu | Instrument change: the voices fade out | Instruments | AIR-F-24 | P1 | livré | `packages/audio/src/graph/voices.test.ts` |
| F-25 | Synthèse seule : aucun fichier sonore dans le dépôt | Synthesis only: no sound file in the repository | Instruments | AIR-F-25 | P1 | livré | `scripts/hooks/no-audio-asset-guard.mjs` |
| F-26 | Rampes : tout réglage continu passe par une rampe | Ramps: every continuous setting goes through a ramp | Réglages | AIR-F-26 | P1 | livré | `packages/audio/src/graph/params.test.ts` |
| F-27 | Voix bornées : jamais plus que maxVoices, la plus ancienne reprise | Bounded voices: never more than maxVoices, the oldest one reused | Scène | AIR-F-27 | P1 | livré | `packages/audio/src/graph/voices.test.ts` |
| F-28 | Plafond : la sortie ne dépasse jamais −1 dB, le volume à −12 dB | Ceiling: the output never exceeds −1 dB, the volume at −12 dB | Réglages | AIR-F-28 | P1 | livré | `packages/audio/src/graph/params.test.ts` |
| F-29 | Corde pincée : un module audio dédié | Plucked string: a dedicated audio module | Scène | AIR-F-29 | P1 | livré | `packages/audio/src/worklets/pluck-core.test.ts` |
| F-30 | Réverbération calculée, réglable et désactivable | Computed reverb, adjustable and switchable off | Réglages | AIR-F-30 | P1 | livré | `packages/audio/src/dsp/reverb.test.ts` |
| F-31 | Le retard affiché par composante, mesuré ou estimé | The latency shown per component, measured or estimated | Latence | AIR-F-31 | P5, P7 | livré | `apps/web/src/state/latency.test.ts` |
| F-32 | Sortie sans fil probable : le retard est signalé, le filaire conseillé | Likely wireless output: the latency is flagged, the wired one advised | Scène | AIR-F-32 | P7 | livré | `apps/web/src/state/latency.test.ts` |
| F-33 | Vocabulaire imposé par le cahier, dans les deux langues | Vocabulary imposed by the spec, in both languages | Langue de l'interface | AIR-F-33 | P1 | livré | `scripts/hooks/wording-guard.mjs` |
| F-34 | Boucle : une, deux ou quatre mesures, six couches au plus | Loop: one, two or four bars, six layers at most | Boucle | AIR-F-34 | P4 | livré | `apps/web/src/state/loopState.test.ts` |
| F-35 | Compensation : les événements sont avancés du retard estimé | Compensation: the events are advanced by the estimated latency | Boucle | AIR-F-35 | P4, P10 | livré | `apps/bench/src/compensation.test.ts` |
| F-36 | Couches : retirer la dernière, en couper une, tout effacer | Layers: remove the last one, mute one, clear them all | Boucle | AIR-F-36 | P4 | livré | `apps/web/src/state/loopState.test.ts` |
| F-37 | Calage : les événements à la croche ou à la double croche, force réglable | Snap: the events on the eighth or the sixteenth, adjustable strength | Boucle | AIR-F-37 | P4 | à faire | `docs/cahier-des-charges.md` |
| F-38 | Export audio : la boucle rendue hors ligne en fichier WAV | Audio export: the loop rendered offline to a WAV file | Boucle | AIR-F-38 | P4 | livré | `packages/audio/src/offline/wav.test.ts` |
| F-39 | Export MIDI : un fichier par boucle, une piste par couche | MIDI export: one file per loop, one track per layer | Boucle | AIR-F-39 | P4 | livré | `packages/core/src/midi.test.ts` |
| F-40 | Session : la boucle et ses réglages enregistrés en JSON | Session: the loop and its settings saved as JSON | Boucle | AIR-F-40 | P4 | livré | `apps/web/src/state/sessionFile.test.ts` |
| F-41 | Sortie MIDI : notes et réglages vers une sortie MIDI du navigateur | MIDI output: notes and settings to a browser MIDI output | Boucle | AIR-F-41 | P4 | à faire | `docs/cahier-des-charges.md` |
| F-42 | Vidéo : la scène et le son enregistrés en vidéo | Video: the scene and the sound recorded as video | Scène | AIR-F-42 | P1 | hors périmètre | `docs/cahier-des-charges.md` |
| F-43 | Format : un instrument est un fichier validé par schéma | Format: an instrument is a schema-validated file | Instruments | AIR-F-43 | P8 | livré | `apps/web/src/state/instruments.test.ts` |
| F-44 | Éditeur : dupliquer un instrument et changer ses champs | Editor: duplicate an instrument and change its fields | Éditeur d'instrument | AIR-F-44 | P8 | livré | `apps/web/src/ui/InstrumentEditor.test.tsx` |
| F-45 | Lien : l'instrument voyage dans le fragment d'adresse | Link: the instrument travels in the address fragment | Instruments | AIR-F-45 | P8 | livré | `apps/web/src/state/instruments.test.ts` |
| F-46 | Zones à la main : placées et redimensionnées sur la scène | Hand zones: placed and resized on the scene | Scène | AIR-F-46 | P3 | hors périmètre | `docs/cahier-des-charges.md` |
| F-47 | Enregistrer : une prise faite des points des mains, et rien d'autre | Record: a take made of the points of the hands, and nothing else | Prise réelle | AIR-F-47 | P9 | livré | `packages/vision/src/recorder.test.ts` |
| F-48 | Rejouer : une prise rejouée comme si les mains étaient là | Replay: a take replayed as if the hands were there | Prise réelle | AIR-F-48 | P9 | livré | `packages/vision/src/replay.test.ts` |
| F-49 | Banc d'essai : une commande rend les événements, le rendu et les mesures, sans son | Test bench: one command renders the events, the audio and the measures, silently | Banc d'essai | AIR-F-49 | P10 | livré | `apps/bench/src/cli.test.ts` |
| F-50 | Fantôme : une prise rejouée à faible volume quand aucune main ne vient | Ghost: a take replayed at low volume when no hand comes | Borne | AIR-F-50 | P11 | livré | `apps/web/src/kiosk/kioskState.test.ts` |
| F-51 | Scène : les mains, les zones ou les cordes, et une réponse visible à chaque note | Scene: the hands, the zones or the strings, and a visible answer to every note | Scène | AIR-F-51 | P1, P5 | livré | `apps/web/src/scene/paint.test.ts` |
| F-52 | Image masquée : la caméra n'est pas montrée par défaut, un réglage l'affiche | Hidden image: the camera is not shown by default, a setting displays it | Scène | AIR-F-52 | P6 | livré | `apps/web/src/scene/geometry.test.ts` |
| F-53 | Physique : la fréquence, le nom de la note et la forme du son | Physics: the frequency, the note name and the shape of the sound | Physique | AIR-F-53 | P5 | livré | `apps/web/src/ui/waveform.test.ts` |
| F-54 | Hors ligne : le site fonctionne après la première visite | Offline: the site works after the first visit | Accueil | AIR-F-54 | P1 | livré | `apps/web/src/state/settings.test.ts` |
| F-55 | Quatre mains : deux joueurs devant la même caméra | Four hands: two players in front of the same camera | Scène | AIR-F-55 | P1 | hors périmètre | `docs/cahier-des-charges.md` |
| F-56 | Aucun accès au microphone | No microphone access | Accueil | AIR-F-56 | P6 | livré | `packages/vision/src/capture.test.ts` |
| F-57 | Aucun envoi d'image ni de prise vers un serveur | No image and no take sent to a server | Prise réelle | AIR-F-57 | P9 | livré | `scripts/hooks/take-privacy-guard.mjs` |
| F-58 | Aucun échantillon enregistré, aucune banque de sons | No recorded sample, no sound bank | Instruments | AIR-F-58 | P1 | livré | `scripts/hooks/no-audio-asset-guard.mjs` |

## Les écrans

| Écran | Ce qui le montre |
| --- | --- |
| Accueil | `apps/web/src/ui/Home.tsx#Home` |
| Scène | `apps/web/src/ui/Seance.tsx#SeanceView`, `apps/web/src/ui/Stage.tsx#Stage`, `apps/web/src/scene/SceneCanvas.tsx#SceneCanvas`, `apps/web/src/ui/Notices.tsx#Notices` |
| Instruments | `apps/web/src/ui/InstrumentsDrawer.tsx#InstrumentsDrawer`, `apps/web/src/ui/Panels.tsx#Panels` |
| Boucle | `apps/web/src/ui/LoopPanel.tsx#LoopPanel`, `apps/web/src/ui/SessionFile.tsx#SessionFile` |
| Calibration | `apps/web/src/ui/CalibrationPanel.tsx#CalibrationPanel` |
| Réglages | `apps/web/src/ui/SettingsPanel.tsx#SettingsPanel`, `apps/web/src/ui/Profiles.tsx#Profiles` |
| Physique | `apps/web/src/ui/PhysicsPanel.tsx#PhysicsPanel`, `apps/web/src/ui/LessonsPanel.tsx#LessonsPanel`, `?lecons` |
| Éditeur d'instrument | `apps/web/src/ui/InstrumentEditor.tsx#InstrumentEditor` |
| Latence | `apps/web/src/ui/LatencyReadout.tsx#LatencyReadout` |
| Borne | `apps/web/src/kiosk/Kiosk.tsx#Kiosk`, `apps/web/src/ui/KioskEntry.tsx#KioskEntry`, `?kiosk` |
| Prise réelle | `apps/web/src/ui/RealTake.tsx#RealTakePage`, `?record` |
| Langue de l'interface | `apps/web/src/i18n/index.ts#langFrom`, `?lang` |
| Banc d'essai | `apps/bench/src/cli.ts#main` |

## Comment vérifier

```
node scripts/check-features.mjs        # sort 1 et nomme le manque
node scripts/check-features.mjs --markdown   # régénère docs/features.md
```
