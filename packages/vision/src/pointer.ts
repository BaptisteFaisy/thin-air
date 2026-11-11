/**
 * Jouer sans caméra (AIR-F-02, parcours P2) : le pointeur fait une main
 * virtuelle, le clavier joue les notes et peut servir de main de volume.
 *
 * Les deux sources rendent des `VisionFrame` au MÊME format que la caméra : le
 * moteur en aval est exactement le même, et il n'y a ici aucune logique
 * musicale — seulement des positions et des mains (§11.1).
 *
 * Tout ce qui touche le navigateur passe par `VirtualEnvironment`, injectable :
 * les tests pilotent les deux sources sans DOM.
 */
import type { DetectedHand } from "@thin-air/core";
import {
  FrameHub,
  defaultNow,
  emptyFrame,
  frameAt,
  type FrameListener,
  type HandSource,
} from "./source.js";
import {
  NOTE_KEYS,
  POSITION_DEFAUT,
  applyKey,
  normalisePointer,
  screenToImage,
  virtualHand,
  type KeyboardPosition,
} from "./virtual-hand.js";

export interface PointerOptions {
  /** Deuxième main virtuelle au clavier (main de volume). */
  readonly keyboardVolume?: boolean;
  readonly fps?: number;
  /** Côté annoncé de la main virtuelle (défaut : droite). */
  readonly side?: "left" | "right";
  /** Taille de la main virtuelle, en fraction de la hauteur de l'image. */
  readonly scale?: number;
  /** Pas de déplacement au clavier, en fraction de l'écran. */
  readonly step?: number;
  /** Rangée de touches qui pose la main sur une colonne. */
  readonly noteKeys?: readonly string[];
  /** Horloge et événements injectables (tests, ou page qui pilote). */
  readonly environment?: Partial<VirtualEnvironment>;
}

export type Detach = () => void;

export interface PointerSample {
  readonly u: number;
  readonly v: number;
  readonly down: boolean;
}

export interface KeySample {
  readonly code: string;
  readonly down: boolean;
}

export interface VirtualEnvironment {
  readonly now: () => number;
  readonly tick: (fn: () => void, periodMs: number) => Detach;
  readonly onPointer: (target: unknown, handler: (sample: PointerSample) => void) => Detach;
  readonly onKey: (target: unknown, handler: (sample: KeySample) => void) => Detach;
  /** Ce qui porte les touches : la fenêtre, dans le navigateur. */
  readonly keyTarget?: unknown;
}

const CADENCE_DEFAUT = 30;
/** Pas minimal entre deux images : `t` ne redescend jamais. */
const PAS_MIN_S = 1e-4;

function cadenceUtile(fps: number | undefined): number {
  if (fps === undefined || !Number.isFinite(fps) || fps <= 0) return CADENCE_DEFAUT;
  return fps;
}

/** Événements de pointeur sur un élément : position d'écran + bouton. */
function pointerDuNavigateur(target: unknown, handler: (sample: PointerSample) => void): Detach {
  const element = target as HTMLElement | null;
  if (element === null || typeof element.addEventListener !== "function") return () => undefined;
  const lit = (event: PointerEvent, down: boolean) => {
    const cadre = element.getBoundingClientRect();
    const { u, v } = normalisePointer(event.clientX, event.clientY, cadre);
    handler({ u, v, down });
  };
  const deplace = (event: PointerEvent) => lit(event, event.buttons > 0);
  const appuie = (event: PointerEvent) => lit(event, true);
  const relache = (event: PointerEvent) => lit(event, false);
  element.addEventListener("pointermove", deplace);
  element.addEventListener("pointerdown", appuie);
  element.addEventListener("pointerup", relache);
  element.addEventListener("pointercancel", relache);
  return () => {
    element.removeEventListener("pointermove", deplace);
    element.removeEventListener("pointerdown", appuie);
    element.removeEventListener("pointerup", relache);
    element.removeEventListener("pointercancel", relache);
  };
}

