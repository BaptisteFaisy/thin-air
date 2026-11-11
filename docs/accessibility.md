# Accessibility — WCAG 2.2 level AA, and how it is proven

Target: **WCAG 2.2, level AA**, for every control of the instrument (cahier
§10, AIR-N-06, §12.4). Scope is the whole page: the welcome screen, the eight
screens of §12.1, the seventeen states of §12.2, and both ways of playing —
camera, or pointer and keyboard.

Two structural decisions make this reachable, and they are worth stating before
the checklist:

- **Nothing essential lives on the canvas.** The stage is a 2D canvas redrawn at
  screen rate (§11.8); every setting is an ordinary page control beside it, in
  the document's tab order. The canvas carries an accessible description and
  the current note is *also* text (WCAG 1.1.1, 1.3.1).
- **No camera is required to reach any feature.** Pointer and keyboard drive
  the same engine (§12.4, AIR-F-02, P2), so a person who cannot use a webcam, or
  cannot raise both hands, still gets the whole instrument.

## 1. Colour: the three colours of §12.3, with exact values

The artistic direction asks for three colours: night, bone, and one spectral
tint for what sounds. Values below are the proposal; every ratio is computed
with the WCAG 2.2 relative-luminance formula, not estimated by eye:

```text
L  = 0.2126·R + 0.7152·G + 0.0722·B     (each channel linearised:
                                          c/12.92 if c ≤ 0.03928,
                                          ((c+0.055)/1.055)^2.4 otherwise)
CR = (L_light + 0.05) / (L_dark + 0.05)
```

| Role | Name | Hex | Used for |
|---|---|---|---|
| Background | night | `#0B0D14` | Page and stage background |
| Surface | night, raised | `#161A24` | Panels, drawers, tooltips |
| Drawing | bone | `#F2EBDC` | Ghost hands, primary text |
| Secondary text | bone, dimmed | `#8A8272` | Hints, units, captions |
| What sounds | spectral tint | `#7CE8CB` | Current note, strings, level bar, focus ring base |
| Sounding area | tint, deep | `#123F38` | Zone fill under the tint |
| Warning | amber | `#F2C46A` | Wireless output, low light, edge of area |
| Failure | pale brick | `#FFB3A0` | Refused file, model failure, camera refused |
| Focus | tint, light | `#B8F5E4` | Focus ring, drawn 2 CSS px outside the control |

### Computed contrast ratios

Measured with the formula above (`/tmp` calculation, reproduced by the snippet
at the end of this section).

| Pair | Ratio | Requirement | Verdict |
|---|---|---|---|
| bone `#F2EBDC` on night `#0B0D14` | **16.35:1** | 4.5:1 (1.4.3) | pass, wide margin |
| bone `#F2EBDC` on surface `#161A24` | **14.65:1** | 4.5:1 | pass |
| dimmed bone `#8A8272` on night `#0B0D14` | **5.10:1** | 4.5:1 | pass, thin margin — never used below 12 px |
| dimmed bone `#8A8272` on surface `#161A24` | **4.57:1** | 4.5:1 | pass, thinnest pair in the palette |
| spectral tint `#7CE8CB` on night `#0B0D14` | **13.18:1** | 4.5:1 as text, 3:1 as graphic (1.4.11) | pass |
| spectral tint `#7CE8CB` on surface `#161A24` | **11.81:1** | 4.5:1 | pass |
| night `#0B0D14` on spectral tint `#7CE8CB` (active control) | **13.18:1** | 4.5:1 | pass |
| night `#0B0D14` on bone `#F2EBDC` (primary button) | **16.35:1** | 4.5:1 | pass |
| tint `#7CE8CB` on deep tint `#123F38` | **7.95:1** | 4.5:1 | pass |
| dimmed bone `#8A8272` on deep tint `#123F38` | **3.08:1** | 4.5:1 | **fail** — dimmed text is therefore never placed on a sounding zone |
| bone `#F2EBDC` on deep tint `#123F38` | **9.86:1** | 4.5:1 | pass — the only text colour allowed on a sounding zone |
| amber `#F2C46A` on night `#0B0D14` | **11.90:1** | 4.5:1 | pass |
| pale brick `#FFB3A0` on night `#0B0D14` | **11.28:1** | 4.5:1 | pass |
| focus `#B8F5E4` on night `#0B0D14` | **15.92:1** | 3:1 (1.4.11) | pass |

Rules that follow, and that a reviewer can check in the stylesheet:

1. No text is drawn on the stage canvas except the current note name and the
   level value, both also present in the document (see 1.4.3 below).
2. The sounding zone fill never carries dimmed bone text; it carries bone.
3. Contrast is not carried by hue alone: the current note is tint **and** bold
   **and** present as text; the hand-at-edge warning is a shape plus a message,
   never colour alone (1.4.1).

## 2. Checklist

Each line names the criterion, what the product does, and where the evidence
lives. `[auto]` = checked by the automated pass, `[manual]` = checked by hand
and written in the recipe (§18), `[todo]` = not done yet, with the reason.

### Perceivable

