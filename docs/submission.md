# Submission — Kiroween 2026, category Frankenstein

Text for the submission form (cahier §17.3). English, because the judges read
English (AIR-N-14). Every number in this text comes from a figure already in the
repository, or from a command run while writing it (each command is listed in
the annex). Where a figure is still missing it is written `TODO(mesure)` and it
is also listed in the final section "What still has to be measured before
sending". Nothing is invented.

---

## Where the idea comes from

A theremin is an instrument you never touch: two antennas, one hand for pitch,
one for volume, and a sound that comes out of nowhere. It is the ghost voice of
old horror films — the sound Léa, eleven years old, wants to play "like the
ghost". A theremin costs several hundred euros and is notoriously hard to keep
in tune. The browser versions that imitate it either ask you to install
something, or greet you with forty settings, or both. Meanwhile everybody
already owns a camera and a speaker.

What is missing is not a theremin in a browser. **A dozen free browser
instruments already do hand-tracked sound** (§6.1), and one of them, Jasper
Bernaers' *Hand Tracking Instrument*, is close to a small studio: eight playing
modes, twelve scales, twenty-five synthesised sounds by four methods, a
six-layer looper, export to video, audio, MIDI and stems. Trying to beat that on
feature count in six days would be a losing game.

So the question I kept was different: *what is actually hard about stitching a
camera to a synthesiser?* The camera hands you thirty positions per second; the
sound engine wants forty-eight thousand samples per second. Every crackle, every
trailing note, every stuck note in an instrument like this comes from that seam.
Thin Air is built around that seam instead of hiding it.

## What it does

You open a page, press **Start**, allow the camera, and raise your hands. Two
ghost hands appear on a dark stage — the camera image itself is never shown
(§12.3). One hand picks the pitch, the other the volume. Pitches **snap to a
scale** by default, so a wrong note takes deliberate effort; a slider brings back
the continuous glide, the sound that scared you as a child.

Six instruments ship: Phantom (the theremin), Harp (sixteen plucked strings),
Choir (eight held zones), Bells, Drone, Grid drums (§7.8). Each one is a
readable file — scale, root, range, strings or zones, magnet strength, sound,
gesture mappings — validated by a schema, shareable as a link, editable in the
page and by hand (§6.2, AIR-F-43 to AIR-F-45).

A loop records what you just played, up to six layers, and **gives back the
latency** it took: events are moved earlier by the estimated latency, so the loop
stays on the beat instead of limping (§7.10, AIR-F-35).

Latency is on screen, part by part, and each part is labelled **measured** or
**estimated** — analysis, processing and audio output are measured, the camera
leg is estimated because a page cannot see inside it (§5.1, AIR-F-31). If the
declared audio output goes past 100 ms — a wireless headset — the page says so
and suggests a wired one (AIR-F-32).

No camera, or no wish to switch one on? **Play without a camera**: the pointer
becomes one hand, the keyboard plays the notes, same engine (P2, AIR-F-02).

**Nothing leaves your browser**, and here is why that is true rather than a
motto: the page is a set of static files; the hand-tracking model is downloaded
from the same page and runs inside the browser tab; there is no backend to send
an image to; no analytics; no microphone is ever requested (AIR-N-01, AIR-F-56,
AIR-F-57). Recorded takes contain hand points and never an image (§7.11).

## How it is built with Kiro

The premise was uncomfortable and turned into the method: **the agent that builds
the instrument is not allowed to hear it.** No test, no script, no hook, no agent
command emits a sound or touches the volume (AIR-N-02); the browser used for
tests runs headless with sound off. Every musical behaviour is therefore proven
by a file and a number.

