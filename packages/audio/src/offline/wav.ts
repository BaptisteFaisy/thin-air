/**
 * Écriture WAV 16 bits mono — l'export de la boucle (AIR-F-38).
 *
 * En-tête RIFF canonique de 44 octets : `RIFF`, taille, `WAVE`, le bloc `fmt `
 * (PCM, un canal) puis le bloc `data`. Aller-retour vérifié dans les tests :
 * le codage quantifie à 1/32768, rien d'autre ne change.
 */

/** Taille de l'en-tête RIFF sans les données. */
const EN_TETE = 44;
const PCM = 1;
const CANAUX = 1;
const BITS = 16;

function ecrireTexte(vue: DataView, offset: number, texte: string): void {
  for (let i = 0; i < texte.length; i++) vue.setUint8(offset + i, texte.charCodeAt(i));
}

export function encodeWav(samples: Float32Array | readonly number[], sampleRate: number): Uint8Array {
  const echantillons = samples instanceof Float32Array ? samples : Float32Array.from(samples);
  const octets = new Uint8Array(EN_TETE + echantillons.length * 2);
  const vue = new DataView(octets.buffer);
  ecrireTexte(vue, 0, "RIFF");
  vue.setUint32(4, octets.length - 8, true);
  ecrireTexte(vue, 8, "WAVE");
  ecrireTexte(vue, 12, "fmt ");
  vue.setUint32(16, 16, true);
  vue.setUint16(20, PCM, true);
  vue.setUint16(22, CANAUX, true);
  vue.setUint32(24, Math.round(sampleRate), true);
  vue.setUint32(28, Math.round(sampleRate) * CANAUX * (BITS / 8), true);
  vue.setUint16(32, CANAUX * (BITS / 8), true);
  vue.setUint16(34, BITS, true);
  ecrireTexte(vue, 36, "data");
  vue.setUint32(40, echantillons.length * 2, true);
  for (let i = 0; i < echantillons.length; i++) {
    const borne = Math.max(-1, Math.min(1, echantillons[i] ?? 0));
    // Pleine échelle asymétrique : −1,0 → −32768, +1,0 → +32767.
    vue.setInt16(EN_TETE + i * 2, Math.round(borne < 0 ? borne * 32768 : borne * 32767), true);
  }
  return octets;
}

export function decodeWav(bytes: Uint8Array): { readonly samples: Float32Array; readonly sampleRate: number } {
  const vue = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lireTexte = (offset: number, longueur: number): string => {
    let texte = "";
    for (let i = 0; i < longueur; i++) texte += String.fromCharCode(vue.getUint8(offset + i));
    return texte;
  };
  if (lireTexte(0, 4) !== "RIFF" || lireTexte(8, 4) !== "WAVE") {
    throw new Error("decodeWav : fichier non reconnu (RIFF/WAVE attendu)");
  }
  // Les blocs se suivent ; `fmt ` et `data` ne sont pas toujours au même endroit.
  let offset = 12;
  let sampleRate = 0;
  let bits = BITS;
  let donneesOffset = -1;
  let donneesTaille = 0;
  while (offset + 8 <= vue.byteLength) {
    const nom = lireTexte(offset, 4);
    const taille = vue.getUint32(offset + 4, true);
    if (nom === "fmt ") {
      sampleRate = vue.getUint32(offset + 12, true);
      bits = vue.getUint16(offset + 22, true);
    } else if (nom === "data") {
      donneesOffset = offset + 8;
      donneesTaille = taille;
    }
    offset += 8 + taille + (taille % 2);
  }
  if (donneesOffset < 0 || bits !== BITS) {
    throw new Error("decodeWav : bloc data 16 bits attendu");
  }
  return { samples: lireEchantillons(vue, donneesOffset, donneesTaille), sampleRate };
}

function lireEchantillons(vue: DataView, offset: number, taille: number): Float32Array {
  const nombre = Math.floor(Math.min(taille, vue.byteLength - offset) / 2);
  const echantillons = new Float32Array(nombre);
  for (let i = 0; i < nombre; i++) {
    const brut = vue.getInt16(offset + i * 2, true);
    echantillons[i] = brut < 0 ? brut / 32768 : brut / 32767;
  }
  return echantillons;
}
