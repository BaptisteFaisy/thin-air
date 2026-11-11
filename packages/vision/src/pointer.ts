/**
 * Jouer sans caméra (AIR-F-02, parcours P2) : le pointeur fait une main
 * virtuelle, le clavier joue les notes. Le moteur en aval est exactement le
 * même — c'est ce qui rend ce mode crédible et testable.
 */
import type { HandSource } from "./source.js";
import { todo } from "@thin-air/core/internal";

export interface PointerOptions {
  /** Deuxième main virtuelle au clavier (main de volume). */
  readonly keyboardVolume?: boolean;
  readonly fps?: number;
}

export function createPointerSource(element: HTMLElement, options?: PointerOptions): HandSource {
  void element; void options;
  return todo("vision.createPointerSource", "A5");
}

export function createKeyboardSource(options?: PointerOptions): HandSource {
  void options;
  return todo("vision.createKeyboardSource", "A5");
}
