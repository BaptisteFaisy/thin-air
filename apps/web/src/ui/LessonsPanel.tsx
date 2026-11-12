/**
 * Les trois leçons, visibles (cahier §12.1 « Physique », parcours P5).
 *
 * Règle du projet : ce qui est affiché est CALCULÉ, jamais illustré au jugé.
 * Le panneau appelle la logique pure de `apps/web/src/lessons/` et rend à la
 * fois le tracé et les nombres en texte — un dessin seul ne serait pas lisible
 * par un lecteur d'écran (AIR-N-06). Aucune animation continue : le réglage
 * « moins de mouvement » n'a alors rien à désactiver.
 *
 * Deux modes, et la différence est dite à l'écran :
 * - « direct » lit les mesures RÉELLES de la séance en cours (temps d'analyse,
 *   intervalle entre deux images, note réellement jouée) ; chaque valeur porte
 *   « mesuré », la caméra reste « estimée » (§5.1) ;
 * - « exemple » montre la prise de synthèse à graine fixe, toujours étiquetée
 *   « exemple » — jamais « mesuré ».
 *
 * Sans séance, aucun nombre n'est inventé : le panneau dit qu'il n'y a pas de
 * données en direct et propose l'exemple. Les libellés viennent de
 * `i18n/lessons.en.ts` / `lessons.fr.ts`, passés en prop.
 */
import type { JSX } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, SAMPLE_RATE, SCALES } from "@thin-air/core";
import { buildFilterLesson } from "../lessons/filterLesson.js";
import { buildCentsLesson, sweepCents, tremblementEnCents } from "../lessons/centsLesson.js";
import { enEchantillons } from "../lessons/horlogesLesson.js";
import { lireAnalyse, suivreAnalyse, type AnalysisView } from "../hooks/analysisStore.js";
import { lireNote, suivreNote, type NoteJouee } from "../hooks/noteStore.js";
import { formaterNombre, type LessonMessages } from "../i18n/lessons.en.js";

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
  /** Les libellés du panneau, dans la langue de la page. */
  readonly messages: LessonMessages;
  /** Mode de départ : « direct » (défaut) ou « exemple ». */
  readonly mode?: "direct" | "exemple";
  /** Aimant affiché dans la leçon « viser juste » (0 à 1). */
  readonly magnet?: number;
  /** Amplitude du tremblement de la leçon « filtre », en fraction de largeur. */
  readonly amplitude?: number;
}

export function LessonsPanel({
  messages: m,
  mode = "direct",
  magnet = 1,
  amplitude = 0.01,
}: LessonsPanelProps): JSX.Element {
  const [exemple, setExemple] = useState(mode === "exemple");
  // Les mesures RÉELLES de la séance : rien n'est inventé, et si aucune image
  // n'a été analysée le panneau le dit au lieu d'afficher des nombres.
  const analyse = useSyncExternalStore(suivreAnalyse, lireAnalyse, lireAnalyse);
  const note = useSyncExternalStore(suivreNote, lireNote, lireNote);
  const mesure = analyse.snapshot.count > 0;
  return (
    <section className="lecons" aria-labelledby="lecons-titre">
      <h2 id="lecons-titre">{m.title}</h2>
      {exemple ? (
        <Exemple m={m} magnet={magnet} amplitude={amplitude} onDirect={() => setExemple(false)} />
      ) : (
        <Direct m={m} analyse={analyse} note={note} mesure={mesure} onExemple={() => setExemple(true)} />
      )}
    </section>
  );
}

/** Le mode direct : les nombres de la séance, ou le message « rien encore ». */
function Direct({
  m,
  analyse,
  note,
  mesure,
  onExemple,
}: {
  readonly m: LessonMessages;
  readonly analyse: AnalysisView;
  readonly note: NoteJouee | null;
  readonly mesure: boolean;
  readonly onExemple: () => void;
}): JSX.Element {
  if (!mesure) {
    return (
      <>
        <p role="status">{m.live.noData}</p>
        <p>
          <button type="button" onClick={onExemple}>
            {m.live.showExample}
          </button>
        </p>
      </>
    );
  }
  const s = analyse.snapshot;
  return (
    <>
      <article aria-labelledby="lecon-filtre">
        <h3 id="lecon-filtre">
          {m.filter.title} <span className="badge-live">{m.live.modeLive}</span>
        </h3>
        <p>{m.live.tremorPending}</p>
      </article>
      <article aria-labelledby="lecon-cents">
        <h3 id="lecon-cents">
          {m.cents.title} <span className="badge-live">{m.live.modeLive}</span>
        </h3>
        <dl>
          <dt>{m.live.playedNote}</dt>
          <dd>{noteJouee(m, note)}</dd>
        </dl>
        <p>{m.live.aimPending}</p>
      </article>
      <article aria-labelledby="lecon-horloges">
        <h3 id="lecon-horloges">
          {m.horloges.title} <span className="badge-live">{m.live.modeLive}</span>
        </h3>
        <dl>
          <dt>{m.live.analysisMean(formaterNombre(s.window, 0, m.lang))}</dt>
          <dd>{mesuree(m, s.meanInferenceMs)}</dd>
          <dt>{m.live.analysisMax}</dt>
          <dd>{mesuree(m, s.maxInferenceMs)}</dd>
          <dt>{m.live.frameInterval}</dt>
          <dd>{mesuree(m, s.meanFrameIntervalMs)}</dd>
          <dt>{m.live.framesPerSecond}</dt>
          <dd>
            {formaterNombre(1000 / Math.max(1, s.meanFrameIntervalMs), 1, m.lang)} — {m.live.measured}
          </dd>
          <dt>{m.live.thread}</dt>
          <dd>{analyse.thread ?? m.live.threadNone}</dd>
          <dt>{m.live.camera}</dt>
          <dd>
            {formaterNombre(DEFAULT_SETTINGS.cameraLatencyMs, 0, m.lang)} {m.ms} — {m.live.estimated}
          </dd>
          <dt>{m.live.framesAnalysed}</dt>
          <dd>{formaterNombre(s.count, 0, m.lang)}</dd>
        </dl>
        <p>{m.horloges.seam}</p>
      </article>
    </>
  );
}