| Kiro surface | How it was used |
|---|---|
| **Specs** (§14.1) | Twelve specs, one per lot: `capture-vision`, `play-space`, `filtering`, `gestures`, `music-mapping`, `instrument-format`, `seam-and-voices`, `synth-engine`, `loop-export`, `takes-bench`, `stage-ui`, `midi-out`. Each has `requirements.md`, `design.md`, `tasks.md` in `.kiro/specs/`. Requirements analysis ran on every `requirements.md` before design |
| **Steering** (§14.2) | Eleven files: six always-on (`product`, `tech`, `structure`, `testing`, `no-sound`, `privacy`), four matched to files (`two-clocks` — the three rules of §7.9, `music-theory`, `mediapipe`, `honest-latency`), and one manual (`release`, loaded only for a publication session). The steering files are load-bearing: `two-clocks` is the reason parameters move by ramps and never by steps |
| **Hooks** (§14.3) | Eight command hooks, no credits spent: `no-sound-guard`, `core-properties`, `render-check`, `instrument-schema-guard`, `take-privacy-guard`, `no-audio-asset-guard`, `wording-guard`, `journal-reminder`, declared in `.kiro/hooks/hooks.json`. Each is also a CI guard, so the same rule is checked while writing and after the push |
| **Agents** (§14.4) | `luthier` writes an instrument file from a one-sentence description, validates it, renders it on the reference takes and reads the report — the six instruments are its work. `seam-reviewer` (read-only) re-reads audio code against `two-clocks`. `wording-reviewer` (read-only) re-reads labels against `honest-latency` |
| **MCP** (§11.7) | The project's own server is the optional path (§11.7): three read-and-compute tools, `render_take`, `list_notes`, `compare_reports` — the agent's ears in numbers. The bench CLI ships the same reads today as four commands, `events`, `render`, `compare`, `synth` (§11.6), so the checks run without a server |

The build itself, measured while writing this text (commands in the annex):

| Figure | Value | Source |
|---|---|---|
| Merged pull requests on the build | 24 | `gh pr list --state merged --limit 40 | wc -l` |
| Tests | 946 pass, 23 `todo` (969 total), 62 files | `npx vitest run` |
| Lines of TypeScript (`.ts`/`.tsx`/`.mjs`, no `node_modules`) | 29 542 | `find … | wc -l` per package (annex) |
| — `packages/core` | 8 435 | same |
| — `apps/web` | 6 980 | same |
| — `packages/audio` | 4 078 | same |
| — `packages/vision` | 3 876 | same |
| — `apps/bench` | 3 354 | same |
| — `packages/schema` | 1 521 | same |
| — `scripts` | 1 286 | same |
| Specs in `.kiro/specs/` | 12 | `ls` |
| Steering files in `.kiro/steering/` | 11 (6 always, 4 file-matched, 1 manual) | `ls` |
| Command hooks in `.kiro/hooks/hooks.json` | 8 | read the JSON |
| Custom agents in `.kiro/agents/` | 3 | `ls` |
| Instruments written by `luthier` | 6, all schema-valid | `ls instruments/*.json`, `instrument-schema-guard` |
| Frozen reference takes | 7 | `ls takes/reference` |
| Music properties, all green | 22 (AIR-P-01 to AIR-P-22) | `docs/recette.md` |
| Credit budget, indicative | 700 to 900 of 4 000 | §14.6 |
| Credits actually spent | `TODO(mesure)` | read from the Kiro account |
| `no-sound-guard` blocks during the build | `TODO(mesure)` | count from the Kiro hook logs |
| Property counter-examples found | `TODO(mesure)` | count from the logbook |

The instrument, measured and recorded on 2026-11-11 (sources cited, not
re-measured here):

| Measure | Value | Where recorded |
|---|---|---|
| Hand-tracking model weight | 7 819 105 bytes; runtime wasm 14 604 817 bytes; first load ≈ 22 MB | `docs/latency.md` |
| Site build | 306 kB of JavaScript, 97 kB gzip, no third-party origin | `docs/journal.md` |
| Take size | raw JSON 64–127 kB/s; compact JSON 18 kB/s (one hand), 35 kB/s (two hands) | `docs/journal.md` |
| Rendering accuracy (pitch) | max deviation 3.05 cents, tolerance 5 | `docs/recette.md` |
| Peak level | −35.3 dB, requirement < −1 dB | `docs/recette.md` |
| Silence after the hands leave | 723 ms, target ≤ 800 ms | `docs/recette.md` |
| Filter trail on theremin notes | mean 87 ms (0–110); the brief predicted ≈ 80 | `docs/recette.md` |
| 4-bar loop at 90 bpm | exactly 512 000 samples at 48 kHz, 10.667 s | `docs/recette.md` |
| CI budget | 39 s to 2 min 41 s per job | `docs/recette.md` |

## What pushed back

Four things resisted, and they are the interesting part:

