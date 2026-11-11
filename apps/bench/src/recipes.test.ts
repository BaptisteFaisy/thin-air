/**
 * La recette du cahier §18, ligne par ligne.
 *
 * Ces tests décrivent ce que le banc devra prouver, avec les valeurs du cahier
 * recopiées ici pour qu'elles ne se perdent pas. Ils sont en `it.todo` tant
 * que l'implémentation d'un autre lot manque : la ligne dit toujours de quel
 * lot elle dépend. Aucun n'écoute : tout se lit dans un fichier ou un nombre.
 *
 * Pour les activer, il suffit de remplacer `it.todo` par `it` et de lire la
 * prise de référence ; le corps attendu est écrit en commentaire.
 */
import { describe, it } from "vitest";

describe("recette §18 — événements d'une prise", () => {
  it.todo(
    "thérémine : bench events donne sol, la, si bémol, do dièse, ré, mi, fa, sol " +
      "— dépend du lot B2 (pipeline.processTake) et du lot A4 (parseTake, parseInstrument)",
  );
  // Prise takes/reference/slow-rise.json + instruments/phantom.json (aimant 1,
  // ré mineur harmonique, 110 → 880 Hz), main de hauteur de u 0,30 à 0,60 en 3 s.
  // Notes attendues, dans cet ordre (annexe B : sol = midi 55) :
  //   temps 0,000 s → midi 55 (sol,  196,00 Hz)
  //   temps 0,139 s → midi 57 (la,   220,00 Hz)
  //   temps 0,514 s → midi 58 (si♭, 233,08 Hz)
  //   temps 1,153 s → midi 61 (do♯, 277,18 Hz)
  //   temps 1,625 s → midi 62 (ré,  293,66 Hz)
  //   temps 2,083 s → midi 64 (mi,  329,63 Hz)
  //   temps 2,458 s → midi 65 (fa,  349,23 Hz)
  //   temps 2,917 s → midi 67 (sol,  392,00 Hz)
  // Tolerance sur les instants : une image, soit 33 ms (cahier §7.14 : ces
  // instants sont ceux du signal brut ; le filtre ajoute ~80 ms de traîne, donc
  // la comparaison se fait par rapport à l'implémentation de référence).
  // Vérifiable dès que le pipeline répond : compareReports avec
  // { noteTimeMs: 33 } sur les instants, et égalité stricte sur les midi.

  it.todo(
    "thérémine : bench render donne chaque palier à 5 centièmes de demi-ton près, " +
      "une crête sous −1 dB, 144 000 échantillons à 48 kHz " +
      "— dépend du lot A5 (renderEvents, measureNotes, buildReport) et du lot B2",
  );
  // Rendu attendu : 144 000 échantillons à 48 000 Hz (3 s), crête ≤ −1 dB,
  // chaque palier à 5 centièmes près (0,57 Hz pour le sol à 196 Hz), et
  // silence 800 ms après la sortie des mains (AIR-P-15, tolérance ±100 ms).

  it.todo(
    "harpe : quatre notes (la 220, do 261,63, ré 293,66, fa 349,23) espacées de 125 ms, " +
      "force 0,17 — dépend du lot B1 (gestures.crossedString, pluckVelocity) et du lot B2",
  );
  // Prise takes/reference/harp-sweep.json + instruments/harp.json (16 cordes,
  // corde i à u = (i + 0,5) / 16), index de u 0,20 à 0,45 en 0,5 s :
  //   corde 3, u 0,219, t 0,038 s → la 220,00 Hz
  //   corde 4, u 0,281, t 0,163 s → do 261,63 Hz
  //   corde 5, u 0,344, t 0,288 s → ré 293,66 Hz
  //   corde 6, u 0,406, t 0,413 s → fa 349,23 Hz
  // Force 0,17 (vitesse 0,5 / 3, bornée entre 0,1 et 1). Tolérance sur les
  // instants : 33 ms. Tolérance sur la force : 0,01.
});

describe("recette §18 — propriétés d'une prise", () => {
  it.todo(
    "hand-leaves-mid-note : aucune voix active à la fin du rapport " +
      "— dépend du lot B2 (pipeline.finish) et du lot A5 (buildReport)",
  );
  // Prise takes/reference/hand-leaves-mid-note.json + instruments/phantom.json.
  // Le rapport doit finir avec maxVoices = 0 voix encore tenues ; autrement dit
  // aucun noteOn sans noteOff à la fin de la liste d'événements (AIR-P-09).

  it.todo(
    "tremor-at-boundary : au plus un changement de note " +
      "— dépend du lot B1 (tremorTake) et du lot A3 (hysteresis de quantizeToScale)",
  );
  // Prise takes/reference/tremor-at-boundary.json : tremblement de 0,004 en u
  // autour de u 0,314 (le seuil sol → la), soit ~0,14 demi-ton, sous les 15 %
  // de la marge. Attendu : notes.length ≤ 2, donc un seul changement (AIR-P-06).

  it.todo(
    "left-hand-only : côté « gauche » " +
      "— dépend du lot B1 (leftHandOnlyTake) et du lot B2 (rôles)",
  );
  // Prise takes/reference/left-hand-only.json : une seule main, side = "left".
  // Attendu : les événements portent le rôle de hauteur, et le journal des
  // rôles ne contient aucune main droite (§7.3, convention de côté).

  it.todo(
    "deux mains croisées : les rôles ne s'échangent pas " +
      "— dépend du lot B2 (roles) et de la prise takes/reference/two-hands-cross.json",
  );
  // Les rôles restent stables pendant tout le croisement (AIR-P-21) : les
  // événements de hauteur ne changent jamais de main.
});

describe("recette §18 — la boucle", () => {
  it.todo(
    "quatre mesures à 90 battements par minute : exactement 512 000 échantillons à 48 kHz, " +
      "soit 10,67 s — dépend du lot A6 (loop) et du lot A5 (samplesForDuration)",
  );
  // 4 mesures × 4 temps × 60 / 90 = 10,6667 s ; 10,6667 × 48 000 = 512 000.
  // Le rendu d'une boucle fait exactement la durée de ses mesures, pas arrondi
  // (AIR-P-17) : samples === 512000, et non 511 999 ou 512 001.
});

describe("recette §18 — le banc lui-même", () => {
  it.todo(
    "les prises de référence pèsent l'ordre de grandeur annoncé (~26 Ko/s en JSON brut) " +
      "— dépend du lot B1 (takeGen : makeHand pose les 21 points)",
  );
  // Cahier §7.11 : 2 mains × 21 points × 3 coordonnées = 126 nombres par image,
  // ~26 Ko/s en JSON brut, 7,6 Ko/s en entiers de 16 bits. Une prise de 3 s
  // (slow-rise) doit donc peser quelques dizaines de Ko ; weighTake compare au
  // poids annoncé et signale l'écart au-delà d'un facteur 2.

  it.todo(
    "bench compare refuse un rapport hors tolérance et rend 1 " +
      "— dépend du lot A5 (buildReport) pour un rapport réel ; les tolérances sont déjà testées",
  );
  // Ce qui est déjà prouvé sans dépendance : compare.test.ts (23 tests) et
  // cli.test.ts (22 tests) sur des rapports fabriqués à la main.
});
