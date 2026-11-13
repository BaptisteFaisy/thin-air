# Installer une borne pour de vrai — matériel, démarrage, test de tenue

`docs/kiosque.md` dit ce que la borne **fait** (l'adresse `?kiosk=1`, les pannes
qu'elle encaisse, ses limites assumées). Ce fichier dit comment on la **pose** :
le matériel, le navigateur en plein écran, le démarrage automatique, la caméra,
la sortie audio, la vérification du lendemain, et le test de tenue d'une heure.

Les commandes sont écrites pour **ce poste** (`pc`, session X11, `google-chrome`
dans `/usr/bin`, `systemd` user actif) ; sur une autre machine, seuls les chemins
du navigateur et du dossier de session changent.

## 1. Matériel

| Élément | Ce qu'il faut | Pourquoi |
|---|---|---|
| Ordinateur | n'importe quelle machine capable de faire tourner un navigateur récent ; un mini-PC ou un stick suffit | le calcul est dans le navigateur, rien n'est installé côté serveur |
| Écran | un écran branché en HDMI/DisplayPort, en portrait ou paysage | la borne est plein écran, sans commande à l'écran |
| Caméra | une webcam USB posée **au-dessus ou sous** l'écran, tournée vers la zone de jeu | la détection des mains ne marche que si la zone est dans le cadre |
| Audio | une enceinte ou un casque **en jack (filaire)** | le sans-fil ajoute un retard audible entre le geste et le son (AIR-F-31, P7) |
| Alimentation | une prise murale, et si possible un onduleur | une borne qui redémarre seule après une coupure vaut mieux qu'une borne éteinte |
| Fixation | caméra immobilisée (pied, adhésif, serre-câble) | une caméra qui bouge décale toute la zone de jeu |

Aucun clavier ni souris n'est nécessaire une fois la borne lancée : les retirer
si la borne doit rester intouchable.

## 2. Navigateur en plein écran

```sh
/usr/bin/google-chrome \
  --kiosk \
  --autoplay-policy=no-user-gesture-required \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.thin-air-borne" \
  "https://tradoooo.github.io/thin-air/?kiosk=1"
```

- `--kiosk` : plein écran, sans barre, sans onglet, sans commande — la scène
  seule (`docs/kiosque.md`).
- `--autoplay-policy=no-user-gesture-required` : sans geste d'un visiteur, le
  navigateur laisserait le moteur audio en pause et la borne resterait muette
  (AIR-N-08). C'est le seul drapeau qui remplace le premier visiteur.
- `--remote-debugging-port=9222` : la seule façon de **lire** ce que la page
  affiche sans clavier ni souris (§6 et §7). Le port n'écoute que sur la machine.
- `--user-data-dir=…` : un profil dédié, pour que l'autorisation caméra accordée
  une fois le reste, et que le profil de travail du poste ne soit pas touché.

La première fois, le navigateur demande l'autorisation caméra : l'accorder, puis
ne plus y toucher. Ajouter `?lang=fr` (ou `lang=en`) à l'adresse fixe la langue
de la borne, qui n'a aucun réglage à l'écran.

## 3. Démarrage automatique

Une unité `systemd` user, lancée à l'ouverture de session :

```sh
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/thin-air-borne.service" <<'EOF'
[Unit]
Description=Thin Air — borne kiosque
After=graphical-session.target

[Service]
ExecStart=/usr/bin/google-chrome --kiosk --autoplay-policy=no-user-gesture-required --remote-debugging-port=9222 --user-data-dir=%h/.thin-air-borne https://tradoooo.github.io/thin-air/?kiosk=1
Restart=always
RestartSec=10

[Install]
WantedBy=graphical-session.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now thin-air-borne.service
```

`Restart=always` + `RestartSec=10` : un navigateur qui meurt repart dix secondes
plus tard, et la borne se relève seule pendant la nuit. Pour que la machine
démarre sans session ouverte, il faut `loginctl enable-linger <utilisateur>`
(une commande, à demander à l'administrateur de la machine).

Repli sans `systemd` : déposer la même ligne `ExecStart` dans un script
exécutable du dossier de démarrage de la session (`~/.config/autostart/` en
`.desktop`, ou le dossier « ouverture de session » de l'environnement).

## 4. Caméra fixe

```sh
ls /dev/video*                       # la caméra est-elle vue par le noyau ?
command -v v4l2-ctl || echo "v4l2-ctl absent (paquet v4l-utils) : ls /dev/video* suffit"
v4l2-ctl --list-devices              # si installé : quel périphérique pour quelle caméra
```

Sur **ce poste**, `ls /dev/video*` ne rend rien et `v4l2-ctl` n'est pas installé :
il n'y a pas de webcam branchée. La borne y est donc installable, mais la caméra
y est nécessairement factice — c'est exactement le cas du test de tenue du §7.

Ensuite : cadrer. La webcam doit voir la zone où les mains viendront, sans que le
cadre de l'écran n'en masque une partie, et sans contre-jour (une fenêtre dans le
dos des visiteurs). Vérifier le cadrage une fois, puis immobiliser la caméra :
chaque coup de coude dans le pied décale toute la zone de jeu.

## 5. Sortie audio filaire

Une enceinte ou un casque **en jack**. Jamais de Bluetooth ni de dongle sans fil :
le retard qu'ils ajoutent se voit sur le compteur de retard de la page et se sent
dans le geste (AIR-F-31). Le volume se règle **physiquement** sur l'enceinte ou
dans le système : la page de la borne n'a aucun réglage (§7.8, AIR-F-50), et rien
dans ce dépôt ne touche au volume (AIR-N-02).

Vérifier la sortie avant de laisser la borne tourner seule :

```sh
pactl info | grep -i "default sink"   # la sortie par défaut est-elle la filaire ?
```

## 6. Vérifier le lendemain

`docs/kiosque.md` §3 liste ce qu'on regarde (l'écran encore sur la scène, le
journal du navigateur, la mémoire, la caméra). Sur ce poste, les commandes sont :

```sh
curl -s http://127.0.0.1:9222/json/list | grep -E '"title"|"url"'   # la page est-elle encore là ?
systemctl --user status thin-air-borne.service --no-pager | head -8 # redémarrages ?
ps -o pid,rss,etime,cmd -C chrome --sort=-rss | head -3             # mémoire et durée de vie
ls /dev/video*                                                      # caméra toujours branchée ?
```

Une mémoire qui monte d'heure en heure est une fuite à rapporter
(`docs/kiosque.md` §5) ; une mémoire stable est le signe cherché. Un
`Restart=` qui a joué plusieurs fois se lit dans `systemctl --user status`.

## 7. Test de tenue : une heure, puis lire ce que la page affiche

**Aucun son pendant le test** (AIR-N-02) : le navigateur est lancé
`--mute-audio`, et **aucune caméra réelle** (AIR-N-10) : la caméra est factice.
Ce test prouve que la page reste vivante et cohérente pendant une heure — il ne
prouve ni le son, ni le geste, ni la détection des mains.

### 7.1 Lancer la borne d'essai

```sh
/usr/bin/google-chrome --headless=new --mute-audio \
  --remote-debugging-port=9333 \
  --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir=/tmp/kiosque-test \
  "https://tradoooo.github.io/thin-air/?kiosk=1&lang=fr" \
  >/tmp/chrome-kiosque.log 2>&1 &
```

`--headless=new` évite de confisquer l'écran du poste pendant l'heure de test ;
sur la vraie borne, on retire ce drapeau et on garde `--kiosk`.

### 7.2 Attendre une heure, puis lire

```sh
sleep 3600          # l'attente fait partie du test : ne pas la raccourcir
```

Puis lire ce que la page affiche, par le port de débogage :

```sh
cat > /tmp/lis-kiosque.mjs <<'EOF'
/** Lit ce que la borne affiche, via le port de débogage du navigateur. */
const port = process.argv[2] ?? "9333";
const cibles = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = cibles.find((cible) => cible.type === "page" && cible.url.includes("kiosk=1"));
if (!page) { console.error("aucune page kiosque ouverte"); process.exit(1); }
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok) => socket.addEventListener("open", ok, { once: true }));
const expression = `JSON.stringify({
  titre: document.title,
  ecran: document.querySelector("main")?.className ?? null,
  scene: document.querySelector("canvas")?.getAttribute("aria-label") ?? null,
  message: document.querySelector('[role="status"]')?.textContent?.trim() ?? null,
  texte: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 160),
})`;
socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
const reponse = await new Promise((ok) => socket.addEventListener("message", (m) => ok(JSON.parse(m.data)), { once: true }));
console.log(reponse.result?.result?.value ?? JSON.stringify(reponse));
socket.close();
EOF
node /tmp/lis-kiosque.mjs 9333
ps -o pid,rss,etime -C chrome --sort=-rss | head -3
```

Le `WebSocket` utilisé ici est celui de Node (22 ou plus) : aucune dépendance
n'est ajoutée au dépôt.

### 7.3 Ce qu'il faut lire

- `ecran` vaut `screen stage kiosk` : la borne est bien sur la scène, pas sur
  l'écran d'accueil.
- `scene` porte le libellé de la scène (`…le fantôme joue ; levez une main pour
  prendre la main.`) : le canevas est là et nommé.
- `message` est **`null`** : aucun état dégradé affiché. Un message ici n'est pas
  un échec du test mais un diagnostic — caméra perdue, accès refusé, modèle
  introuvable — et la borne continue de jouer (`docs/kiosque.md` §2).
- `ps` : la mémoire (`rss`) doit être du même ordre qu'au premier relevé ;
  `etime` doit dépasser l'heure.

### 7.4 Relevé réel sur ce poste, et l'écart constaté

Commandes du §7.1 et lecture du §7.2 exécutées sur ce poste le 12 novembre 2026
(lecture après 30 s de navigation, pas après une heure — l'heure entière reste à
faire avec les mêmes commandes) :

```json
{"titre":"Thin Air — play the air","ecran":"screen home","scene":null,"message":null,"texte":"Thin Air L'air devient un instrument. L'image de ta caméra ne quitte jamais cette page. La vidéo est lue dans cet onglet et transformée en positions de mains. A"}
```

```text
    PID   RSS ELAPSED
1249364 294128    01:23
1249226 253800    01:24
```

**Écart constaté, dit plutôt que caché** : `ecran` vaut `screen home`, pas
`screen stage kiosk` — sur le site **publié**, `?kiosk=1` ne change pas d'écran.
La cause est dans le dépôt : `apps/web/src/kiosk/` existe et sa machine à états
est testée, mais `App.tsx` n'appelle ni `kioskWanted()` ni `<Kiosk/>` — le
câblage appartient au lot qui possède `apps/web/**` (B4, `docs/CONTRACT.md`), pas
à celui-ci. La borne n'est donc pas installable en l'état sur l'adresse publique ;
elle l'est dès que ce câblage est livré, sans changer une commande de ce fichier.

Deuxième lecture honnête : `scene` est `null` pour la même raison (le canevas de
la borne n'est pas monté), et la mémoire relevée est celle d'un Chromium headless
sur une page d'accueil — elle ne préjuge pas de celle de la borne câblée, qui
fera tourner la vision en continu. Le test de tenue à refaire après le câblage
est donc : une heure, les mêmes commandes, `ecran` attendu `screen stage kiosk`.

### 7.5 Rangement

```sh
pkill -f "remote-debugging-port=9333"
trash /tmp/kiosque-test /tmp/lis-kiosque.mjs /tmp/chrome-kiosque.log 2>/dev/null \
  || rm -rf /tmp/kiosque-test /tmp/lis-kiosque.mjs /tmp/chrome-kiosque.log
systemctl --user disable --now thin-air-borne.service   # si l'unité du §3 a été posée
```

## 8. Avant de laisser la borne seule

- [ ] Écran qui ne s'éteint jamais, veille désactivée :
      `gsettings set org.gnome.desktop.session idle-delay 0`,
      `gsettings set org.gnome.desktop.screensaver lock-enabled false`,
      et `xset s off -dpms` pour la session en cours. (Sur ce poste, `idle-delay`
      valait `300` avant ce réglage : cinq minutes, et la borne s'endormait.)
- [ ] L'adresse répond : `node scripts/sonde-dispo.mjs` (§1 de
      `docs/disponibilite.md`) — la borne ne télécharge rien d'autre que ce site.
- [ ] L'unité du §3 est active et survit à une déconnexion (`enable-linger`).
- [ ] La caméra est cadrée et immobilisée, la sortie audio est filaire.
- [ ] Le test de tenue du §7 a tourné une heure et `message` était `null`.
- [ ] L'adresse reste en ligne jusqu'au **29 janvier 2027** (AIR-N-13) : la sonde
      quotidienne le surveille, et `docs/hosting.md` §4 dit le repli.