/** Touches tenues : ce qui intéresse la source, c'est le code et l'état. */
function touchesDuNavigateur(target: unknown, handler: (sample: KeySample) => void): Detach {
  const fenetre = target as EventTarget | null;
  if (fenetre === null || typeof fenetre.addEventListener !== "function") return () => undefined;
  const bas = (event: Event) => handler({ code: (event as KeyboardEvent).code, down: true });
  const haut = (event: Event) => handler({ code: (event as KeyboardEvent).code, down: false });
  fenetre.addEventListener("keydown", bas);
  fenetre.addEventListener("keyup", haut);
  return () => {
    fenetre.removeEventListener("keydown", bas);
    fenetre.removeEventListener("keyup", haut);
  };
}

export function defaultVirtualEnvironment(): VirtualEnvironment {
  return {
    now: defaultNow,
    tick: (fn, periodMs) => {
      const id = setInterval(fn, periodMs);
      return () => clearInterval(id);
    },
    onPointer: pointerDuNavigateur,
    onKey: touchesDuNavigateur,
    keyTarget: globalThis,
  };
}

/**
 * Cadence d'émission : un battement régulier entretient la main (comme une
 * caméra qui tourne), les changements nets sont émis tout de suite.
 */
function createPulse(env: VirtualEnvironment, fps: number, emit: (force: boolean) => void) {
  let derniereEmission = Number.NaN;
  const periodeMs = 1000 / fps;
  const minMs = periodeMs / 2;
  let detach: Detach | null = null;

  function emettre(force: boolean): void {
    const maintenant = env.now();
    if (!force && !Number.isNaN(derniereEmission) && maintenant - derniereEmission < minMs) return;
    derniereEmission = maintenant;
    emit(force);
  }

  return {
    demarrer() {
      detach ??= env.tick(() => emettre(true), periodeMs);
    },
    arreter() {
      detach?.();
      detach = null;
    },
    /** Changement net d'état : appui, relâchement, touche. */
    changement() {
      emettre(true);
    },
    /** Mouvement : émis seulement si la cadence le permet. */
    mouvement() {
      emettre(false);
    },
  };
}

/** Une main virtuelle à partir d'une position d'écran. */
function mainVirtuelle(
  position: KeyboardPosition,
  options: PointerOptions,
  pose: "open" | "pinch" = "open",
): DetectedHand {
  const [x, y] = screenToImage(position.u, position.v);
  return virtualHand(x, y, { side: options.side ?? "right", scale: options.scale, pose });
}

/**
 * Socle commun des deux sources sans caméra : horloge, battement, diffusion,
 * démarrage et arrêt. Une seule implémentation pour les deux (zéro
 * duplication) ; chaque source ne fournit que ses mains et son écoute.
 */
abstract class VirtualSource implements HandSource {
  abstract readonly kind: "pointer" | "keyboard";
  protected readonly options: PointerOptions;
  protected readonly env: VirtualEnvironment;
  protected readonly hub = new FrameHub();
  protected readonly pulse: ReturnType<typeof createPulse>;
  protected position: KeyboardPosition = { ...POSITION_DEFAUT };
  protected enMarche = false;
  #detach: Detach | null = null;
  #dernierT = 0;

  constructor(options: PointerOptions) {
    this.options = options;
    this.env = { ...defaultVirtualEnvironment(), ...(options.environment ?? {}) };
    this.pulse = createPulse(this.env, cadenceUtile(options.fps), () => this.emettre());
  }

  protected instant(): number {
    const brut = this.env.now() / 1000;
    this.#dernierT = brut > this.#dernierT ? brut : this.#dernierT + PAS_MIN_S;
    return this.#dernierT;
  }

