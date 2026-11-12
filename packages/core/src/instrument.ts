/**
 * De l'instrument-fichier aux événements musicaux (cahier §7.8, §11.4).
 * Propriétés : AIR-P-03, 05, 08, 09, 10, 12.
 *
 * Un instrument est un fichier : `controls` (mesure → cible), `gestures`
 * (geste → action), `oneHand` (le même instrument joué d'une main), une gamme,
 * une étendue ou des cordes ou des zones, un aimant, des voix, un son. Ce
 * module lit ce fichier et rien d'autre : aucun réglage n'est écrit ici, tout
 * vient de `Settings` ou du fichier. Les formules de musique vivent dans
 * `notes.ts`, le bornage des voix dans `voices.ts`, le tri dans `schedule.ts`.
 *
 * ─── LES QUATRE DÉLAIS QUI SE CROISENT : LA DÉCISION (§14.1) ───────────────
 * Quatre délais coexistent et se contredisent si on les écrit séparément :
 * la grâce de 150 ms (AIR-F-15), le relâchement à 300 ms sans image (AIR-F-16),
 * le maintien à 400 ms dans une zone (AIR-F-12) et le réarmement de 80 ms
 * (AIR-F-17). La contradiction est connue du cahier : que devient une note
 * quand la main disparaît PENDANT un maintien ?
 *
 * DÉCISION, appliquée par ce fichier et fixée par un test :
 *   1. le maintien ne survit pas à la main — une note verrouillée appartient
 *      à la main qui l'a verrouillée ;
 *   2. quand cette main n'est plus vue, la note est tenue pendant le délai de
 *      grâce (`graceMs`, 150 ms — c'est `Features.present`, tenu par le
 *      filtrage du §7.5), puis relâchée à la première image où la main est
 *      déclarée absente ;
 *   3. si les images elles-mêmes s'arrêtent, c'est le relâchement sans image
 *      (`stallReleaseMs`, 300 ms) qui tranche : toutes les voix tombent,
 *      maintien compris — 300 ms > 150 ms, la règle la plus large gagne ;
 *   4. la fin de prise ajoute la grâce puis relâche tout : aucune voix ne
 *      reste active (AIR-P-09).
 * Autrement dit : la grâce gagne toujours sur le maintien, et le maintien ne
 * gagne jamais contre une main absente. Le réarmement de 80 ms ne joue que
 * sur les traversées de corde : il ne décide d'aucune fin de note.
 * Toutes les valeurs viennent de `Settings` : `graceMs`, `stallReleaseMs`,
 * `dwellMs`, `stringRearmMs`. Aucune n'est écrite en dur ici.
 */
import type {
  FeatureMap,
  GestureEvent,
  GestureMap,
  HandRole,
  Instrument,
  InstrumentRange,
  MusicEvent,
  Settings,
  TrackedHand,
  InstrumentZone,
} from "./types.js";
import { VoicePool } from "./voices.js";
import { sortEvents } from "./schedule.js";
import { clamp01 } from "./space.js";
import {
  NoteMagnet,
  controlValue,
  featureValue,
  noteFromDegree,
  pitchFromPosition,
  scaleInto,
} from "./notes.js";

/** La voix de l'instrument continu (thérémine, bourdon). */
const LEAD = "lead";

export interface InstrumentOptions {
  readonly oneHand?: boolean;
  readonly hold?: boolean;
  readonly leftHanded?: boolean;
  /** Aimant forcé (0..1) ; sinon celui du fichier d'instrument. */
  readonly magnet?: number | null;
}

/**
 * Un instrument en train de jouer : il reçoit des mains suivies et des gestes,
 * et rend les événements de l'image. Sans état partagé entre instruments :
 * deux instances ne peuvent pas se parler (AIR-P-12).
 *
 * `frame` ignore l'instant porté par les gestes : ce sont les gestes de
 * l'image, et c'est `tSeconds` (horloge du son, déjà estampillée par le
 * `Scheduler`) qui date tout ce qui sort d'ici (§7.9, règle 2).
 */
