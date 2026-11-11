/** Écriture WAV 16 bits mono — l'export de la boucle (AIR-F-38). */
import { todo } from "@thin-air/core/internal";

export function encodeWav(samples: Float32Array | readonly number[], sampleRate: number): Uint8Array {
  void samples; void sampleRate;
  return todo("audio.encodeWav", "A4");
}

export function decodeWav(bytes: Uint8Array): { readonly samples: Float32Array; readonly sampleRate: number } {
  void bytes;
  return todo("audio.decodeWav", "A4");
}