  /** Les mains de l'image courante. */
  protected abstract mains(): readonly DetectedHand[];
  /** Abonne la source à son périphérique ; rend la fonction qui désabonne. */
  protected abstract attacher(): Detach;
  /** Remet l'état d'entrée à zéro à l'arrêt. */
  protected abstract reinitialiser(): void;

  protected emettre(): void {
    this.hub.emit(frameAt(this.instant(), this.mains(), 0));
  }

  async start(): Promise<void> {
    if (this.enMarche) return;
    this.enMarche = true;
    this.#detach = this.attacher();
    this.pulse.demarrer();
    this.emettre();
  }

  stop(): void {
    this.#detach?.();
    this.#detach = null;
    this.pulse.arreter();
    if (!this.enMarche) return;
    this.enMarche = false;
    this.reinitialiser();
    this.hub.emit(emptyFrame(this.instant()));
  }

  onFrame(listener: FrameListener): () => void {
    return this.hub.onFrame(listener);
  }
}

/**
 * Le pointeur (souris ou doigt) fait UNE main virtuelle : le curseur est le
 * bout de l'index, un appui la fait pincer. Aucune caméra, aucun modèle.
 */
class PointerRunner extends VirtualSource {
  readonly kind = "pointer" as const;
  readonly #element: HTMLElement;
  #appuye = false;

  constructor(element: HTMLElement, options: PointerOptions) {
    super(options);
    this.#element = element;
  }

  protected mains(): readonly DetectedHand[] {
    return [mainVirtuelle(this.position, this.options, this.#appuye ? "pinch" : "open")];
  }

  protected attacher(): Detach {
    return this.env.onPointer(this.#element, (sample) => this.#surPointeur(sample));
  }

  protected reinitialiser(): void {
    this.#appuye = false;
  }

  #surPointeur(sample: PointerSample): void {
    this.position = { u: sample.u, v: sample.v };
    if (sample.down === this.#appuye) {
      this.pulse.mouvement();
      return;
    }
    this.#appuye = sample.down;
    this.pulse.changement();
  }
}

/**
 * Le clavier joue : la rangée de notes pose la main sur une colonne (le moteur
 * en aval en fait une note), les flèches la déplacent. Avec `keyboardVolume`,
 * la colonne reste au centre : c'est une main de volume, seule la hauteur
 * bouge (§7.7 — le rôle, lui, est décidé par `core`).
 */
class KeyboardRunner extends VirtualSource {
  readonly kind = "keyboard" as const;
  readonly #tenues = new Set<string>();

  protected mains(): readonly DetectedHand[] {
    return this.#tenues.size === 0 ? [] : [mainVirtuelle(this.position, this.options)];
  }

  protected attacher(): Detach {
    return this.env.onKey(this.env.keyTarget ?? globalThis, (sample) => this.#surTouche(sample));
  }

  protected reinitialiser(): void {
    this.#tenues.clear();
  }

  #pertinente(code: string): boolean {
    return code.startsWith("Arrow") || (this.options.noteKeys ?? NOTE_KEYS).includes(code);
  }

  #deplacer(code: string): void {
    const suivant = applyKey(this.position, code, this.options.step ?? 0.05, this.options.noteKeys ?? NOTE_KEYS);
    const volume = this.options.keyboardVolume ?? false;
    this.position = volume ? { u: POSITION_DEFAUT.u, v: suivant.v } : suivant;
  }

  #surTouche(sample: KeySample): void {
    if (!this.#pertinente(sample.code)) return;
    if (sample.down) {
      this.#tenues.add(sample.code);
      this.#deplacer(sample.code);
    } else {
      this.#tenues.delete(sample.code);
    }
    this.pulse.changement();
  }
}

/** Le pointeur comme source de mains. */
export function createPointerSource(element: HTMLElement, options: PointerOptions = {}): HandSource {
  return new PointerRunner(element, options);
}

/** Le clavier comme source de mains. */
export function createKeyboardSource(options: PointerOptions = {}): HandSource {
  return new KeyboardRunner(options);
}
