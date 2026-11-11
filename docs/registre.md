# Le registre d'instruments, sans backend

## Ce que c'est

Un dossier (ou un dépôt git) de fichiers `*.json` au format
`thin-air-instrument/1`. `scripts/registre.mjs` le parcourt, valide chaque
fichier avec `@thin-air/schema`, et produit un index : nom, moteur, gamme,
aimant, géométrie, nombre de voix, **fragment de partage**, chemin d'origine.

```bash
npx tsx scripts/registre.mjs registre/instruments               # index → out/registre.json
npx tsx scripts/registre.mjs registre/instruments --markdown     # + tableau Markdown
npx tsx scripts/registre.mjs https://github.com/quelquun/ses-instruments.git
```

Un fichier invalide est **listé avec ses raisons**, jamais ignoré en silence.
Le script sort 1 si rien n'est valide.

Sortie réelle sur les deux exemples du dépôt :

```text
2 instrument(s) valide(s), 0 refusé(s) → out/registre.json
  ✓ Glass Harp · corde pincée · 12 cordes (u) · aimant 1
  ✓ Vigil · oscillateurs · 5 zones · aimant 1
```

## Ce que ce n'est pas

- **Aucun hébergement** : le registre est un dossier. Il n'y a rien à maintenir,
  rien à modérer côté serveur, aucune base de données.
- **Aucune exécution de code tiers** : un instrument est une donnée validée par
  schéma. Le moteur qui le joue est celui du site. C'est la raison pour laquelle
  le format est délibérément déclaratif et fermé (schéma strict) : importer
  l'instrument de quelqu'un ne peut pas exécuter quoi que ce soit.
- **Aucune requête réseau depuis la page** (AIR-N-01) : l'import passe par le
  fragment d'adresse, qui n'est jamais envoyé au serveur.

## Pourquoi le registre n'est nécessaire à rien

`instrumentToFragment` / `instrumentFromFragment` (déjà livrés et testés, lot A4)
font tenir un instrument entier dans le fragment d'une URL. Un lien copié-collé
suffit à transmettre un instrument : c'est le parcours P8. Le registre ajoute
seulement la **découverte** — parcourir ce que d'autres ont écrit — sans ajouter
de dépendance.

## Limite assumée

Aucune modération automatique du contenu musical : le schéma valide la forme, pas
le goût. Un registre public est donc modéré comme n'importe quel dépôt, par PR.