| Criterion | What we do | Evidence |
|---|---|---|
| 1.1.1 Non-text content | The stage canvas has a description; the physics curve has a text equivalent (frequency, note name, cents); every icon button has a name | `[auto]` axe rule `image-alt`, `svg-img-alt`, `role-img-alt` |
| 1.2.x Media | No audio or video plays in the interface; the demo video is outside the product | out of scope by design |
| 1.3.1 Info and relationships | Controls grouped in labelled `fieldset`/`section`; the settings panel is a real form, not a picture of one | `[auto]` + `[manual]` screen reader pass |
| 1.3.2 Meaningful sequence | Tab order follows the reading order: stage, then transport, then panels | `[manual]` |
| 1.3.4 Orientation | Portrait and landscape both work; no orientation lock | `[manual]` |
| 1.3.5 Identify input purpose | No field asks for personal data; the instrument name is `autocomplete="off"` | `[manual]` |
| 1.4.1 Use of colour | Note, edge warning, layer state: colour plus text plus shape | `[manual]` |
| 1.4.3 Contrast, minimum | See the table in section 1; thinnest pair 4.57:1 | computed, above |
| 1.4.4 Resize text | Everything in `rem`; 200 % zoom without loss (no fixed-height text boxes) | `[manual]` at 200 % |
| 1.4.10 Reflow | One column below 900 px; the stage keeps a 4:3 box; no horizontal scroll at 320 px | `[manual]` |
| 1.4.11 Non-text contrast | Focus ring 15.92:1; control outlines and the strings (tint on night) 13.18:1; the volume gauge is drawn as a bone outline (16.35:1) around a tint fill, so nothing depends on a faint fill against the night | computed, above |
| 1.4.12 Text spacing | No clipping with line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em | `[manual]` |
| 1.4.13 Content on hover | The latency details panel is dismissible (Escape), hoverable, persistent | `[manual]` |

### Operable

| Criterion | What we do | Evidence |
|---|---|---|
| 2.1.1 Keyboard | Every control, every screen, including calibration start/retry, loop transport, instrument editor | `[auto]` tab-order audit + `[manual]` |
| 2.1.2 No keyboard trap | The editor and the latency panel close with Escape and return focus to their trigger | `[manual]` |
| 2.2.2 Pause, stop, hide | The loop and the ghost take can be stopped; no auto-updating text longer than 5 s without a pause (live regions are polite and throttled) | `[manual]` |
| 2.3.1 Three flashes | Nothing flashes: the stage has no strobe, no flash on note, strings change state instead of blinking; ceiling is three changes per second, and none reaches the general-flash threshold | design rule, `[manual]` |
| 2.4.1 Bypass blocks | "Skip to the controls" is the first focusable element | `[auto]` |
| 2.4.3 Focus order | Reading order; drawers trap nothing | `[manual]` |
| 2.4.7 Focus visible | 2 px ring in `#B8F5E4`, offset 2 px, never removed; visible on the dark stage and on panels | `[auto]` axe `focus-visible`-adjacent checks + `[manual]` |
| 2.4.11 Focus not obscured | Ring offset keeps it clear of sticky bars | `[manual]` |
| 2.5.1 Pointer gestures | Nothing requires a multi-point or path gesture: the pointer mode uses single-pointer moves | `[manual]` |
| 2.5.4 Motion actuation | Hand movement is the *content*, not an accessibility path; the pointer mode is the alternative and needs no device motion | `[manual]`, P2 |
| 2.5.7 Dragging movements | Zones are moved with arrow keys, not only by dragging | `[manual]` |
| 2.5.8 Target size | 24 × 24 CSS px minimum for every control; 44 × 44 for the transport | `[auto]` size audit |

### Understandable

| Criterion | What we do | Evidence |
|---|---|---|
| 3.1.1 Language of page | `lang` follows the catalogue in use (`en`, `fr`) | `[auto]` |
| 3.1.2 Language of parts | Product name "Thin Air" is not wrapped as foreign text, it is a name | `[manual]` |
| 3.2.1 On focus | Focus never opens a drawer or starts the camera | `[manual]` |
| 3.2.2 On input | No control changes context on change alone; the camera starts only on a press of Start | `[manual]`, AIR-F-01 |
| 3.2.6 Consistent help | "Judge in three minutes" sits in the same place on every screen | `[manual]` |
| 3.3.1 Error identification | A refused instrument file names the reason (schema path), and says nothing was changed | `[auto]` + state `instrumentRefused` |
| 3.3.2 Labels or instructions | Every control has a visible label; hints are tied with `aria-describedby` | `[auto]` axe `label` |
| 3.3.7 Redundant entry | The calibration result is reused; nothing is asked twice | `[manual]` |

### Robust

| Criterion | What we do | Evidence |
|---|---|---|
| 4.1.2 Name, role, value | Native elements first; custom controls expose role and state (`aria-pressed`, `aria-valuenow`) | `[auto]` axe `aria-*` rules |
| 4.1.3 Status messages | Camera, model, hands, loop and export states are announced in a polite live region, without stealing focus | `[auto]` + `[manual]` |

## 3. The game itself: what accessibility means for a gestural instrument