export class InstrumentPlayer {
  private pool: VoicePool;
  private magnet: NoteMagnet;
  private readonly pending = new Map<string, number>();
  private readonly controls = new Map<string, number>();
  private muted = false;
  /** La note de zone tenue, éventuellement verrouillée par un maintien. */
  private zoneVoice: { id: string; index: number; locked: boolean; owner: HandRole } | null = null;
  private lastFrameT: number | null = null;
  /** Dernier instant émis : le temps ne remonte jamais (AIR-P-11). */
  private dernierT = 0;
  private lastLead: number | null = null;
  private lastGain = 1;
  private peak = 0;

  constructor(
    public instrument: Instrument,
    public settings: Settings,
    public options?: InstrumentOptions,
  ) {
    this.pool = new VoicePool(Math.min(settings.maxVoices, instrument.voices));
    this.magnet = this.aimant();
  }

  /** L'aimant du lecteur : la force vient des réglages, sinon du fichier (§7.7). */
  private aimant(): NoteMagnet {
    const forced = this.options?.magnet ?? this.settings.magnet ?? this.instrument.snap;
    const { root, steps } = this.instrument.scale;
    return new NoteMagnet(root, steps, this.settings.noteHysteresis, clamp01(forced), this.instrument.range);
  }

  /**
   * Applique un nouvel instrument, de nouveaux réglages ou de nouvelles options
   * sans couper la séance (§7.8). Quand l'instrument change, les voix en cours
   * s'éteignent en fondu — un `noteOff` par voix, avant les notes nouvelles
   * (AIR-F-24) — et la nouvelle gamme sert dès la note suivante.
   */
  reconfigurer(tSeconds: number, instrument: Instrument, settings: Settings, options?: InstrumentOptions): readonly MusicEvent[] {
    const t = this.instant(tSeconds);
    const out: MusicEvent[] = [];
    const cap = Math.min(settings.maxVoices, instrument.voices);
    const changementInstrument = instrument.name !== this.instrument.name || instrument.sound !== this.instrument.sound;
    if (changementInstrument || cap !== this.pool.maxVoices) {
      // L'instrument change : les voix en cours s'éteignent en fondu, et la
      // nouvelle géométrie (cordes, zones, étendue) sert dès l'image suivante.
      this.silence(t, out);
      this.pool = new VoicePool(cap);
    }
    this.instrument = instrument;
    this.settings = settings;
    this.options = options;
    const neuf = this.aimant();
    const vieux = this.magnet;
    if (neuf.root !== vieux.root || neuf.steps !== vieux.steps || neuf.hysteresis !== vieux.hysteresis
      || neuf.amount !== vieux.amount || neuf.range !== vieux.range) this.magnet = neuf;
    return this.ordonner(out);
  }

  frame(tSeconds: number, hands: readonly TrackedHand[], gestures: readonly GestureEvent[]): readonly MusicEvent[] {
    const t = this.instant(tSeconds);
    const out: MusicEvent[] = [];
    if (this.stalledAt(t)) this.silence(t, out);
    this.flushPending(t, out);
    for (const gesture of gestures) this.applyGesture(t, gesture, out);
    this.checkHold(t, hands, out);
    this.updateLead(t, hands, out);
    this.lastFrameT = t;
    this.peak = Math.max(this.peak, this.pool.activeCount);
    return this.ordonner(out);
  }

  /**
   * Plus d'image : toutes les voix se relâchent (AIR-F-15, AIR-F-16).
   * Le maintien n'y survit pas non plus (voir la décision des quatre délais).
   */
  stall(tSeconds: number): readonly MusicEvent[] {
    const t = this.instant(tSeconds);
    const out: MusicEvent[] = [];
    this.silence(t, out);
    this.lastFrameT = t;
    this.magnet.reset();
    return this.ordonner(out);
  }

  /**
   * Fin de prise : la grâce puis le relâchement, aucune voix active à la fin.
   * Les `noteOff` tombent à `t + graceMs` : le son s'éteint, il ne se coupe pas.
   */
  end(tSeconds: number): readonly MusicEvent[] {
    const t = this.instant(tSeconds);
    const at = t + Math.max(0, this.settings.graceMs) / 1000;
    const out: MusicEvent[] = [];
    this.silence(at, out);
    this.magnet.reset();
    return this.ordonner(out);
  }

  /** Note visée par la main de hauteur, pour l'écran et le mode physique. */
  currentMidi(): number | null {
    return this.lastLead;
  }

