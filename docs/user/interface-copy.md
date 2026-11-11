# Interface copy — every visible string, English and French

AIR-N-14 (cahier §10) asks for an English interface with **externalised** text:
the web app never hard-codes a label, it reads a catalogue. This file is the
catalogue, screen by screen (cahier §12.1) and state by state (§12.2).

| | |
|---|---|
| Languages | English (default, submission) and French |
| Keys | `screen.element`, dot-separated, stable — they are the message ids |
| Placeholders | `{0}`, `{1}`: numbers only, formatted by the caller (never a sentence inside a placeholder) |
| Guard | `scripts/hooks/wording-guard.mjs` scans this folder: the words §5.4 refuses must never be printed here, not even to quote the rule. Their spellings are kept in the guard's rule table and in the brief |
| Loader | belongs to lot B4 (`apps/web/**`); this lot delivers the text only |

## Wording rules these strings obey

1. Latency is never sold as absence of latency. Two forms only: **estimated
   latency** and **measured latency** (§5.4), and the screen says which part is
   which.
2. Pitch assistance is described as **notes snap to a scale** — a glide remains
   available, so the promise is bounded. The two-word phrase the brief forbids
   (spellings in the guard) is never used, in either language.
3. Privacy is stated with its reason, because an unexplained claim is a slogan:
   **nothing leaves your browser**, then *why* — static files, the hand model
   downloaded from this page and run inside the browser, no analytics, no
   server to send anything to.
4. Sound is always **synthesised sounds** — no recording, no sample bank, no
   third-party rights.
5. No sentence is longer than twelve words on a button, twenty on a message.
   A screen reader announces them without scrolling.

## 1. Welcome (§12.1, AIR-F-01)

| Key | English | Français | Note |
|---|---|---|---|
| `home.title` | Thin Air | Thin Air | Product name, untranslated (§6.3) |
| `home.tagline` | A webcam turns thin air into an instrument | Une webcam transforme l'air en instrument | |
| `home.start` | Start | Démarrer | Requests the camera **and** opens the audio engine; before this click, neither |
| `home.playWithoutCamera` | Play without a camera | Jouer sans caméra | Pointer and keyboard, same engine (AIR-F-02, P2) |
| `home.startHelp` | Allow the camera when your browser asks | Autorise la caméra quand ton navigateur te le demande | |
| `home.pointerHelp` | The pointer becomes one hand, the keyboard plays the notes | Le pointeur devient une main, le clavier joue les notes | |
| `home.privacy` | Nothing leaves your browser | Rien ne quitte ton navigateur | §5.4 phrase, verbatim |
| `home.privacyWhy` | The page is a set of static files, and the hand model is downloaded from this page and runs inside it. There is no server to send an image to. | La page est un ensemble de fichiers statiques, et le modèle de mains est téléchargé depuis cette page et tourne dedans. Il n'y a aucun serveur où envoyer une image. | The reason, not the slogan |
| `home.noMic` | The microphone is never requested | Le microphone n'est jamais demandé | AIR-F-56 |
| `home.soundOnlyAfterStart` | Sound starts when you press Start | Le son démarre quand tu appuies sur Démarrer | Browsers refuse sound before a user gesture (§7.2) |
| `home.requirement` | A webcam and a recent browser. No install, no account. | Une webcam et un navigateur récent. Rien à installer, aucun compte. | |
| `home.judge` | Judge in three minutes | Juger en trois minutes | Opens the README section (§17.2) |
| `home.licence` | Open source, MIT licence. Hand tracking by MediaPipe, Apache 2.0. | Open source, licence MIT. Suivi des mains par MediaPipe, Apache 2.0. | |

## 2. Stage (§12.1)

| Key | English | Français | Note |
|---|---|---|---|
| `stage.instrument` | Instrument | Instrument | |
| `stage.currentNote` | Note | Note | Also rendered as text, not only on the canvas (§12.4) |
| `stage.volume` | Volume | Volume | Gauge, with a numeric dB value |
| `stage.handCount` | {0} of 2 hands | {0} main sur 2 | 0, 1 or 2 |
| `stage.openInstruments` | Instruments | Instruments | Opens screen 3 |
| `stage.openLoop` | Loop | Boucle | Opens screen 4 |
| `stage.calibrate` | Fit the instrument to your reach | Ajuster l'instrument à ma portée | Opens screen 5 |
| `stage.physics` | Show the physics | Afficher la physique | Opens screen 7 (AIR-F-53) |
| `stage.settings` | Settings | Réglages | Opens screen 8 |
| `stage.silenceAll` | Silence all | Tout couper | Safety; also releases stuck voices (AIR-F-16) |
| `stage.keyboardHelp` | The pointer moves the pitch hand. The keyboard plays the scale. | Le pointeur déplace la main de hauteur. Le clavier joue la gamme. | Pointer/keyboard mode only |

