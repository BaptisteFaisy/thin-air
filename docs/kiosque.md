# Installer et surveiller une borne (mode kiosque)

Le mode kiosque est l'instrument posé quelque part — médiathèque, musée, salle
de classe — sans personne pour le regarder. L'adresse `?kiosk=1` rend l'écran
plein écran, sans réglage : le fantôme rejoue une prise en boucle, une main
qui paraît prend la main, elle repart et le fantôme revient après dix
secondes.

## 1. Installer la borne

1. **Navigateur en plein écran.** Lancer un navigateur en mode kiosk sur
   l'adresse, par exemple Chromium :
   ```sh
   chromium --kiosk --autoplay-policy=no-user-gesture-required --remote-debugging-port=9222 \
     "https://…/thin-air/?kiosk=1"
   ```
   `--autoplay-policy=no-user-gesture-required` lève le blocage du son : sans
   geste d'un visiteur, le navigateur mettrait le moteur audio en pause et la
   borne resterait muette (AIR-N-08, moteur suspendu).
2. **Démarrage automatique.** Brancher la borne dans la session de démarrage
   de la machine (unité `systemd` user, dossier « ouverture » de session,
   ou `autostart`). La page ne garde rien à configurer : une seule adresse.
3. **Caméra fixe.** Une webcam posée au-dessus ou sous l'écran, tournée vers
   la zone de jeu, branchée en USB. Vérifier qu'elle filme la zone où les
   mains viendront, et qu'elle n'est pas masquée par le cadre.
4. **Sortie audio filaire.** Une enceinte ou un casque en jack, jamais en
   sans-fil : une sortie sans fil ajoute un retard audible entre le geste et
   le son (AIR-F-31, P7). Le volume se règle physiquement sur l'enceinte ou
   le système, la page reste sans réglage.
5. **Verrouiller.** Désactiver l'extinction d'écran et la veille, et retirer
   clavier/souris si la borne doit rester intouchable.

## 2. Ce qui se passe en cas de panne

La borne est conçue pour survivre à une nuit entière, sans surveillance :

| Panne | Ce que la borne fait |
|---|---|
| Caméra débranchée (piste arrêtée) | état dégradé : un message discret l'explique, le fantôme continue de jouer — la borne ne meurt jamais |
| Accès caméra refusé | même chose : message + fantôme, l'écran reste vivant |
| Modèle de mains introuvable | message + fantôme |
| Onglet masqué / autre onglet par-dessus | toutes les notes sont relâchées, le fantôme se met en pause, il reprend dès que l'onglet redevient visible (AIR-N-08) |
| Moteur audio suspendu par le navigateur | relâchement, puis reprise quand le navigateur redonne la main |

Aucune de ces pannes ne laisse une note coincée : à chaque transition le
moteur relâche tout (AIR-F-16, AIR-N-08).

## 3. Vérifier le lendemain que ça a tourné

La borne ne téléphone nulle part : pour savoir si elle a tourné, on regarde la
machine elle-même.

1. **L'écran est encore sur la scène** et le fantôme joue : c'est le premier
   signe, une panne franche aurait figé ou noirci l'écran.
2. **Journal du navigateur.** Via le port de débogage :
   ```sh
   curl -s http://localhost:9222/json | jq '.[] | {title, url}'
   ```
   et `curl -s http://localhost:9222/json/version` pour confirmer que le
   navigateur n'a pas été relancé par le système.
3. **Mémoire et processus.** `ps` et la mémoire du processus navigateur : une
   dérive continue signale une fuite à rapporter (voir 5). Une borne en bonne
   santé reste à un niveau stable d'une heure à l'autre.
4. **Caméra.** `v4l2-ctl --list-devices` (ou l'équivalent du système) pour
   confirmer que le périphérique est toujours là le matin.

## 4. Limites assumées

- **Aucune supervision à distance.** La borne ne téléphone à personne : pas de
  télémétrie, pas de serveur, aucun appel sortant de la page (AIR-N-01).
  Savoir qu'elle a tourné exige de se rendre sur place.
- **Pas de réglage.** Le volume, l'aimant et l'instrument sont imposés (§7.8,
  AIR-F-50) ; on les change en modifiant `apps/web/src/kiosk/kiosk.ts`, pas
  sur l'écran.
- **Le son attend un geste.** Tant qu'aucun visiteur n'a interagi, le
  navigateur peut garder le moteur audio en pause ; le drapeau d'autoplay de
  l'étape 1 l'empêche.
- **Une seule prise.** Le fantôme rejoue `slow-rise.json` (trois secondes,
  thérémine). En changer revient à changer `priseFantome()` dans
  `apps/web/src/kiosk/kiosk.ts` et à reconstruire.

## 5. Signaler un défaut

Un écran noir, une mémoire qui monte sans cesse, une caméra qui ne revient pas
au bout de quelques minutes : décrire la situation et la durée. La machine à
états (`apps/web/src/kiosk/kioskState.ts`) est pure et testée ; tout
comportement qui en sort est un défaut à remonter.