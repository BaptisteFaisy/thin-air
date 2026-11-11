/**
 * Validation par schéma (cahier §11.2, AIR-F-43, AIR-P-19, AIR-P-20).
 * Un fichier invalide est refusé EN ENTIER, avec la raison : jamais de
 * valeur par défaut silencieuse.
 */
export * from "./instrument.js";
export * from "./take.js";
export * from "./session.js";
export * from "./vocab.js";
export { parseWith, type ParseErr, type ParseOk, type ParseResult } from "./common.js";