### Latency read-out (AIR-F-31, §5.4)

| Key | English | Français | Note |
|---|---|---|---|
| `latency.title` | Latency | Retard | Never "delay" as a hidden word: it is stated |
| `latency.measured` | measured latency | retard mesuré | §5.4, verbatim |
| `latency.estimated` | estimated latency | retard estimé | §5.4, verbatim |
| `latency.total` | {0} ms | {0} ms | Sum of the parts below |
| `latency.analysis` | Analysis {0} ms, measured | Analyse {0} ms, mesurée | |
| `latency.processing` | Processing {0} ms, measured | Traitement {0} ms, mesuré | |
| `latency.audio` | Audio output {0} ms, measured | Sortie audio {0} ms, mesurée | From the two values the browser declares |
| `latency.audioPartial` | Audio output {0} ms, partially measured: this browser declares only one of the two values | Sortie audio {0} ms, mesure partielle : ce navigateur ne déclare qu'une des deux valeurs | §7.9 |
| `latency.camera` | Camera {0} to {1} ms, estimated: the page cannot measure it | Caméra {0} à {1} ms, estimée : la page ne peut pas la mesurer | Never presented as measured |
| `latency.note` | The loop gives this back when it records | La boucle le rend à l'enregistrement | Compensation, §7.10 |
| `latency.details` | Details | Détails | Disclosure button, keyboard reachable |

## 3. Instruments (§12.1, AIR-F-43 to AIR-F-45)

| Key | English | Français | Note |
|---|---|---|---|
| `instruments.title` | Instruments | Instruments | Drawer |
| `instruments.builtIn` | Included | Fournis | Phantom, Harp, Choir, Bells, Drone, Grid drums (§7.8) |
| `instruments.mine` | Yours | Les tiens | |
| `instruments.use` | Use this instrument | Choisir cet instrument | Voices fade out on change (AIR-F-24) |
| `instruments.duplicate` | Duplicate | Dupliquer | |
| `instruments.edit` | Edit | Modifier | Opens screen 6 |
| `instruments.open` | Open a file… | Ouvrir un fichier… | |
| `instruments.save` | Save as a file | Enregistrer en fichier | |
| `instruments.link` | Copy a link to this instrument | Copier un lien vers cet instrument | Instrument inside the URL fragment (AIR-F-45) |
| `instruments.linkCopied` | Link copied | Lien copié | |
| `instruments.empty` | No instrument of your own yet. Duplicate one to start. | Aucun instrument à toi pour l'heure. Duplique-en un pour commencer. | |
| `instruments.kind` | An instrument is a file: zones, scale, range, sound and mappings | Un instrument est un fichier : zones, gamme, étendue, son et correspondances | Teaches the format |

## 4. Loop (§12.1, §7.10)

| Key | English | Français | Note |
|---|---|---|---|
| `loop.title` | Loop | Boucle | |
| `loop.record` | Record | Enregistrer | |
| `loop.stop` | Stop | Arrêter | |
| `loop.layer` | Layer {0} | Couche {0} | Six layers at most |
| `loop.muteLayer` | Mute this layer | Couper cette couche | |
| `loop.removeLast` | Remove the last layer | Retirer la dernière couche | |
| `loop.clear` | Clear everything | Tout effacer | Confirmed by `loop.clearConfirm` |
| `loop.clearConfirm` | Clear all layers? | Tout effacer ? | |
| `loop.tempo` | Tempo, beats per minute | Tempo, battements par minute | 60 to 140, 90 by default |
| `loop.bars` | Bars | Mesures | 1, 2 or 4 |
| `loop.align` | Align to the beat | Caler sur le tempo | Off, eighth note, sixteenth note |
| `loop.alignStrength` | Alignment strength | Force du calage | 0 to 100 % |
| `loop.metronome` | Metronome | Métronome | Visual by default, click optional |
| `loop.exportAudio` | Export the audio | Exporter l'audio | Offline render, WAV (AIR-F-38) |
| `loop.exportMidi` | Export MIDI | Exporter le MIDI | One track per layer (AIR-F-39) |
| `loop.saveSession` | Save the session | Enregistrer la session | |
| `loop.openSession` | Open a session… | Ouvrir une session… | |
| `loop.compensation` | Recorded notes are moved earlier by the estimated latency, so the loop stays on the beat | Les notes enregistrées sont avancées du retard estimé, pour que la boucle reste sur le temps | §7.10 |
| `loop.whatIsRecorded` | Recorded: notes and settings. Never sound, never an image. | Enregistré : des notes et des réglages. Jamais de son, jamais d'image. | §7.10, AIR-F-47 |

