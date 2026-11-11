# Notices

## Thin Air

Code under the MIT licence — see `LICENSE`. Copyright (c) 2026 Baptiste Faisy.

No audio sample, sound bank or recording is embedded in this project: every
sound is synthesised at run time (requirement AIR-F-25). The repository
contains no audio file, and a CI guard refuses any.

## MediaPipe Tasks Vision (hand landmarker)

Hand tracking uses Google's MediaPipe project:

- Package: `@mediapipe/tasks-vision`
- Model: `hand_landmarker.task`, downloaded by `scripts/fetch-model.mjs` into
  `public/models/` and served by this site itself — never by a third party.
- Licence of the MediaPipe code: Apache License 2.0
  (<https://www.apache.org/licenses/LICENSE-2.0>).
- Licence of the model file: to be confirmed on its model card and recorded in
  `docs/journal.md` (open point in the brief, annexe D).

Apache License 2.0 — Copyright (c) 2023 The MediaPipe Authors. Licensed under
the Apache License, Version 2.0; you may not use this file except in compliance
with the License. A copy is available at the address above.

## Fonts and artwork

No third-party font is bundled at this stage; the stage is drawn on a canvas
with system fonts. Any later addition must be under a free licence and listed
here.