/** Une durée mesurée sur cette machine : le nombre et sa mention d'origine. */
function mesuree(m: LessonMessages, ms: number): string {
  return `${formaterNombre(ms, 1, m.lang)} ${m.ms} — ${m.live.measured}`;
}

/** La note jouée, en toutes lettres ; jamais de fréquence inventée. */
function noteJouee(m: LessonMessages, note: NoteJouee | null): string {
  if (note === null) return m.live.noNote;
  if (note.frequencyHz === null) return note.note;
  return `${note.note} · ${formaterNombre(note.frequencyHz, 2, m.lang)} Hz`;
}

/** Le mode exemple : la prise de synthèse, étiquetée « exemple ». */
function Exemple({
  m,
  magnet,
  amplitude,
  onDirect,
}: {
  readonly m: LessonMessages;
  readonly magnet: number;
  readonly amplitude: number;
  readonly onDirect: () => void;
}): JSX.Element {
  const filtre = useMemo(() => buildFilterLesson(amplitude, { seed: 7, durationS: 2 }), [amplitude]);
  const cents = useMemo(() => buildCentsLesson(0.33, GAMME, ETENDUE, magnet), [magnet]);
  const balayage = useMemo(() => sweepCents(GAMME, ETENDUE, magnet, 0.05), [magnet]);
  const echantillonsParImage = enEchantillons(1 / FPS);
  return (
    <>
      <p>
        <button type="button" onClick={onDirect}>
          {m.live.showLive}
        </button>
      </p>
      <article aria-labelledby="lecon-filtre">
        <h3 id="lecon-filtre">
          {m.filter.title} <span className="badge-example">{m.live.modeDemo}</span>
        </h3>
        <Tracé
          légende={m.filter.legend}
          series={[
            { nom: m.filter.brut, points: filtre.brut, couleur: "#8a8f98" },
            { nom: m.filter.declencheur, points: filtre.vif, couleur: "#c9a227" },
            { nom: m.filter.lisse, points: filtre.lisse, couleur: "#e8e4d9" },
          ]}
        />
        <dl>
          <dt>{m.filter.ecartTypeBrut}</dt>
          <dd>{filtre.ecartTypeBrut.toFixed(5)}</dd>
          <dt>{m.filter.ecartTypeVif}</dt>
          <dd>{filtre.ecartTypeVif.toFixed(5)}</dd>
          <dt>{m.filter.ecartTypeLisse}</dt>
          <dd>{filtre.ecartTypeLisse.toFixed(5)}</dd>
          <dt>{m.filter.alphaArret}</dt>
          <dd>{filtre.alphaArret.toFixed(2)}</dd>
          <dt>{m.filter.alphaRapide}</dt>
          <dd>{filtre.alphaRapide.toFixed(2)}</dd>
        </dl>
      </article>
      <article aria-labelledby="lecon-cents">
        <h3 id="lecon-cents">
          {m.cents.title} <span className="badge-example">{m.live.modeDemo}</span>
        </h3>
        <Tracé
          légende={m.cents.legend}
          series={[{
            nom: m.centsUnit,
            points: balayage.map((p) => ({ t: p.u, u: Math.abs(p.cents) / 150 })),
            couleur: "#c9a227",
          }]}
        />
        <dl>
          <dt>{m.cents.visee}</dt>
          <dd>{cents.visee.toFixed(2)}</dd>
          <dt>{m.cents.jouee}</dt>
          <dd>{cents.nom} · {formaterNombre(cents.frequenceJouee, 2, m.lang)} Hz</dd>
          <dt>{m.cents.gamme}</dt>
          <dd>{m.cents.ecart(`${formaterNombre(Math.abs(cents.ecartCents), 1, m.lang)} ${m.centsUnit}`)}</dd>
          <dt>{m.cents.aimant}</dt>
          <dd>{magnet.toFixed(2)}</dd>
        </dl>
        <p>
          {m.cents.tremblement(`${formaterNombre(tremblementEnCents(0.005, 36), 0, m.lang)} ${m.centsUnit}`)}
        </p>
      </article>
      <article aria-labelledby="lecon-horloges">
        <h3 id="lecon-horloges">
          {m.horloges.title} <span className="badge-example">{m.live.modeDemo}</span>
        </h3>
        <p>
          {m.horloges.imagesParSeconde(formaterNombre(FPS, 0, m.lang))} ·{" "}
          {m.horloges.parImage(formaterNombre(1000 / FPS, 1, m.lang))}
        </p>
        <p>{m.horloges.echantillonsParSeconde(formaterNombre(SAMPLE_RATE, 0, m.lang))}</p>
        <p>{m.horloges.echantillonsParImage(formaterNombre(echantillonsParImage, 0, m.lang))}</p>
        <p>{m.horloges.avance(formaterNombre(DEFAULT_SETTINGS.lookaheadMs, 0, m.lang))}</p>
        <p>{m.horloges.rampe(formaterNombre(DEFAULT_SETTINGS.paramTauMs, 0, m.lang))}</p>
        <p>{m.horloges.camera(formaterNombre(DEFAULT_SETTINGS.cameraLatencyMs, 0, m.lang))}</p>
        <p>{m.horloges.seam}</p>
      </article>
    </>
  );
}
