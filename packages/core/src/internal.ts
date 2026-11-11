/**
 * Un seul endroit pour dire « ce module est un contrat pas encore implémenté ».
 * Les lots sont construits en parallèle : les signatures sont figées dès le
 * squelette, les corps arrivent par lots (voir docs/CONTRACT.md).
 */
export function todo(module: string, lot: string): never {
  throw new Error(`TODO(${module}) — à implémenter dans le lot ${lot}`);
}
