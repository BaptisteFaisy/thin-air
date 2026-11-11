# Notices

## Thin Air

Code under the MIT licence — see `LICENSE`. Copyright (c) 2026 Baptiste Faisy.

The MIT licence covers the code written for this project only. Third-party
components redistributed here are listed in the sections below, each with its
own licence.

No audio sample, sound bank or recording is embedded in this project: every
sound is synthesised at run time (requirement AIR-F-25). The repository
contains no audio file, and a CI guard refuses any.

## MediaPipe Tasks Vision (hand landmarker)

Hand tracking uses Google's MediaPipe project. Two components are involved,
with two different licence situations: the runtime code (established) and the
model file (not established as of this writing — see below).

### Runtime code — `@mediapipe/tasks-vision` 1.2.2 (npm)

- **Licence: Apache License 2.0.** Checked on 2026-11-11 in three places: the
  installed package (`node_modules/@mediapipe/tasks-vision/package.json`,
  field `"license": "Apache-2.0"`; the package ships no separate LICENSE
  file), the npm registry
  (<https://registry.npmjs.org/@mediapipe/tasks-vision/latest>), and the
  MediaPipe repository LICENSE
  (<https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE>).
- **What this site redistributes:** the wasm runtime files of the package
  (`vision_wasm_internal.js`, `vision_wasm_internal.wasm`,
  `vision_wasm_module_internal.js`, `vision_wasm_module_internal.wasm`),
  copied by `scripts/fetch-model.mjs` into `public/models/wasm/` and served
  by this site itself — never by a third party at run time (AIR-N-01).
- **Attribution (Apache License 2.0, §4):** Copyright (c) 2023 The MediaPipe
  Authors. Licensed under the Apache License, Version 2.0; you may not use this
  file except in compliance with the License. A copy is available at
  <https://www.apache.org/licenses/LICENSE-2.0>.

### Model file — `hand_landmarker.task`

- **Name and version:** HandLandmarker (full), float16; a bundle of a palm
  detection model and a hand landmarks model. Size as downloaded: 7,819,105
  bytes.
- **Download URL** (used by `scripts/fetch-model.mjs`, which stores the file
  in `public/models/`; this site serves it itself):
  <https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task>
- **Licence of the surrounding code:** Apache License 2.0 (section above).
- **Licence of the model file itself: not established as of 2026-11-11.**
  The official pages consulted on that date — the model page
  <https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker>
  (page last updated 2025-01-13), the MediaPipe Solutions guide
  <https://ai.google.dev/edge/mediapipe/solutions/guide>, the Preview notice
  <https://ai.google.dev/edge/mediapipe/solutions/about> (last updated
  2024-05-14) and the MediaPipe APIs Terms of Service
  <https://ai.google.dev/edge/mediapipe/legal/tos.md> (last modified
  2021-11-12) — describe the model and the terms of *use* of the APIs
  (Google APIs Terms of Service, User Data Policy) but **state no licence for
  the downloadable model file**. The CC BY 4.0 notice in the pages' footers
  covers the documentation text only, not the model. The designated model
  card is a PDF — "Model Card Hand Tracking (Lite_Full) with Fairness Oct
  2021", linked from the model page at
  <https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20(Lite_Full)%20with%20Fairness%20Oct%202021.pdf>
  — which this project's documentation tooling cannot read (PDF); a human
  must open it and, if it carries no licence section, ask Google for written
  confirmation (MediaPipe issue tracker, or Stack Overflow with the
  `mediapipe` tag).
- **Consequence in the meantime:** using the model through the MediaPipe APIs
  is covered by Google's published terms; redistributing the runtime code and
  wasm files is covered by Apache 2.0 with the attribution above.
  Redistributing the `.task` file itself from this site's own origin is not
  clearly authorised by any licence text read so far. The open point is
  tracked in `docs/recette.md` ("Ce qui demande encore une main humaine") and
  the full check log is in `docs/journal.md`.
- **What this site redistributes:** the `.task` file and the four wasm files,
  both served from this site's own origin. **What it does not redistribute:**
  no other MediaPipe model, dataset or binary.

## Fonts and artwork

No third-party font is bundled at this stage; the stage is drawn on a canvas
with system fonts. Any later addition must be under a free licence and listed
here.
