# BROUILLON — à relire et publier par Baptiste, aucune publication automatique

> Billet en anglais (même lectorat que la soumission, AIR-N-14). Chaque chiffre
> ci-dessous est vérifiable dans `docs/recette.md` et `docs/journal.md` — aucun
> n'est inventé, et la langue respecte le §5.4 (les mots interdits n'y
> apparaissent pas, pas plus que dans ce texte).

---

## An instrument built by an agent that was never allowed to hear it

Thin Air is a browser instrument for Kiroween 2026: you open a page, allow the
camera, raise your hands, and two ghost hands play music in mid-air. Six
instruments ship with it — a theremin, a harp, a choir, bells, a drone, grid
drums. Here is the part that shaped everything: **the agent that built it was
forbidden from hearing it.** No test, no script, no hook, no agent command may
emit a sound or touch a volume (rule AIR-N-02). The browser used for tests runs
headless with sound off, and a guard hook blocks any shell command that would
open an audio device.

So how do you build a musical instrument without ears? You turn every musical
sentence into a file and a number.

### What replaces the ear

The whole acceptance suite is reproducible on any machine: 946 tests, no sound,
and 22 named properties (AIR-P-01 to AIR-P-22) that carry the music — no note
outside the scale, no stuck note, one string crossing gives exactly one note,
the peak never above −1 dB, determinism to the bit.

The brief's worked theremin example is the touchstone. Replayed through the
bench on the recorded hand movements, it prints the eight expected notes —
55, 57, 58, 61, 62, 64, 65, 67 — at the reference times within one frame. The
offline render measures each plateau to **3.05 cents** of deviation for a
tolerance of 5; the peak sits at **−35.3 dB** under a −1 dB ceiling; silence
falls **723 ms** after the hands leave, inside the 800 ms target. The four-bar
loop renders to **exactly 512 000 samples** at 48 kHz — 10.667 seconds, not one
more. The harp example plucks four notes, A, C, D, F, spaced 133 ms apart
against a 125 ms target with a one-frame tolerance.

### The filter's drag, predicted and then measured

The interesting number is the one the brief predicted before any code existed.
Smoothing a 30-frames-per-second hand stream into an audio parameter drags every
note slightly late. The brief announced "about 80 ms" of drag on the theremin
example; the measurement, taken from the rendered events, gives **87 ms on
average, from 0 to 110 ms depending on the note**. An 87 ms measured against an
80 ms predicted is the kind of coincidence that tells you the seam between the
two clocks — 30 positions per second in, 48 000 samples per second out — is
wired the way the design describes it.

### The defects the tests caught (and the eyes did not)

None of these came out of a code review. All came out of a property test or a
bench run:

- **A pinch triggered by nothing.** Two frames sharing a timestamp produced a
  non-finite hand speed, and `NaN < threshold` is false in JavaScript — so a
  velocity filter waved it through and the instrument plucked a string on its
  own.
- **Hands swapping roles when they crossed.** Matching by proximity alone
  exchanged left and right at crossings; the property test on stable roles
  (AIR-P-21) forced the anatomical side to become the primary key.
- **Synthetic takes read backwards.** The bench had its own coordinate
  conversion without the mirror of the play space, so the "slow rise" take made
  the pitch *descend* and the theremin gave one note (MIDI 70) instead of eight.
  Fixing it meant deleting the second implementation and delegating to the one
  in the core — plus a round-trip test that locks the convention.
- **The string sweep followed the palm, not the index.** The example says an
  index tip travels between strings; the generator placed the palm centre, one
  string off — 4, 5, 6, 7 instead of 3, 4, 5, 6.
- **A settings validator that rejected every number.** It compared against the
  type of the default value, and the magnet's default is `null` — whose
  `typeof` in JavaScript is `"object"`. No number could ever pass.
- **A measurement report that lied.** On a continuous voice, averaging the
  frequency over a 4.2-second note produced 390 Hz for a G expected at 196 Hz.
  The report now cuts the voice at every pitch control and measures each
  plateau separately — that is where the 3.05 cents comes from.
- **The classic stuck note.** Leaving a choir zone did not release the note,
  because the "leave" gesture arrives in the end phase while the hold mapping
  only acted on the start phase. Unit tests could not see it: the end of the
  take cleaned everything up. The integration replay did.

The CI rejected its share too: a README that quoted a forbidden marketing
expression *in order to explain it* (the vocabulary guard refused its own
justification — the rule is now described without spelling the words), a lock
file out of sync with the workspaces, and a pull request whose declared scope
omitted a file-mode change.

### The costs, measured

The hand-tracking model weighs 7 819 105 bytes, and the first load pulls about
22 MB in total — which is why the page offers pointer play while it downloads.
Raw recorded takes came in at 64 to 127 KB/s, up to 4.9 times the estimate,
until compact JSON rounding (to 1e-5, below a thousandth of a pixel in 1080p)
brought them down to 18 KB/s for one hand and 35 KB/s for two. The built site
is 306 KB of JavaScript, 97 KB gzipped, with zero requests to any third-party
origin — checked automatically before every publication. The CI verdict lands
between 39 s and 2 min 41 s per run.

### The one line given back to the human

Everything above is files and numbers. One acceptance line remains,
deliberately, for a human ear: the listening session, noted in the logbook with
its date and what was adjusted afterwards. The agent cannot check that box. It
never hears the instrument it built — and that constraint, not any talent, is
why every musical promise in this project is a measurement.

*Open source. Nothing leaves your browser. The latency counter on screen labels
every part of the delay measured or estimated — including the part a page
cannot see.*