1. **The seam between two clocks.** Thirty positions per second into forty-eight
   thousand samples per second. Three rules came out of it and none admits an
   exception: never set an audio parameter directly while a voice is sounding
   (ramps, τ = 20 ms); date every event on the sound clock with a look-ahead;
   bound the voices and always release them (eight at most, all released if no
   frame has been analysed for 300 ms) — §7.9, AIR-F-26, AIR-F-27, AIR-F-16.
2. **The plucked string does not fit in the ordinary audio graph.** Karplus-Strong
   needs a delay shorter than a block; inside the page's audio graph a feedback
   delay cannot go below 128 samples, i.e. 2.67 ms, which would cap the
   instrument at 375 Hz. The string had to live in its own audio worklet (§7.9,
   AIR-F-29).
3. **Playing in tune without touching anything.** Residual tremor of 0.5 % of the
   play area width moves the note by 18 cents, which is audible (§5.3). Hence the
   magnet by default, the 15 % hysteresis margin so a hand hesitating on a border
   does not flip notes ten times a second, and the two-channel filter: a smoothed
   channel for continuous settings, a barely filtered one for attacks (§7.5,
   §7.6).
4. **Proving sound without hearing it.** The offline render was moved out of the
   browser into a pure TypeScript sample-by-sample engine running in Node. That
   is stricter than a headless browser: no audio device can be opened at all, and
   the render is reproducible bit for bit in CI. The same engine feeds the live
   worklets — one implementation, two wrappers (`docs/journal.md`).

Two figures that sum up the difficulty, both from the brief: the total latency is
**46 to 178 ms, about 105 ms in a common wired case** (§5.1), and with 105 ms
every recorded note would land 63 % of a sixteenth note late — which is exactly
what the loop compensation undoes (§7.10).

### What the tests caught

Six defects, each caught by a test and not by re-reading, with one line for the
cause (details in `docs/journal.md` and the commit messages):

| Defect | Cause |
|---|---|
| The synthetic take was read backwards — pitch descended instead of rising, and the theremin gave one note instead of eight | `apps/bench/src/synth.ts` had its own `u → x` conversion, duplicated without the mirror of §7.4; the single conversion now lives in `takeGen.uToImageX` / `vToImageY` |
| The string sweep followed the palm, not the index fingertip — strings 4 5 6 7 instead of 3 4 5 6 | `sweepTake` placed the palm centre where §7.14 moves the index fingertip; it now offsets by a measured `indexTipOffsetU` |
| `--settings '{"magnet":1}'` was rejected | the validator compared against the type of the default value; the default for `magnet` is `null`, and `typeof null` is `"object"` in JavaScript, so no number passed |
| The render report measured a mean frequency over the whole voice — 390 Hz where G (196 Hz) was expected | the report averaged across pitch changes; it now splits the voice at each pitch control (`noteSteps`) and measures each plateau after an 80 ms guard |
| A choir zone note stayed stuck after leaving the zone | the `leave` gesture arrives in phase *end* but the `hold` mapping only acted in phase *start*; the AIR-P-09 unit tests missed it because `end()` releases everything at the end of the take |
| A timestamp one ulp earlier than the previous one | the ramp calculation could fall just below the last issued timestamp because of floating-point rounding; `ordonner` now clamps to the last one, so AIR-P-11 holds exactly |

Two earlier companions, from the first day (`docs/journal.md`): a pinch triggered
by a non-finite velocity (two frames with the same timestamp make `NaN`, and
`NaN < threshold` is false in JavaScript), and hands swapping roles when they
crossed (matching by proximity alone; AIR-P-21 now requires the anatomical side
as the primary key).

## What was learned

- **An agent without ears writes better tests.** Deprived of the sense that
  normally judges music, it has to turn every sentence of the brief into a
  measurable property: no note outside the scale, no stuck note, one string
  crossing one note, peak never above −1 dB. Those are now acceptance criteria
  and tests, not adjectives.
- **Steering changes code, measurably.** The clearest demonstration is the
  parameter set without a ramp that gets written before `two-clocks` is loaded,
  the same line after it, and the crackle measurement (AIR-P-16) in both cases.
