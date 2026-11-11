# Thin Air

Raise your hands in front of a webcam and the air becomes an instrument. One
hand picks the pitch, the other the volume; invisible strings ring when your
fingers cross them; a loop keeps what you just played while you add another
voice. Nothing to install, no music software to open, and **no image ever
leaves your browser**.

Thin Air is a Kiroween 2026 entry in the Frankenstein category: hand tracking
at 30 frames a second stitched to sound synthesis at 48 000 samples a second,
plus music theory, plus adaptive signal filtering. The seam between those two
clocks is the whole project.

## Judge in three minutes

1. Open the site and click **Start**, then allow the camera. Raise both hands:
   two ghost hands appear on a dark stage, and the first note is already in
   tune — pitches snap to a scale by default, so a wrong note takes effort.
   No camera, or no wish to switch one on? Click **Play without a camera**: the
   pointer becomes one hand, the keyboard becomes the other, and everything
   else is the same engine.
2. Look at the latency read-out in the corner. It lists each part separately
   and says which parts are **measured** and which are **estimated**. If your
   headphones are wireless and the declared audio output goes past 100 ms, the
   page says so and suggests a wired output.
3. Prove it without listening. Every musical behaviour in this project is a
   property test on recorded hand movements, rendered to a file and measured:

   ```bash
   npm ci
   npm run typecheck
   npx vitest run                                  # 22 properties, no sound
   npm run bench -- events --take takes/synth/slow-rise.json --instrument instruments/phantom.json
   npm run bench -- render --take takes/synth/slow-rise.json --instrument instruments/phantom.json --out bench-out
   cat bench-out/report.json                       # notes, cents off, peak dB, silence after release
   ```

   The bench never opens an audio device. The agent that built this instrument
   was never allowed to hear it.

## What it is

| | |
|---|---|
| Category | Frankenstein |
| Chimera | Hand tracking (MediaPipe, 21 points per hand) × Web Audio × scales and chords × adaptive filtering of a noisy signal |
| In one line | A webcam turns thin air into an instrument: your hands touch invisible notes, in tune by construction, with nothing to install |
| Licence | MIT for the code; MediaPipe is Apache 2.0 (see `NOTICE.md`) |
| Privacy | No image is stored, no take is uploaded, no microphone, no analytics, no third-party request after load |

## The four angles

Plenty of free browser instruments already do hand-tracked sound — this project
does not claim to invent it. What it claims (cahier §6.2):

1. **Proof without listening.** Recorded hand points (never images) are replayed
   through the whole chain, rendered to a file without a loudspeaker, and
   measured: which notes, at which frequencies, at which times, at which level.
2. **The instrument is a file.** Zones, scale, range, sound, gesture-to-parameter
   mappings: all in one readable file, validated by a schema, shareable as a
   link. Six instruments ship; anyone can rewrite one.
3. **It fits your reach.** Before playing you show how far your hands go; the
   whole instrument is mapped into that area. One-hand mode and hold mode too.
4. **Latency is stated and compensated.** Displayed part by part, and given back
   by the loop, which advances recorded events by the estimated latency.

## Repository

```text
apps/web        the stage: hands, strings, zones, loop, settings, calibration
apps/bench      the proving bench: a take + an instrument → events, WAV, report
packages/core   pure: space, filter, features, gestures, music, instrument,
                voices, schedule, loop, midi, measure   (no browser, no audio)
packages/audio  synthesis engine: dsp, offline render, WAV, Web Audio graph
packages/vision thin wrapper: camera, hand landmarker, take recorder, replay
packages/schema instrument, take, session — validated, never silently repaired
instruments/    phantom, harp, choir, bells, drone, grid-drums
takes/          reference takes and synthetic take generators
.kiro/          specs, steering, hooks, agents (the build is a Kiro story)
docs/           the brief, the contract, the logbook, the latency measurements
```

The boundary between `core` and `audio` is a list of events dated on the audio
clock — the seam made into a type:

```ts
type MusicEvent =
  | { type: "noteOn"; t: number; voice: string; midi: number; velocity: number }
  | { type: "noteOff"; t: number; voice: string }
  | { type: "control"; t: number; voice: string;
      param: "pitch" | "gain" | "cutoff" | "vibrato"; value: number };
```

## Building it

```bash
npm ci                 # Node 22 or later
npm run fetch-model    # hand_landmarker.task into public/models (served by us)
npm run typecheck
npx vitest run         # no test emits a sound; nothing opens an audio device
npm run guards         # no audio asset in the repo, wording rules, take privacy
```

The vision model is served by the site itself, never by a third party, so the
page keeps working offline after the first visit.

## Rules this repository enforces on itself

- No test, script, hook or agent command emits a sound, plays an audio file, or
  touches the machine volume (AIR-N-02). Offline rendering only.
- No audio file may be committed; every sound is synthesised (AIR-F-25). The
  guard `scripts/hooks/no-audio-asset-guard.mjs` runs in CI.
- Labels follow the vocabulary table of §5.4: latency is "estimated" or
  "measured", never "real time". The guard `scripts/hooks/wording-guard.mjs`
  runs in CI.
- A take contains hand points and nothing else — no image, ever (AIR-F-47,
  `take-privacy-guard`).
- Peak level never goes past −1 dB; master volume defaults to −12 dB
  (AIR-F-28, AIR-N-03).

## Status

Under construction for the Kiroween 2026 deadline. The logbook is
`docs/journal.md`; the build contract and lot ownership are in
`docs/CONTRACT.md`; the full brief (French) is `docs/cahier-des-charges.md`.