## 5. Calibration (§12.1, §7.4, AIR-F-09)

| Key | English | Français | Note |
|---|---|---|---|
| `calibration.title` | Fit the instrument to your reach | Ajuster l'instrument à ta portée | |
| `calibration.instruction` | Stretch your arms as far as is comfortable: up, down, left, right | Tends les bras aussi loin que c'est confortable : en haut, en bas, à gauche, à droite | Wording from §7.4 |
| `calibration.countdown` | Recording your reach: {0} | Relevé de ta portée : {0} | Eight seconds |
| `calibration.done` | This is your play area | Voici ta zone de jeu | |
| `calibration.tooSmall` | That area is small. Try again, or keep the default area. | Cette zone est petite. Recommence, ou garde la zone par défaut. | Below 20 % of the image on one side |
| `calibration.retry` | Try again | Recommencer | |
| `calibration.keepDefault` | Keep the default area | Garder la zone par défaut | Central 80 % (AIR-F-08) |
| `calibration.cancel` | Cancel | Annuler | |
| `calibration.saved` | Saved on this device | Gardée sur cet appareil | |
| `calibration.sitting` | Sitting down? Make your reach smaller before you start | Assis ? Réduis ta portée avant de commencer | P3 |

## 6. Instrument editor (§12.1, AIR-F-44)

| Key | English | Français | Note |
|---|---|---|---|
| `editor.title` | Instrument editor | Éditeur d'instrument | |
| `editor.name` | Name | Nom | |
| `editor.scale` | Scale | Gamme | The eight scales of §7.7 |
| `editor.root` | Root note | Fondamentale | |
| `editor.range` | Range | Étendue | |
| `editor.lowestNote` | Lowest note | Note la plus basse | |
| `editor.highestNote` | Highest note | Note la plus haute | |
| `editor.strings` | Strings | Cordes | Harp-like instruments |
| `editor.zones` | Zones | Zones | Choir-like instruments |
| `editor.snap` | Notes snap to a scale | Aimantation sur la gamme | Slider 0 to 1 |
| `editor.snapHelp` | 1 plays firm notes from the scale. 0 leaves a continuous glide. | 1 donne des notes franches de la gamme. 0 laisse un glissé continu. | Bounded promise (§5.4) |
| `editor.sound` | Sound | Son | |
| `editor.tone` | Tone | Tonalité | |
| `editor.attack` | Attack, ms | Attaque, ms | |
| `editor.release` | Release, ms | Extinction, ms | |
| `editor.glide` | Glide, ms | Glissement, ms | |
| `editor.save` | Save | Enregistrer | Validated by schema (AIR-F-43) |
| `editor.saved` | Saved | Enregistré | |
| `editor.cancel` | Cancel | Annuler | |

## 7. The physics (§12.1, AIR-F-53)

| Key | English | Français | Note |
|---|---|---|---|
| `physics.title` | The physics | La physique | |
| `physics.frequency` | Frequency | Fréquence | Hertz, two decimals |
| `physics.noteName` | Note | Note | Name and MIDI number |
| `physics.waveform` | Waveform | Forme du son | Drawn curve |
| `physics.octave` | One octave up doubles the frequency | Une octave au-dessus double la fréquence | P5, AIR-P-04 |
| `physics.cents` | {0} cents from the nearest note | {0} centièmes de la note la plus proche | Hundredths of a semitone |
| `physics.close` | Close | Fermer | |

## 8. Settings (§12.1, §7.13)