  /** Voix actives à cet instant (AIR-P-10) ; l'écran et le rapport s'en servent. */
  get activeVoiceCount(): number {
    return this.pool.activeCount;
  }

  /** Le plus grand nombre de voix actives vues par ce lecteur (rapport de rendu). */
  get peakVoices(): number {
    return this.peak;
  }

  // ─── état ────────────────────────────────────────────────────────────────

  /**
   * Tri ET monotonie : `sortEvents` classe les événements d'une image, mais un
   * calcul de rampe peut retomber à un ulp près sous l'instant précédent. Or
   * AIR-P-11 exige que les instants ne décroissent jamais — un événement daté
   * avant le précédent serait rejeté par l'horloge du son (§7.9, règle 2). Les
   * instants sont donc ramenés au dernier émis.
   */
  private ordonner(out: MusicEvent[]): readonly MusicEvent[] {
    const sortis: MusicEvent[] = [];
    for (const e of sortEvents(out)) {
      if (e.t < this.dernierT) sortis.push({ ...e, t: this.dernierT } as MusicEvent);
      else {
        this.dernierT = e.t;
        sortis.push(e);
      }
    }
    return sortis;
  }

  private instant(tSeconds: number): number {
    if (Number.isFinite(tSeconds)) return tSeconds;
    return this.lastFrameT ?? 0;
  }

  private stalledAt(t: number): boolean {
    if (this.lastFrameT === null) return false;
    return (t - this.lastFrameT) * 1000 >= this.settings.stallReleaseMs;
  }

  private silence(t: number, out: MusicEvent[]): void {
    out.push(...this.pool.releaseAll(t));
    this.pending.clear();
    this.controls.clear();
    this.lastLead = null;
    this.zoneVoice = null;
  }

  /**
   * Relâchements différés (corde pincée, zone frappée) arrivés à échéance.
   * Le `noteOff` porte son échéance exacte, pas l'instant de l'image : elle est
   * forcément postérieure à l'image précédente, sinon il serait déjà parti, et
   * la liste reste donc monotone (AIR-P-11).
   */
  private flushPending(t: number, out: MusicEvent[]): void {
    for (const [id, at] of [...this.pending]) {
      if (at > t) continue;
      this.pending.delete(id);
      out.push(...this.pool.noteOff(at, id));
    }
  }

  // ─── gestes ──────────────────────────────────────────────────────────────

  private applyGesture(t: number, gesture: GestureEvent, out: MusicEvent[]): void {
    // La sortie de main n'est pas une action du fichier : c'est la règle du
    // §7.6 (« Sortie de main : relâche ses notes ») et elle vaut pour tous les
    // instruments, maintien compris (voir la décision des quatre délais).
    if (gesture.gesture === "handLost" && gesture.phase === "start") {
      this.silence(t, out);
      return;
    }
    for (const map of this.gestureMaps(gesture)) this.doAction(t, map, gesture, out);
  }

  private gestureMaps(gesture: GestureEvent): readonly GestureMap[] {
    const maps = this.instrument.gestures ?? [];
    return maps.filter(
      (map) => map.gesture === gesture.gesture && (map.hand === "any" || map.hand === gesture.hand),
    );
  }

  private doAction(t: number, map: GestureMap, gesture: GestureEvent, out: MusicEvent[]): void {
    const start = gesture.phase === "start";
    switch (map.do) {
      case "mute":
        if (start) {
          this.muted = true;
          this.silence(t, out);
        } else {
          this.muted = false;
        }
        return;
      case "hold":
        // `enter` et `dwell` arrivent en phase « start », mais `leave` arrive en
        // phase « end » (c'est la fin d'un état, §7.6) : sans cette seconde
        // condition, quitter une zone n'éteignait jamais la note — une note
        // coincée, le défaut classique du genre (AIR-P-09).
        if (start || gesture.gesture === "leave") this.holdZone(t, gesture, out);
        return;
      case "damp":
        if (start) this.damp(t, out);
        return;
      case "pluck":
      case "strike":
        if (start) this.oneShot(t, map, gesture, out);
        return;
      default:
        return;
    }
  }

