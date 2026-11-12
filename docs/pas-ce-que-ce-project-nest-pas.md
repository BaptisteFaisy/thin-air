# Ce que ce projet n'est pas

> Date de validation : 2026-11-12.

Cette page est écrite en français, comme le cahier des charges et le contrat de
construction. Elle dit ce que ce projet **n'est pas**, ce qui **n'a pas été
testé**, ce qui **n'a pas été mesuré**, et ce qui demande **un humain**. Chaque
ligne dit comment la vérifier : la commande à lancer, ou le fichier à lire.

## Ce qui n'est pas

- **Un jeu de rythme précis.** Une note est une hauteur, pas une réussite rythmique : le projet ne mesure ni ne note le tempo des gestes. Le seul tempo du projet est celui de la boucle (90 par défaut), et il sert à caler les couches entre elles.
  Vérifier : `npm run bench -- events --take takes/reference/slow-rise.json --instrument instruments/phantom.json` sort des événements datés (`noteOn`, `noteOff`, `control`) ; `apps/bench/src/report.ts` ne mesure que des hauteurs, des niveaux et un silence de fin, jamais un écart de rythme.
- **Un plugin de DAW.** MIDI n'est ici qu'un fichier qu'on exporte et relit : le projet ne pilote aucun séquenceur, n'ouvre aucun port MIDI et n'envoie rien à un logiciel de musique.
  Vérifier : `packages/core/src/midi.ts` écrit et relit un fichier MIDI sans parler à aucun périphérique ; `grep -rn "requestMIDIAccess" apps/web/src packages` ne trouve qu'une détection de présence dans `apps/web/src/hooks/useSession.ts`, jamais un appel.
- **Un outil qui analyse le son entrant.** Aucun son de la personne qui joue n'est capté : la caméra s'ouvre sans audio, et le son entendu est synthétisé dans l'onglet.
  Vérifier : `packages/vision/src/capture.ts` écrit `audio: false` en dur dans les contraintes de la caméra ; `grep -rn "AnalyserNode\|createMediaStreamSource" apps/web/src packages` ne trouve rien.
- **Un modèle de vision maison.** La détection des mains vient de MediaPipe (modèle et runtime publiés par le site lui-même), pas d'un modèle entraîné dans ce dépôt.
  Vérifier : `packages/vision/src/landmarker.ts` charge `@mediapipe/tasks-vision` ; `NOTICE.md` donne la situation des licences (runtime Apache 2.0, licence du fichier de modèle non établie à ce jour).
- **Un produit qui collecte des données.** Aucune image, aucune prise et aucun relevé d'audience ne quitte le navigateur : il n'y a ni compte, ni serveur, ni mesure.
  Vérifier : `scripts/check-dist.mjs` refuse un site construit qui contient une origine tierce ; `scripts/hooks/take-privacy-guard.mjs` refuse toute prise contenant autre chose que des points ; `grep -rn "fetch(\|XMLHttpRequest" apps/web/src` ne renvoie rien.

## Ce qui n'est pas testé

- **La détection sur une vraie main.** Tout ce qui est validé l'a été sur des trajectoires calculées, avec une caméra simulée ; la procédure pour une vraie main est écrite, mais elle n'a pas été suivie.
  Vérifier : `docs/prises-reelles.md` donne les cinq étapes ; `takes/reference/` ne contient que des prises engendrées (`apps/bench/src/make-reference-takes.ts`), et `takes/real/`, où vivent les prises réelles, n'est pas versionné (`.gitignore`).
- **Le repli sur processeur.** La chaîne sait basculer du GPU vers le processeur, mais elle ne l'a fait que sur une fausse détecteur injectée : aucune machine sans accélération graphique n'a servi de preuve.
  Vérifier : `packages/vision/src/landmarker-core.ts` fait la bascule, `packages/vision/src/landmarker.test.ts` la prouve sur une usine simulée qui échoue sur « GPU » ; `docs/latency.md` ne relève qu'une seule machine.
- **La latence de la caméra.** Elle reste estimée : le navigateur ne dit pas combien de temps l'image a mis à arriver.
  Vérifier : `docs/latency.md` range la caméra en « estimé » (30 à 70 ms) ; `packages/core/src/defaults.ts` fixe `cameraLatencyMs: 50` par défaut, et `apps/web/src/state/latency.ts` marque ce segment `estimated`.

## Ce qui n'est pas mesuré

- **Le délai jusqu'à la première note sur une vraie connexion.** Les chiffres disponibles viennent d'un serveur local à débit bridé et ne couvrent que le téléchargement du modèle : le temps entre le premier clic et la première note, sur une vraie connexion, n'a pas été mesuré.
  Vérifier : `docs/latency.md` (mesure sous connexion bridée, 10 / 4 / 1,5 Mbit/s, latence non émulée) et `scripts/preuves/chargement.mjs`, rejouable.

## Ce qui demande un humain

- **Une séance d'écoute.** Ni l'agent ni la CI n'ont écouté le rendu : le banc écrit des fichiers, il n'ouvre aucun haut-parleur.
  Vérifier : `docs/seance-ecoute.md` prépare les fichiers et la grille, et la grille reste vide tant qu'une oreille de confiance n'a pas répondu ; `scripts/hooks/no-sound-guard.mjs` refuse tout lecteur audio.
- **Le tournage de la vidéo.** Le script et le plan de tournage sont écrits ; la pièce n'a pas encore été jouée ni filmée.
  Vérifier : `docs/video-kit.md` donne le cadrage et les plans ; `docs/submission.md` liste la vidéo parmi ce qui reste à faire.
- **Un audit d'accessibilité avec des personnes.** Les contrôles automatiques prouvent que les pages ne violent aucune règle du DOM, pas qu'une personne réussit à jouer.
  Vérifier : `docs/audit-utilisateurs.md` donne le protocole, `docs/audit-rapport.md` est encore un gabarit de champs `[…]` à remplir après la séance.
- **Les mesures de retard sur deux machines.** Le tableau des relevés n'a qu'une ligne remplie.
  Vérifier : `docs/latency.md` garde la ligne `r630` vide ; `node scripts/preuves/latence.mjs --machine "r630 — R630"` la remplit.
