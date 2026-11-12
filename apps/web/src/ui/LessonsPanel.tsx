/**
 * Les trois leçons, visibles (cahier §12.1 « Physique », parcours P5).
 *
 * Règle du projet : ce qui est affiché est CALCULÉ, jamais illustré au jugé.
 * Le panneau appelle la logique pure de `apps/web/src/lessons/` et rend à la
 * fois le tracé et les nombres en texte — un dessin seul ne serait pas lisible
 * par un lecteur d'écran (AIR-N-06). Aucune animation continue : le réglage
 * « moins de mouvement » n'a alors rien à désactiver.
 *
 * Libellés en anglais, en dur pour le moment : le raccordement à `i18n/`
 * (fichiers `lessons.en.ts` / `lessons.fr.ts`, déjà écrits) est décrit dans
 * `docs/ui-lecons.md`.
 */
import type { JSX } from "react";
import { useMemo } from "react";
import { DEFAULT_SETTINGS, SAMPLE_RATE } from "@thin-air/core";
import { buildFilterLesson } from "../lessons/filterLesson.js";
import { buildCentsLesson, sweepCents, tremblementEnCents } from "../lessons/centsLesson.js";
import { enEchantillons } from "../lessons/horlogesLesson.js";
import { SCALES } from "@thin-air/core";

const GAMME = { root: 50, steps: SCALES.harmonicMinor };
const ETENDUE = { low: 45, high: 81 };
const FPS = 30;

/** Un tracé SVG : une polyligne par série, aucune animation. */
function Tracé({ series, légende }: {
  readonly series: readonly { readonly nom: string; readonly points: readonly { readonly t: number; readonly u: number }[]; readonly couleur: string }[];
  readonly légende: string;
}): JSX.Element {
  const duree = Math.max(...series.map((s) => s.points[s.points.length - 1]?.t ?? 1), 0.001);
  return (
    <figure>
      <svg viewBox="0 0 320 90" width="320" height="90" role="img" aria-label={légende}>
        {series.map((serie) => (
          <polyline
            key={serie.nom}
            fill="none"
            stroke={serie.couleur}
            strokeWidth="1.5"
            points={serie.points
              .map((p) => `${((p.t / duree) * 318).toFixed(1)},${(88 - p.u * 86).toFixed(1)}`)
              .join(" ")}
          />
        ))}
      </svg>
      <figcaption>{légende}</figcaption>
    </figure>
  );
}

export interface LessonsPanelProps {
  /** Aimant affiché dans la leçon « viser juste » (0 à 1). */
  readonly magnet?: number;
  /** Amplitude du tremblement de la leçon « filtre », en fraction de largeur. */
  readonly amplitude?: number;
}

export function LessonsPanel({ magnet = 1, amplitude = 0.01 }: LessonsPanelProps): JSX.Element {
  const filtre = useMemo(() => buildFilterLesson(amplitude, { seed: 7, durationS: 2 }), [amplitude]);
  const cents = useMemo(() => buildCentsLesson(0.33, GAMME, ETENDUE, magnet), [magnet]);
  const balayage = useMemo(() => sweepCents(GAMME, ETENDUE, magnet, 0.05), [magnet]);
  const echantillonsParImage = enEchantillons(1 / FPS);
  const avance = enEchantillons(DEFAULT_SETTINGS.lookaheadMs / 1000);

  return (
    <section className="lecons" aria-labelledby="lecons-titre">
      <h2 id="lecons-titre">What the numbers say</h2>

      <article aria-labelledby="lecon-filtre">
        <h3 id="lecon-filtre">1. Filtering a trembling hand</h3>
        <Tracé
          légende="Hand position: raw, fast channel, smooth channel"
          series={[
            { nom: "raw", points: filtre.brut, couleur: "#8a8f98" },
            { nom: "fast", points: filtre.vif, couleur: "#c9a227" },
            { nom: "smooth", points: filtre.lisse, couleur: "#e8e4d9" },
          ]}
        />
        <dl>
          <dt>Tremor, raw</dt><dd>{filtre.ecartTypeBrut.toFixed(5)}</dd>
          <dt>Tremor, fast channel</dt><dd>{filtre.ecartTypeVif.toFixed(5)}</dd>
          <dt>Tremor, smooth channel</dt><dd>{filtre.ecartTypeLisse.toFixed(5)}</dd>
          <dt>α at rest (1.5 Hz, 30 fps)</dt><dd>{filtre.alphaArret.toFixed(2)}</dd>
          <dt>α at one width per second (6.5 Hz)</dt><dd>{filtre.alphaRapide.toFixed(2)}</dd>
        </dl>
      </article>

      <article aria-labelledby="lecon-cents">
        <h3 id="lecon-cents">2. Aiming in tune</h3>
        <Tracé
          légende="Distance to the nearest scale note, in cents, across the play area"
          series={[{
            nom: "cents",
            points: balayage.map((p) => ({ t: p.u, u: Math.abs(p.cents) / 150 })),
            couleur: "#c9a227",
          }]}
        />
        <dl>
          <dt>Note aimed at (u = 0.33)</dt><dd>{cents.visee.toFixed(2)}</dd>
          <dt>Note played</dt><dd>{cents.nom} · {cents.frequenceJouee.toFixed(2)} Hz</dd>
          <dt>Distance to the scale note</dt><dd>{Math.abs(cents.ecartCents).toFixed(1)} cents</dd>
          <dt>Magnet</dt><dd>{magnet.toFixed(2)}</dd>
          <dt>A 0.5 % tremor over 36 semitones</dt><dd>{tremblementEnCents(0.005, 36).toFixed(0)} cents</dd>
        </dl>
      </article>

      <article aria-labelledby="lecon-horloges">
        <h3 id="lecon-horloges">3. Stitching two clocks together</h3>
        <dl>
          <dt>Camera</dt><dd>{FPS} frames per second — one every {(1000 / FPS).toFixed(1)} ms</dd>
          <dt>Sound</dt><dd>{SAMPLE_RATE.toLocaleString("en-US")} samples per second</dd>
          <dt>Samples between two frames</dt><dd>{Math.round(echantillonsParImage).toLocaleString("en-US")}</dd>
          <dt>Programming lead (§7.9, rule 2)</dt>
          <dd>{DEFAULT_SETTINGS.lookaheadMs} ms — {Math.round(avance)} samples</dd>
          <dt>Parameter ramp</dt><dd>{DEFAULT_SETTINGS.paramTauMs} ms — never a step (§7.9, rule 1)</dd>
        </dl>
        <p>
          Every event carries a timestamp on the sound clock, not on the frame clock:
          that seam is where this kind of instrument usually crackles, drags, or
          leaves a note stuck.
        </p>
      </article>
    </section>
  );
}
