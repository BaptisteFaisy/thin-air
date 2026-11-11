/**
 * Point d'entrée des bancs du lot A7 (voir `packages/instruments/README.md`).
 *
 * Les bancs vivent dans `instruments/`, à côté des fichiers qu'ils
 * contrôlent ; la configuration de Vitest ne regarde que les dossiers
 * `packages/<paquet>/src` et `apps/<app>/src`. Ce fichier les importe, sans
 * rien dupliquer : les descriptions et les assertions sont les leurs.
 */
await import("../../../instruments/instruments.test");
await import("../../../instruments/guards.test");

export {};