  /** Pincer étouffe : les notes pincées cessent de résonner. */
  private damp(t: number, out: MusicEvent[]): void {
    for (const id of [...this.pending.keys()]) {
      this.pending.delete(id);
      out.push(...this.pool.noteOff(t, id));
    }
  }

  /** Une corde pincée ou une zone frappée : note brève, relâchée après résonance. */
  private oneShot(t: number, map: GestureMap, gesture: GestureEvent, out: MusicEvent[]): void {
    const index = gesture.index ?? 0;
    const zone = map.do === "strike" ? this.zoneAt(index) : undefined;
    const id = zone ? `zone-${zone.id}` : `string-${index}`;
    const midi = zone ? this.zoneMidi(zone, index) : this.stringMidi(index);
    out.push(...this.pool.noteOn(t, id, midi, this.shotVelocity(map, gesture)));
    this.pending.set(id, t + this.ringSeconds());
  }

  /** La corde `i` sonne le degré `i` de la gamme (§7.8, harpe). */
  private stringMidi(index: number): number {
    const { root, steps } = this.instrument.scale;
    return noteFromDegree(root, steps, index);
  }

  /** « vitesse / 3, bornée entre 0,1 et 1 » (§7.6). */
  private shotVelocity(map: GestureMap, gesture: GestureEvent): number {
    if (map.velocity === "fixed") return clamp01(map.value ?? 1);
    return Math.min(1, Math.max(0.1, Math.abs(gesture.value) / 3));
  }

  private ringSeconds(): number {
    return Math.max(0, this.instrument.sound.releaseMs ?? 400) / 1000;
  }

  // ─── zones tenues et maintien (AIR-F-12) ─────────────────────────────────

  /**
   * `enter` tient la note de la zone tant que la main y est ; `dwell` la
   * verrouille jusqu'au prochain passage — et seulement si le mode maintien
   * est actif ; `leave` libère la note, sauf si elle est verrouillée.
   */
  private holdZone(t: number, gesture: GestureEvent, out: MusicEvent[]): void {
    const index = gesture.index ?? 0;
    const zone = this.zoneAt(index);
    if (!zone) return;
    switch (gesture.gesture) {
      case "enter":
        this.takeZone(t, zone, index, gesture.hand, out);
        return;
      case "dwell":
        if (this.holdMode() && this.zoneVoice?.index === index) this.zoneVoice.locked = true;
        return;
      case "leave":
        if (this.zoneVoice && !this.zoneVoice.locked) this.dropZone(t, out);
        return;
      default:
        return;
    }
  }

  private takeZone(
    t: number,
    zone: InstrumentZone,
    index: number,
    owner: HandRole,
    out: MusicEvent[],
  ): void {
    if (this.zoneVoice?.index === index) return;
    if (this.zoneVoice) this.dropZone(t, out);
    const id = `zone-${zone.id}`;
    out.push(...this.pool.noteOn(t, id, this.zoneMidi(zone, index), 1));
    this.zoneVoice = { id, index, locked: false, owner };
  }

  private dropZone(t: number, out: MusicEvent[]): void {
    const current = this.zoneVoice;
    if (!current) return;
    this.zoneVoice = null;
    out.push(...this.pool.noteOff(t, current.id));
  }

  private zoneAt(index: number): InstrumentZone | undefined {
    return (this.instrument.zones?.zones ?? [])[index];
  }

  private zoneMidi(zone: InstrumentZone, index: number): number {
    const { root, steps } = this.instrument.scale;
    return zone.midi ?? noteFromDegree(root, steps, zone.degree ?? index);
  }

  /**
   * Le maintien ne survit pas à la main : dès que la main qui a verrouillé
   * n'est plus vue (`present` est faux une fois la grâce écoulée), la note
   * tombe. C'est la décision des quatre délais, fixée par un test.
   */
  private checkHold(t: number, hands: readonly TrackedHand[], out: MusicEvent[]): void {
    const owner = this.zoneVoice?.owner;
    if (!owner) return;
    const hand = hands.find((candidate) => candidate.role === owner);
    if (hand && hand.present) return;
    this.dropZone(t, out);
  }

  // ─── instrument continu : hauteur, volume, contrôles ─────────────────────