- **Stating the latency costs nothing and buys credibility.** Saying "about a
  tenth of a second, here is the breakdown, here is the part I cannot measure"
  is more convincing than any claim of imperceptibility — and it forced better
  instrument choices: sustained sounds first, plucked sounds next, percussion
  only on a grid.
- **Honesty is checkable.** The vocabulary table of §5.4 is enforced by a guard
  on every label, so the marketing words cannot creep back in late at night.

## What is different from what already exists

Naming the neighbours plainly, because a judge will check (§6.1):

- **Hand Tracking Instrument**, Jasper Bernaers — the most complete: eight modes,
  twelve scales, twenty-five synthesised sounds, six-layer layering, video/audio/
  MIDI export. Beating it on feature count was never the plan.
- **HandSynth** — chords by finger count, expression with the other hand, MIDI
  out, audio recording; it *already* displays analysis time and audio latency,
  and it *already* plays with mouse, touch and keyboard. Those are table stakes
  now, not advantages.
- **The "Gesture Synth" family** (at least seven sites and several open
  repositories) — chord triggering by gestures with MediaPipe and an audio
  library; the genre is established, with its own conventions.
- **Neo Theremin, webcam-theremin, Handophone** — theremins and variants; a
  theremin alone is not enough.
- **HandSonor** (research, 2013) — a customisable vision-based musical control
  interface: adjustable mapping has research ancestry.
- **The theremin itself** (1920) — the ancestor, and the ghost voice of cinema.

And without hedging: **none of my four angles is out of reach of the instruments
that already exist.** Latency display exists in HandSynth; per-instrument files
are an obvious extension of any gesture synthesiser; reach calibration is a
rectangle; loop compensation is arithmetic. The bet is their **union**, the
quality of the seam, and the construction story — an instrument whose every
behaviour is provable without listening, built by an agent that was never allowed
to hear it (§6.2).

## What comes next

- Real measurements on at least two machines, replacing the order-of-magnitude
  table of §5.1 in `docs/latency.md` (AIR-N-05).
- The recorded-take workflow as a first-class feature: "send me the take" turns a
  bug report into a deterministic reproduction on another machine (P9).
- MIDI out stabilised, and a proper power for it: describe an instrument, write
  the file, render, read the report, adjust (§14.4).
- Accessibility beyond this edition: an interaction model that works with no
  visual feedback at all — discrete zones stepped by keys, spoken pitch, guided
  calibration by ear (`docs/accessibility.md`, section 4).
- Two players in front of one camera (AIR-F-55, optional in this edition).

---

## Judge in three minutes

(Also the README, §17.2.)

1. **Open the address, press Start, allow the camera, raise both hands.** Two
   ghost hands appear on a dark stage. The first note is in tune: pitches snap to
   a scale by default, so a wrong note takes effort. No camera at hand? Press
   **Play without a camera** — the pointer becomes one hand, the keyboard plays
   the notes, and nothing else changes.
2. **Read the latency box.** Every part is listed separately, each labelled
   measured or estimated. If your output is a wireless headset and it declares
   more than 100 ms, the page tells you so.
3. **Prove it without listening.** Every musical behaviour here is a property
   test on recorded hand movements, rendered to a file and measured:

   ```bash
   npm ci && npm run fetch-model
   npx vitest run       # 946 tests pass (23 todo); 22 of them are the music properties, no sound
   npm run bench -- events --take takes/reference/slow-rise.json --instrument instruments/phantom.json
   npm run bench -- render --take takes/reference/slow-rise.json --instrument instruments/phantom.json --out bench-out
   cat bench-out/report.json            # notes, cents off, peak dB, silence after release
   ```

   The bench never opens an audio device. The agent that built this instrument
   was never allowed to hear it.

Two minutes more? Open **Show the physics**: the frequency, the note name and the
sound's curve, live — go up an octave and the frequency doubles (P5). Then press
**Record**, play three layers, and export: the audio comes from the offline
renderer, the same one the tests use.

---

## Video script — under three minutes, English

(§17.1. Music is improvised in the tool, no existing tune, no third-party music;
the two words the vocabulary table of §5.4 forbids do not appear on screen or in
the voice-over.)