| Key | English | Français | Note |
|---|---|---|---|
| `settings.title` | Settings | Réglages | Ordinary page controls, outside the canvas (§11.8) |
| `settings.snap` | Notes snap to a scale | Aimantation sur la gamme | Also in the editor, per instrument |
| `settings.leftHanded` | Left-handed: swap the two hands | Gaucher : inverser les deux mains | AIR-F-11 |
| `settings.oneHand` | One-hand mode | Mode une main | AIR-F-10 |
| `settings.hold` | Hold mode | Mode maintien | AIR-F-12 |
| `settings.holdHelp` | Stay 400 ms in a zone to lock its note until the next pass | Reste 400 ms dans une zone pour verrouiller sa note jusqu'au prochain passage | |
| `settings.volume` | Volume | Volume | −12 dB by default, ceiling −1 dB |
| `settings.reverb` | Reverb | Réverbération | Computed, adjustable, can be off |
| `settings.cameraLatency` | Camera delay, estimated | Retard de caméra, estimé | 0 to 120 ms, 50 by default; feeds the loop compensation |
| `settings.smoothing` | Smoothing | Lissage | For hands that shake; more smoothing means a softer gesture (§12.4) |
| `settings.showCameraImage` | Show the camera image behind the stage | Afficher l'image de la caméra derrière la scène | Off by default (AIR-F-52), dimmed |
| `settings.midiOut` | MIDI output | Sortie MIDI | Hidden where Web MIDI is missing (§7.12) |
| `settings.reducedMotion` | Motion follows your system setting for reduced motion | Le mouvement suit le réglage système « moins de mouvement » | Informational; nothing to switch |
| `settings.reset` | Restore defaults | Rétablir les valeurs par défaut | |
| `settings.close` | Close | Fermer | |

## 9. States (§12.2)

Every state has one sentence the screen reader reads, one line on the screen,
and a defined action. No state leaves a note sounding (AIR-N-08).

### Before and around the camera

| Key | English | Français | What happens |
|---|---|---|---|
| `state.beforeStart` | Ready. Press Start to switch the camera on. | Prêt. Appuie sur Démarrer pour allumer la caméra. | No camera, no sound before the click (AIR-F-01) |
| `state.cameraAsked` | Waiting for your permission to use the camera | En attente de ton autorisation pour la caméra | Spinner, plus a cancel |
| `state.cameraCancelled` | Camera not started. You can play with the pointer instead. | Caméra non démarrée. Tu peux jouer au pointeur à la place. | Offers `home.playWithoutCamera` |
| `state.cameraRefused` | Camera refused. Play without a camera: the pointer becomes one hand, the keyboard plays the notes. | Caméra refusée. Joue sans caméra : le pointeur devient une main, le clavier joue les notes. | P6, AIR-F-02 |
| `state.cameraMissing` | No camera found. You can play with the pointer and the keyboard. | Aucune caméra détectée. Tu peux jouer au pointeur et au clavier. | Same fallback |
| `state.cameraLost` | The camera stopped. Reconnect it, or play with the pointer. | La caméra s'est arrêtée. Rebranche-la, ou joue au pointeur. | Voices released (AIR-N-08) |

### Model loading

| Key | English | Français | What happens |
|---|---|---|---|
| `state.modelLoading` | Loading the hand model: {0} % | Chargement du modèle de mains : {0} % | Real progress, aria-live polite |
| `state.modelLoadingWeight` | {0} MB, served by this page | {0} Mo, servi par cette page | Explains the wait; weight from `docs/latency.md` |
| `state.modelFailed` | The hand model could not load. You can still play with the pointer and the keyboard. | Le modèle de mains n'a pas pu se charger. Tu peux quand même jouer au pointeur et au clavier. | Fallback, never a dead end |
| `state.modelRetry` | Try loading the model again | Réessayer de charger le modèle | |

### Hands