  private updateLead(t: number, hands: readonly TrackedHand[], out: MusicEvent[]): void {
    const range = this.instrument.range;
    if (!range) return;
    const maps = this.controlMaps();
    const pitchMap = maps.find((map) => map.to === "pitch");
    const hand = this.handFor(pitchMap?.hand, hands);
    const gain = this.leadGain(maps, hands);
    if (this.muted || !hand || !hand.present || gain <= 0) {
      this.releaseLead(t, out);
      return;
    }
    this.playLead(t, this.leadMidi(pitchMap, hand, range), gain, out);
    for (const map of maps) this.emitControl(t, map, hands, out);
  }

  /** Sans main de volume, on tient le dernier niveau : jamais de saut à 0 dB. */
  private leadGain(maps: readonly FeatureMap[], hands: readonly TrackedHand[]): number {
    const gainMap = maps.find((map) => map.to === "gain");
    if (!gainMap) return 1;
    const hand = this.handFor(gainMap.hand, hands);
    if (!hand || !hand.present) return this.lastGain;
    return controlValue(gainMap, hand);
  }

  private leadMidi(pitchMap: FeatureMap | undefined, hand: TrackedHand, range: InstrumentRange): number {
    if (!pitchMap) return this.magnet.next(pitchFromPosition(hand.smooth.u, range));
    const x = scaleInto(featureValue(hand, pitchMap.feature), pitchMap);
    const midi = pitchMap.into ? x : pitchFromPosition(x, range);
    return this.magnet.next(midi);
  }

  private playLead(t: number, midi: number, gain: number, out: MusicEvent[]): void {
    const voice = this.pool.find(LEAD);
    if (!voice) {
      out.push(...this.pool.noteOn(t, LEAD, midi, gain));
      this.controls.clear();
    } else if (Math.abs(voice.midi - midi) > 1e-9) {
      this.pool.setMidi(LEAD, midi);
      out.push({ type: "control", t, voice: LEAD, param: "pitch", value: midi });
    }
    this.lastLead = midi;
    this.lastGain = gain;
    this.pushGain(t, gain, out);
  }

  private pushGain(t: number, gain: number, out: MusicEvent[]): void {
    const previous = this.controls.get("gain");
    if (previous !== undefined && Math.abs(previous - gain) <= 1e-6) return;
    this.controls.set("gain", gain);
    out.push({ type: "control", t, voice: LEAD, param: "gain", value: gain });
  }

  /** Vibrato, brillance, coupure : une cible par entrée du fichier. */
  private emitControl(t: number, map: FeatureMap, hands: readonly TrackedHand[], out: MusicEvent[]): void {
    if (map.to === "pitch" || map.to === "gain") return;
    const hand = this.handFor(map.hand, hands);
    if (!hand || !hand.present) return;
    const value = controlValue(map, hand);
    const previous = this.controls.get(map.to);
    if (previous !== undefined && Math.abs(previous - value) <= 1e-9) return;
    this.controls.set(map.to, value);
    out.push({ type: "control", t, voice: LEAD, param: map.to, value });
  }

  private releaseLead(t: number, out: MusicEvent[]): void {
    out.push(...this.pool.noteOff(t, LEAD));
    this.lastLead = null;
    this.controls.clear();
  }

  // ─── lecture du fichier ──────────────────────────────────────────────────

  /** À une main, c'est le bloc `oneHand` du fichier qui joue (§7.8, AIR-F-10). */
  private controlMaps(): readonly FeatureMap[] {
    const one = this.oneHandMode() ? this.instrument.oneHand : undefined;
    if (one && one.length > 0) return one;
    return this.instrument.controls ?? [];
  }

  /** La main d'un rôle ; à une main, la seule main présente fait l'affaire. */
  private handFor(role: HandRole | undefined, hands: readonly TrackedHand[]): TrackedHand | undefined {
    const wanted = role ?? "pitch";
    const exact = hands.find((hand) => hand.role === wanted && hand.present);
    if (exact) return exact;
    if (!this.oneHandMode()) return undefined;
    return hands.find((hand) => hand.present);
  }

  private oneHandMode(): boolean {
    return this.options?.oneHand ?? this.settings.oneHand;
  }

  private holdMode(): boolean {
    return this.options?.hold ?? this.settings.hold;
  }
}