WCAG covers the page; some of it also has to cover *playing*.

| Need | What the product offers | Where |
|---|---|---|
| Playable with one hand | One-hand mode on every essential instrument; the other hand's parameter moves to the hand's opening | AIR-F-10, P3 |
| Reduced reach, seated player | Calibration fits the whole instrument into the reach you actually have, 5th to 95th percentile, plus 5 % | §7.4, AIR-F-09, P3 |
| Hand tremor | Smoothing strength is adjustable, and triggering reads a barely-filtered channel so that damping does not eat attacks | §7.5, §12.4 |
| No need to hold a pose | Hold mode: 400 ms in a zone locks the note until the next pass | AIR-F-12 |
| Left-handed players | A setting swaps the two hands' roles | AIR-F-11 |
| No camera, or no wish to use one | Pointer and keyboard drive the same engine, P2 | AIR-F-02 |
| Motion sensitivity | The system "reduce motion" setting is obeyed: no trail behind the hands, no string vibration, no easing on the level bar — only state changes | §12.4, `prefers-reduced-motion` |
| Reading the pitch | The current note is text as well as tint | §12.4, `a11y.currentNoteLive` |
| Photosensitivity | No flash, no strobe; light is a state change, never a pulse | §12.3, 2.3.1 |

The reduced-motion behaviour is the one place where the artistic direction is
deliberately reduced: the ghost trail is the point of the scene, and it is the
first thing to disappear for anyone who asks for less motion. Strings do not
vibrate; the zone lights up; the level bar jumps instead of gliding.

## 4. The limit this edition assumes

**Playing with no visual feedback at all is not handled in this edition.**
A blind player cannot use the stage: the pitch is chosen by where the hand is
in a rectangle, and there is no audio or haptic substitute for that position —
no spoken pitch as you move, no sonification of the play area, no guided
calibration by ear. The current note *is* announced as text and as a polite live
region, so a screen reader user can tell what is sounding, but they cannot aim.
Covering that would need a different interaction model (discrete zones stepped
by keys, spatial audio, spoken coordinates), which is out of scope for this
edition and is written here rather than left implied (AIR-N-06).

Two smaller limits, stated for the same reason: the canvas is not operable by
keyboard as a *canvas* (only the controls around it are, which is why they
carry every function); and Windows High Contrast / forced-colours mode is not
tested in this edition, so it is not claimed.

## 5. How it is proven

Nothing here counts as proven by a good intention. Four pieces of evidence:

1. **Automated pass, no error.** The audit belongs in the browser E2E job
   (`.github/workflows/build.yml`, job `e2e`, outside PRs, delivered by this
   lot) and must report zero violations at level AA for the welcome screen, the
   stage in pointer mode, and each drawer. Today that job only probes for a
   test browser and stays silent when none is present: this lot adds no
   dependency to the repository, so the audit itself is **not wired yet** —
   it is a recipe item (§18) for lot B4, not something this file claims to run.
   When it is wired, the job stays non-blocking by design (not a required
   check), so its result is read in the run log and copied into the logbook: a
   violation there is a bug, not a warning to ignore.
2. **P2 automated** (recipe §18, `§8` P2). One test drives the product with no
   camera at all: pointer as one hand, keyboard as the other, and asserts that
   a note is produced, that the current-note text updates, and that the same
   engine reports the same notes as the camera path on the same take.
3. **Keyboard-only walkthrough** (manual, written into the recipe): from load to
   a sounding note, and through all eight screens, using Tab, arrows, Enter,
   Space and Escape only — including calibration and a refused instrument file.
4. **Palette audit**: the ratios of section 1 are recomputed from the
   stylesheet constants, so a later colour change that breaks 4.5:1 is caught
   as a number, not an opinion.

Status of each, as of this lot: the palette numbers are computed above; the
reference take and the pointer path exist only once lots B4 (web) and B3 (bench)
have landed, so items 1 and 2 are `TODO(mesure)` until the E2E job has run once
on `main` — the workflow that carries them is delivered here. Item 3 is a manual
walkthrough of the recipe (§18), to be written into the logbook with the date.
Item 4 is recomputed from the stylesheet constants once those constants exist,
which is lot B4's perimeter: until then, section 1 of this file is the reference.

Reproduce the palette numbers (Node 22, no dependency, no network):

```bash
cat > /tmp/contrast.mjs <<'EOF'
const lin = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const L = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return ((x + 0.05) / (y + 0.05)).toFixed(2) + ":1";
};
const night = "#0B0D14", surface = "#161A24", bone = "#F2EBDC", dim = "#8A8272";
const tint = "#7CE8CB", deep = "#123F38", amber = "#F2C46A", brick = "#FFB3A0", focus = "#B8F5E4";
const pairs = [[bone, night], [bone, surface], [dim, night], [dim, surface], [tint, night],
  [tint, surface], [night, tint], [night, bone], [tint, deep], [dim, deep], [bone, deep],
  [amber, night], [brick, night], [focus, night]];
for (const [fg, bg] of pairs) console.log(`${fg} on ${bg} — ${cr(fg, bg)}`);
EOF
node /tmp/contrast.mjs
```