| Key | English | Français | What happens |
|---|---|---|---|
| `state.noHands` | No hands yet. Raise one hand in the lit area. | Aucune main. Lève une main dans la zone éclairée. | Ghost take after 20 s (AIR-F-50) |
| `state.noHandsLight` | Nothing seen for a while. More light, or step back. | Rien vu depuis un moment. Plus de lumière, ou recule un peu. | After 3 s if the image changes (AIR-F-06) |
| `state.oneHand` | One hand. Playing in one-hand mode. | Une main. Jeu en mode une main. | Same instrument, reduced mapping |
| `state.twoHands` | Two hands: pitch and volume | Deux mains : hauteur et volume | |
| `state.handAtEdge` | Hand at the edge of your play area | Main au bord de la zone de jeu | Values clamped, `edge` flag (§7.4) |
| `state.lowLight` | Not enough light to see the hands | Pas assez de lumière pour voir les mains | |
| `state.ghostPlaying` | Nobody there, so the ghost is playing a recorded take | Personne devant la caméra : le fantôme joue une prise enregistrée | Stops at the first hand (P11) |

### Audio

| Key | English | Français | What happens |
|---|---|---|---|
| `state.audioSuspended` | The browser paused the sound. Press Resume to carry on. | Le navigateur a mis le son en pause. Appuie sur Reprendre pour continuer. | Autoplay policy; voices released |
| `state.audioResume` | Resume the sound | Reprendre le son | |
| `state.tabHidden` | Tab in the background: everything is released | Onglet en arrière-plan : tout est relâché | No stuck note (AIR-F-16) |
| `state.wirelessOutput` | Your output declares {0} ms. A wired output would cut the measured latency. | Ta sortie déclare {0} ms. Une sortie filaire réduirait le retard mesuré. | Above 100 ms (AIR-F-32, P7) |

### Loop, files, MIDI

| Key | English | Français | What happens |
|---|---|---|---|
| `state.loopFull` | Six layers: remove one before recording again | Six couches : retire-en une avant d'enregistrer | §7.10 |
| `state.instrumentRefused` | This instrument file was refused: {0} | Ce fichier d'instrument a été refusé : {0} | Whole file refused, with the reason (§11.4, AIR-P-19) |
| `state.instrumentRefusedGeneric` | This instrument file was refused. Nothing was changed. | Ce fichier d'instrument a été refusé. Rien n'a été modifié. | |
| `state.midiUnavailable` | MIDI output is not available in this browser. Everything else works. | La sortie MIDI n'est pas disponible dans ce navigateur. Tout le reste fonctionne. | Hidden where absent (§7.12) |

## 10. Accessibility strings (§12.4, AIR-N-06)

| Key | English | Français | Note |
|---|---|---|---|
| `a11y.stageCanvas` | Stage: hands, play area and strings. The current note is announced as text. | Scène : mains, zone de jeu et cordes. La note en cours est annoncée en texte. | aria-describedby target |
| `a11y.currentNoteLive` | Note {0} | Note {0} | Polite live region, one update per note change |
| `a11y.volumeLive` | Volume {0} decibels | Volume {0} décibels | Throttled to one update per second |
| `a11y.latencyLive` | Latency {0} milliseconds, {1} | Retard {0} millisecondes, {1} | {1} = measured or estimated |
| `a11y.recordStatus` | Recording, bar {0} of {1} | Enregistrement, mesure {0} sur {1} | |
| `a11y.skipToControls` | Skip to the controls | Aller aux réglages | First focusable element |

## Counting and cross-checking

148 labels: 123 screen strings (`home` 13, `stage` 11, `latency` 11,
`instruments` 12, `loop` 19, `calibration` 10, `editor` 19, `physics` 7,
`settings` 15, `a11y` 6) and 25 state strings — the 17 states of §12.2 exactly,
plus 8 sub-states the same situations need (permission cancelled, camera lost,
model weight shown, model retry, light hint, ghost take playing, resume button,
generic refusal). Two commands, from the repository root, keep the count honest
— the second one refuses a row whose French column is empty:

```bash
# total, puis détail par famille d'écran
grep -cE '^\| `[a-z0-9]+\.' docs/user/interface-copy.md
grep -oE '^\| `[a-z0-9]+\.' docs/user/interface-copy.md | sed 's/^| `//' | cut -d. -f1 | sort | uniq -c

# lignes dont la colonne française est vide
grep -nE '^\| `[^`]+` \| [^|]+ \|[[:space:]]*\|' docs/user/interface-copy.md
```

Cross-references: the eight screens come from §12.1, the seventeen states from
§12.2; both lists are complete. Nothing here invents a setting: every control
maps to §7.13 or to an AIR-F requirement cited in its row. Labels for behaviour
that no lot has written yet (pointer-mode keys, hold timing display) stay
deliberately generic: they are copy, not a specification of the engine.

