# Le contrat de release — une version, un changelog, un tag, une publication

**La règle, en une phrase.** Une release de Thin Air n'existe que si elle tient
quatre éléments ensemble : **une version**, **une section de changelog**, **un
tag git**, **une publication vérifiée**. Il en manque un, la release est
incomplète : le contrôle (`scripts/release-check.mjs`) sort 1 et nomme
précisément ce qui manque.

Pourquoi une règle écrite plutôt qu'une intention : un dépôt qui publie peut
faire semblant. Une release Thin Air se prouve — le tag dit *quel* contenu,
le changelog dit *ce qu'il y a dedans*, la publication dit *ce que le monde
peut descargar*, et le contrôle compare les trois aux octets près. Ce qui n'est
pas vérifié n'est pas livré, c'est écrit.

## Les quatre éléments

| Élément | Ce qu'il est | Ce qui le contrôle |
|---|---|---|
| version | `x.y.z` dans le `package.json` de la racine | la version demandée au contrôle |
| changelog | une section `## x.y.z` (avec du contenu) dans `CHANGELOG.md` | `sectionDuChangelog()` |
| tag | `v<x.y.z>`, sur un commit **de `main`** | l'API GitHub : tags + comparaison |
| publication | le site public sert le bundle construit, fichier par fichier | comparaison SHA-256 |

Le tag s'écrit `v` + la version (`v0.1.0` pour `0.1.0`). Le contrôle accepte
les deux écritures, mais le dépôt n'en garde qu'une.

## Le tag suit le contenu

Un tag n'est pas une étiquette de version : c'est un pointeur vers un contenu.
Il suit donc trois règles.

1. **Il pointe sur un commit de `main`.** Un tag posé sur une branche de
   travail décrit un état qui n'existe nulle part ailleurs. Le contrôle
   compare le commit du tag à `main` et refuse un tag absent de `main`.
2. **Il est coupé sur le commit qui a été construit et publié**, pas sur un
   commit voisin. Le contrôle refuse aussi un bundle construit depuis un autre
   commit que celui du tag : sans cela, on prouverait n'importe quelle version.
3. **Il vient après le changelog.** Le changelog raconte le contenu du tag ;
   un tag posé avant l'écriture du changelog décrit un contenu muet.

## La publication se vérifie après coup

Publier n'est pas promettre : c'est vérifier, ensuite, que ce qui est en ligne
est bien ce qui a été construit. Le contrôle compare deux ensembles de
fichiers, SHA-256 contre SHA-256 :

- **le bundle construit** — `apps/web/dist`, produit par `npm run build` ;
- **le bundle servi** — ce que le site public renvoie à
  `https://tradoooo.github.io/thin-air/`.

Trois comparaisons, et chacune peut rompre :

1. **Chaque fichier du bundle construit doit être servi**, au même octet près.
   Un fichier absent du site public, ou un contenu différent, est un refus.
2. **La page publique ne doit référencer aucun fichier absent du bundle
   construit.** Une page qui pointe encore vers un bundle précédent est un
   refus : c'est exactement le signe d'une publication restée en retard.
3. **Le bundle construit doit venir du commit du tag.** Un `HEAD` différent du
   commit du tag est un refus.

L'écart est nommé en clair : le fichier, et les douze premiers caractères des
deux empreintes.

**Ce qui sort de la comparaison** : le modèle de vision et son moteur
d'exécution (`models/`, une vingtaine de Mo). Les télécharger à chaque
contrôle serait absurde ; ils sont contrôlés par la sonde de disponibilité
(`scripts/sonde-dispo.mjs`), qui vérifie qu'ils sont servis sans les
télécharger. Tout le reste — la coquille HTML, le JS, la CSS, le service
worker — est comparé octet par octet.

## Une publication incomplète échoue

Il n'y a pas de publication partielle tolérée, pas d'avertissement, pas de
« ça ira pour cette fois ». Les trois cas ci-dessus sont des refus francs :

- le code de sortie est **1** ;
- le message dit ce qui manque, fichier par fichier ;
- la release n'est pas « à moitié faite » : elle n'est pas faite.

C'est le même esprit que le reste du dépôt : une preuve qui ne prouve pas
n'est pas une preuve. Le banc de mesure (AIR-N-09) rend des nombres, le
contrôle de release rend des empreintes.

## La marche à suivre

1. **La version** : `version` du `package.json` de la racine.
2. **Le changelog** : une section `## x.y.z` dans `CHANGELOG.md` (à la
   racine), qui raconte le contenu de cette version.
3. **Le contenu** : la version est mergée dans `main`, le site est publié
   (GitHub Pages, le job `deploy` de `.github/workflows/deploy.yml`).
4. **Le tag**, coupé sur le commit publié :
   `git tag -a v0.1.0 <commit> && git push origin v0.1.0`.
5. **La vérification**, depuis le commit du tag :
   `npm run build && node scripts/release-check.mjs --version v0.1.0` → **0**.

L'ordre compte : le tag vient **après** la publication, parce que le contrôle
compare le bundle construit du commit du tag avec ce qui est réellement en
ligne. Un tag posé avant la publication ne prouve rien — il promet.

## Le contrôle automatisé

```bash
node scripts/release-check.mjs [--version v0.1.0] [--url <adresse publique>]
```

- `--version` : la version contrôlée. Sans elle, la version du `package.json`.
- `--url` : l'adresse publique comparée (par défaut, le site du dépôt).
- code **0** : la release est complète. Code **1** : elle ne l'est pas, et le
  message dit pourquoi.

Deux origines réseau, jamais plus : l'API GitHub (tags, comparaison avec
`main`, changelog au commit du tag) et l'adresse publique du site (le bundle
servi). Aucun son, jamais — le contrôle ne joue rien, il compare des octets.

Le contrôle est lui-même testé sur des témoins, sans réseau :
`scripts/release-check.test.ts`.

## Ce que le contrôle ne prouve pas

- **Que l'instrument joue.** Le contrôle compare des octets ; il ne dit rien
  du rendu. Ce qui le prouve est ailleurs : la sonde (fichiers servis),
  `docs/disponibilite.md` (ce que la sonde prouve et ce qu'elle ne prouve
  pas), `docs/recette.md` (la séance d'écoute humaine).
- **Que le changelog est exact.** Il vérifie qu'une section existe pour la
  version, pas qu'elle est sincère. C'est le rôle de la relecture.
- **Que la publication le restera.** Le contrôle compare au moment où il
  tourne ; une publication ultérieure peut rendre le site faux à nouveau. Il
  se relance.

## Les liens

- `CHANGELOG.md` — les versions livrées, à la racine.
- `scripts/release-check.mjs` — le contrôle.
- `scripts/release-check.test.ts` — ses cas, sur témoins.
- `docs/publication.md` — la publication des paquets npm (autre sujet : le
  moteur publié sur le registre, pas le site).
- `docs/disponibilite.md` — ce que la sonde prouve.
- `docs/CONTRACT.md` — les frontières entre lots.
