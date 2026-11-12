# Instruments

Un instrument est un fichier, validé par schéma (AIR-F-43). Le format est
`thin-air-instrument/1` ; l'exemple de référence est en annexe B du cahier, et
le contrat TypeScript est `packages/core/src/types.ts`.

Seize instruments : les six du cahier §7.8, puis les dix du luthier (§14.4),
chacun né d'une phrase de description. Les rapports de rendu réels des dix
sont recopiés dans `docs/luthier.md`.

| Fichier | Instrument | Origine | Phrase d'origine (anglais) | Moteur |
|---|---|---|---|---|
| `phantom.json` | Phantom (thérémine) | cahier §7.8 | One hand picks the pitch from 110 to 880 Hz with a magnet of 0.6, the other sets the level; a pinch adds vibrato, a fist cuts the sound. | `osc` |
| `harp.json` | Harp (cordes pincées) | cahier §7.8 | Sixteen vertical strings over three octaves: the index tip crossing a string plucks it, the speed gives the force, a pinch damps. | `pluck` |
| `choir.json` | Choir (nappes) | cahier §7.8 | Eight zones: a hand resting in a zone holds a note, the opening of the hand sets the brightness, a 400 ms dwell locks the note. | `osc` |
| `bells.json` | Bells (cloches) | cahier §7.8 | Zones struck by a downward crossing; frequency modulation, long resonance. | `fm` |
| `drone.json` | Drone (bourdon) | cahier §7.8 | The height of one hand picks one of four low notes, held by two detuned oscillators. | `osc` |
| `grid-drums.json` | Grid drums (percussions) | cahier §7.8 | Four zones; the hits are placed back on the loop grid, the only way percussion survives the estimated delay. | `drum` |
| `glass.json` | Glass (verre chantant) | luthier | A pure sine voice glides across two octaves with no magnet at all, one hand for the pitch, the other's height for the level. | `osc` |
| `flute.json` | Flute (flûte) | luthier | A soft triangle flute snaps hard to a natural minor scale over one octave, and a fist on the volume hand cuts the breath. | `osc` |
| `ghost.json` | Ghost (fantôme) | luthier | A ghost theremin leans only a third of the way toward the scale, bending between the notes, vibrato under a pinching hand. | `osc` |
| `organ.json` | Organ (orgue creux) | luthier | A hollow square-wave organ walks one octave with a magnet of seven tenths, and a closing fist silences the pipe. | `osc` |
| `koto.json` | Koto (cordes pincées) | luthier | Nine koto strings lie across the width, plucked bright by a crossing index and damped at once by a pinch. | `pluck` |
| `dulcimer.json` | Dulcimer (cordes frappées) | luthier | Twelve dulcimer strings ring long and woody at a fixed strength under a crossing palm, and a fist kills the ring. | `pluck` |
| `gong.json` | Gong (tam-tam) | luthier | Four gongs hang in four vertical bands: crossing one strikes a metallic FM crash that rings for six seconds. | `fm` |
| `chimes.json` | Chimes (carillons) | luthier | Five chimes hang in five horizontal bands, each holding one fixed pitch as long as a hand rests in it. | `fm` |
| `pad.json` | Pad (nappe tenue) | luthier | Three wide bands hold slow detuned sawtooth chords under the resting hand, and a dwell locks the chord in place. | `osc` |
| `tabla.json` | Tabla (percussions calées) | luthier | Two grid-locked hand drums span the width: a crossing fires a short noise-and-tone hit snapped to the sixteenth grid. | `drum` |

Chaque fichier est validé en CI et rendu sur les prises de référence
(`render-check`, cahier §14.3) : la preuve est un rapport de mesures, jamais une
écoute. Le banc `instruments/luthier.test.ts` épingle la liste des seize, le
passage du schéma strict et un rendu sans exception — sonnant pour les dix du
luthier — sur la prise recopiée dans `docs/luthier.md`.
