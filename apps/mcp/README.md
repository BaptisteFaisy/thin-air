# `apps/mcp` — le serveur MCP de Thin Air

Les « oreilles en chiffres » de l'agent (cahier §11.7) : un serveur
[Model Context Protocol](https://modelcontextprotocol.io) qui rend, sur stdio,
les nombres du banc d'essai — jamais un son.

> **Règle du projet (AIR-N-02) : ce serveur ne joue JAMAIS de son.** Il ne
> connaît aucun périphérique audio, aucun lecteur, aucun volume. Il lit des
> fichiers (prises, instruments, rapports), appelle le banc d'essai
> (`apps/bench`), et rend des fichiers et des nombres. Personne n'écoute
> pendant la construction : la preuve passe par les mesures.

## Le brancher dans un client MCP

Le serveur se lance avec Node (≥ 22) et `tsx`, depuis la racine du dépôt.
Configuration générique d'un client MCP :

```json
{
  "mcpServers": {
    "thin-air": {
      "command": "node",
      "args": ["--import", "tsx", "apps/mcp/src/server.ts"],
      "cwd": "/chemin/vers/thin-air"
    }
  }
}
```

Le protocole est JSON-RPC 2.0 sur stdio, sans SDK ni dépendance externe :
`initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`.
Chaque ligne de stdout est un message JSON-RPC, et rien d'autre ; les journaux
vont sur stderr. Les erreurs portent les codes normalisés (-32700 JSON
illisible, -32600 requête invalide, -32601 méthode inconnue, -32602 paramètres
invalides ou outil inconnu, -32603 échec interne). Un échec de calcul (fichier
absent, réglage refusé) revient comme un **résultat d'outil lisible**
(`isError: true`), jamais comme une trace de pile.

Tous les chemins de fichiers (prise, instrument, rapport) sont **relatifs à la
racine du dépôt**, quel que soit le dossier de lancement du serveur.

## Les trois outils

### `render_take` — la prise et l'instrument en entrée, le rapport en sortie

Rend une prise avec un instrument (calcul hors ligne, dans un tableau
d'échantillons) et rend le `RenderReport` : durée, crête, niveau moyen, voix,
silence final, notes mesurées.

```json
{"name": "render_take", "arguments": {"take": "takes/reference/harp-sweep.json", "instrument": "instruments/harp.json"}}
```

Réponse (extrait réel, `content[0].text`) :

```text
prise      harp-sweep
instrument Harp
rendu      81600 échantillons à 48000 Hz, 1,700 s
crête      −43,81 dB — niveau moyen −59,23 dB
voix       4 au plus
silence    824,1 ms à la fin

notes (3) :
  0,147 s    midi 57    220,00 Hz    mesuré 293,22 Hz     497,37 cents
  0,280 s    midi 60    261,63 Hz    mesuré 347,94 Hz     493,62 cents
  0,413 s    midi 62    293,66 Hz    mesuré 347,94 Hz     293,62 cents
```

`structuredContent.report` porte les mêmes nombres en JSON. Entrées
optionnelles : `settings` (réglages partiels du §7.13, validés clé par clé),
`oneHand`, `hold`. Le rendu est déterministe (AIR-N-09) : deux appels du même
couple rendent le même rapport, au bit près — et le rapport ne porte aucune
date.

### `list_notes` — les notes mesurées dans un rendu

Mêmes entrées que `render_take` ; rend les paliers de note mesurés
(`noteSteps` du banc, mesurés par le rendu) : temps `t`, note `midi`,
fréquence attendue `expectedHz`, fréquence mesurée `measuredHz`, écart
`cents`.

```json
{"name": "list_notes", "arguments": {"take": "takes/reference/harp-sweep.json", "instrument": "instruments/harp.json"}}
```

Réponse (extrait réel, `structuredContent`) :

```json
{"take": "harp-sweep", "instrument": "Harp", "count": 3, "notes": [
  {"t": 0.14667, "midi": 57, "expectedHz": 220, "measuredHz": 293.21958911147203, "cents": 497.37355802604736},
  {"t": 0.28, "midi": 60, "expectedHz": 261.6255653005986, "measuredHz": 347.94459146724705, "cents": 493.62486989256655},
  {"t": 0.41333000000000003, "midi": 62, "expectedHz": 293.6647679174076, "measuredHz": 347.94459146724705, "cents": 293.6248698925664}
]}
```

Les paliers trop courts pour être mesurables (< 200 ms, garde du banc) sont
exclus de la mesure, comme dans `bench render` — c'est dit par le banc, pas
masqué ici.

### `compare_reports` — les écarts et la conformité

`actual` et `expected` acceptent chacun **un chemin de fichier** (rapport JSON
du banc) **ou un objet rapport en ligne**. `tolerances` est optionnel :
`cents`, `peakDb`, `rmsDb`, `noteTimeMs`, `silenceAfterMs` (défauts du §13 :
5 / 0,5 / 0,5 / 33 / 100).

```json
{"name": "compare_reports", "arguments": {"actual": "out/rendu/report.json", "expected": "takes/reference/harp-sweep.expected.json", "tolerances": {"peakDb": 1}}}
```

Réponse (extrait réel) :

```text
1 écart(s) :
✗ peakDb              attendu −43,81 dB · obtenu −33,80 dB  écart +10,01 dB  tolérance 0,50 dB
```

avec `structuredContent` :

```json
{"conforming": false,
 "tolerances": {"cents": 5, "peakDb": 0.5, "rmsDb": 0.5, "noteTimeMs": 33, "silenceAfterMs": 100},
 "diffs": [{"field": "peakDb", "expected": -43.81, "actual": -33.8, "tolerance": 0.5, "unit": "dB"}]}
```

`conforming` est le booléen de conformité : `true` quand aucun écart ne dépasse
les tolérances — l'équivalent du code de sortie 0 de `bench compare`.

## Essayer à la main

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node --import tsx apps/mcp/src/server.ts
```

## Tests

```bash
npx vitest run apps/mcp
```

Les tests lancent le serveur **comme processus enfant** et échangent de vrais
messages JSON-RPC : `initialize`, `tools/list` (les trois outils et leurs
schémas), `tools/call` sur la prise de référence `harp-sweep` + `harp`,
déterminisme au bit près, chemin absent (erreur lisible, sans trace de pile),
réglage inconnu, comparaison conforme / non conforme / tolérance élargie, outil
inconnu (-32602), méthode inconnue (-32601), JSON illisible (-32700), et la
pureté de stdout. Aucun son, aucun navigateur.

## Bornes

- Aucun son, aucun périphérique audio (AIR-N-02) ; aucune requête réseau
  (AIR-N-01) ; déterminisme (AIR-N-09) : ni `Math.random()`, ni `Date.now()`
  dans les sorties.
- Ce serveur ne réécrit aucune mesure : tout le calcul vient du banc
  (`apps/bench`) ; `apps/mcp` ne fait que lire des fichiers, appeler le banc et
  rendre ses nombres.
