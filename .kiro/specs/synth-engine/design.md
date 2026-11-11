# synth-engine — Conception

## Un moteur, deux habillages

`packages/audio/src/dsp` est du TypeScript pur : il calcule des échantillons
dans un tableau, sans `AudioContext`, sans navigateur. `packages/audio/src/`
`offline` l'appelle depuis Node (le banc), `graph/live` l'appelle depuis le
graphe audio du navigateur (les worklets). **Une seule implémentation** : un
effet corrigé dans le rendu hors ligne est corrigé en jeu, et une propriété
mesurée hors ligne parle du son que l'utilisateur entendra.

C'est aussi ce qui rend AIR-N-02 tenable : dans Node, aucun périphérique audio
ne peut être ouvert, même par accident.

## Le limiteur et le plafond (AIR-F-28, AIR-P-13)

Compresseur réglé en limiteur (seuil haut, ratio élevé, attaque courte,
relâchement moyen), puis un **plafond dur** à −1 dB sur chaque échantillon
(`min(1, ceiling / |x|)`). Le plafond dur est la garantie dont la mesure a
besoin : un limiteur seul peut dépasser sur une transitoire, et AIR-P-13 est
une propriété universelle, pas un cas moyen. Coût : une distorsion sur les
crêtes extrêmes, acceptable, et mesurée.

Ordre de la chaîne : voix → mélange → réverbération → gain général (−12 dB)
→ limiteur → plafond → sortie.

## La corde pincée (AIR-F-29)

Karplus-Strong : une ligne à retard bouclée, longueur = période de la note.
326,9 échantillons pour le ré à 146,83 Hz à 48 000 Hz. Elle vit dans un
AudioWorklet **parce que** dans le graphe ordinaire un retard pris dans une
boucle ne descend pas sous un bloc de 128 échantillons (2,67 ms) : aucune note
au-dessus de 375 Hz ne serait possible.

Décision pour le rendu hors ligne : la même classe, sans le cadre AudioWorklet
(un `process(inputs, outputs, paramètres)` identique). Le worklet n'est qu'un
emballage ; la logique est testable sans navigateur, donc AIR-P-14 peut être
mesurée sur toutes les notes de l'étendue.

## Pas de marches (AIR-P-16)

Toute mise à jour de réglage passe par une rampe exponentielle d'une
constante de temps de 20 ms (`paramTauMs`), appliquée **échantillon par
échantillon** dans le moteur hors ligne : la valeur d'un réglage à
l'échantillon `n` est `cible + (départ − cible) × exp(−n / (τ × fs))`. Un
réglage fixé directement produit les marches que la propriété détecte ; c'est
la démonstration du §14.6 (le réglage sans rampe avant `two-clocks.md`, la
même ligne après, la mesure du grésillement dans les deux cas).

## Réverbération (AIR-F-30)

Réseau de retards à réinjection (Schroeder : peignes + filtres passe-tout),
généré au démarrage. Décision notée au journal de bord : le §7.9 prévoyait une
convolution par une réponse calculée ; un réseau de retards donne le même
service, tourne hors ligne à bon marché et se règle en un nombre. L'écart est
assumé et écrit.

Réglable et désactivable (`reverb`, 0 à 1 ; 0 = hors circuit). La propriété
AIR-P-15 a deux seuils pour cette raison : 800 ms sans réverbération, deux
secondes avec.

## Silence final (AIR-P-15)

Chaque voix relâchée suit son extinction (`releaseMs` de l'instrument), puis
est retirée du mélange. Le silence est mesuré sur le rendu : sous −60 dB. Une
voix qui ne rendrait jamais 0 (un filtre à réinjection, une réverbération mal
bornée) ferait échouer la propriété : c'est exactement ce qu'on veut qu'elle
attrape.