| Time | Picture | Voice |
|---|---|---|
| 0:00 – 0:12 | Black screen. Two ghost hands appear. One note rises | Silence first, then: "No instrument. No install. A webcam, and thin air." |
| 0:12 – 0:40 | Phantom: a slow phrase, snapped to the scale. Magnet off: the glide from old horror films. Magnet back on | "Notes snap to a scale, so you can't play a wrong one. Unless you want the ghost." |
| 0:40 – 1:25 | The loop, one take, no cuts: a drone, the harp, the choir, then the theremin over it. The latency counter stays visible | "The camera sees thirty frames a second. Sound needs forty-eight thousand samples a second. The seam between those two clocks is the whole project. The loop even gives back the tenth of a second the camera takes." |
| 1:25 – 1:45 | Seated calibration; one-hand mode; hold mode | "It fits the reach you have." |
| 1:45 – 2:35 | Kiro: the `no-sound-guard` hook blocking a command; a take replayed; the measurement report; one property and its counter-example; `luthier` writing an instrument from one sentence | "The agent that built this instrument was never allowed to hear it. Every musical behaviour is a property test on recorded hand movements, rendered to a file and measured." |
| 2:35 – 2:55 | Back to the stage; the piece ends; the address on screen | "Open source. Nothing leaves your browser." |

Shot list constraints: the camera image never appears on screen (§12.3), which
also means the room and any face stay out of the video; no flash, no strobe
(§12.3); the film must not need sound to be read, so the latency counter, the
note name and the property report are legible in frame (the on-screen text
carries the argument the voice makes).

Bonus items of §17.4 are separate: a blog post on "an instrument built by an
agent that cannot hear", and a social post starting with `#KiroweenHackathon26`
with fifteen seconds of the piece.

---

## What still has to be measured before sending

The three `TODO(mesure)` figures above, and the gaps the recipe (§18) still
marks as needing a hand:

- **Credits actually spent** (`TODO(mesure)`) — read from the Kiro account.
- **`no-sound-guard` blocks during the build** (`TODO(mesure)`) — counted from
  the Kiro hook logs.
- **Property counter-examples found** (`TODO(mesure)`) — counted from the
  logbook.
- **Latency on at least two real machines** — the `Relevés` table in
  `docs/latency.md` is still empty (AIR-N-05).
- **The one human listening session** — the kit is ready (`docs/seance-ecoute.md`)
  and the grid is deliberately empty; this is the single line of the recipe that
  is returned to an ear.
- **The licence of the model file** — the code and the wasm are Apache 2.0, but
  the licence of `hand_landmarker.task` is not established; the PDF model card
  could not be read with the allowed tools (`docs/journal.md`, lot N1).
- **A network capture on the public page** — the end-to-end test records the
  network log in its own browser; the recipe still asks for a capture of the
  deployed page to be attached.
- **The video** — the script is written here; the piece has still to be played
  and filmed.

---

## Annex — how the build numbers were measured

Run in the worktree `n8-soumission`, on the branch `lot/n8-soumission`, on
2026-11-11. Each command is listed with the figure it produced:

```bash
gh pr list --state merged --limit 40 | wc -l                     # 24 merged PRs
npx vitest run                                                    # 946 pass, 23 todo, 62 files
find packages apps scripts \( -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' \) \
  -not -path '*/node_modules/*' | xargs cat | wc -l               # 29 542 lines (run per directory for the split)
ls .kiro/specs | wc -l                                            # 12 specs
ls .kiro/steering | wc -l                                         # 11 steering files
python3 -c "import json;print(len(json.load(open('.kiro/hooks/hooks.json'))['hooks']))"   # 8 hooks
ls .kiro/agents | wc -l                                           # 3 agents
ls instruments/*.json | wc -l                                     # 6 instruments
ls takes/reference | wc -l                                        # 7 frozen reference takes
node scripts/hooks/run-all-guards.mjs                             # exit 0 — all guards green
npm run bench -- events  --take takes/reference/slow-rise.json --instrument instruments/phantom.json
npm run bench -- render  --take takes/reference/slow-rise.json --instrument instruments/phantom.json --out /tmp/bench-n8 --no-wav
```

The instrument measures (model weight, build size, take size, rendering
accuracy, peak, silence, filter trail, loop sample count, CI budget) are quoted
from `docs/latency.md`, `docs/journal.md` and `docs/recette.md`, where they were
measured and written down on 2026-11-11; they are cited rather than re-measured.