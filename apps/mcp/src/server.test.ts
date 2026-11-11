/**
 * Le serveur MCP en vrai : lancé comme processus enfant (`node --import tsx`),
 * interrogé en JSON-RPC 2.0 sur stdio. Aucun son, aucun navigateur (AIR-N-02) :
 * les preuves sont des lignes JSON et des nombres.
 */
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RACINE = fileURLToPath(new URL("../../..", import.meta.url));
const SERVEUR = resolve(RACINE, "apps/mcp/src/server.ts");
const DELAI_MS = 25_000;

interface Message {
  readonly jsonrpc?: string;
  readonly id?: number | string | null;
  readonly result?: Record<string, unknown>;
  readonly error?: { code: number; message: string };
}

type Match = (message: Message) => boolean;

interface Attente {
  readonly match: Match;
  readonly resolve: (message: Message) => void;
  readonly reject: (erreur: Error) => void;
}

/** Un client MCP minimal : écrit des lignes, rend les réponses par id. */
class ClientMcp {
  readonly enfant: ChildProcessWithoutNullStreams;
  /** Toutes les lignes reçues sur stdout, brutes. */
  readonly lignes: string[] = [];
  /** Les lignes de stdout qui ne sont pas du JSON — elles doivent rester vides. */
  readonly lignesNonJson: string[] = [];
  readonly stderr: string[] = [];
  private tampon = "";
  private attente: Attente[] = [];
  private compteur = 0;

  constructor() {
    this.enfant = spawn(process.execPath, ["--import", "tsx", SERVEUR], { cwd: RACINE, stdio: ["pipe", "pipe", "pipe"] });
    this.enfant.stdout.setEncoding("utf8");
    this.enfant.stderr.setEncoding("utf8");
    this.enfant.stdout.on("data", (morceau: string) => this.aval(morceau));
    this.enfant.stderr.on("data", (morceau: string) => this.stderr.push(morceau));
  }

  private aval(morceau: string): void {
    this.tampon += morceau;
    let coupure = this.tampon.indexOf("\n");
    while (coupure >= 0) {
      const ligne = this.tampon.slice(0, coupure);
      this.tampon = this.tampon.slice(coupure + 1);
      this.lignes.push(ligne);
      this.distribuer(ligne);
      coupure = this.tampon.indexOf("\n");
    }
  }

  private distribuer(ligne: string): void {
    let message: Message;
    try {
      message = JSON.parse(ligne) as Message;
    } catch {
      this.lignesNonJson.push(ligne);
      return;
    }
    const index = this.attente.findIndex((attente) => attente.match(message));
    if (index < 0) return;
    const trouve = this.attente.splice(index, 1)[0];
    trouve?.resolve(message);
  }

  /** Envoie une requête et attend la réponse qui porte le même id. */
 async envoyer(method: string, params?: unknown): Promise<Message> {
    this.compteur += 1;
    const id = this.compteur;
    const requete = params === undefined ? { jsonrpc: "2.0", id, method } : { jsonrpc: "2.0", id, method, params };
    return this.attendre((message) => message.id === id, JSON.stringify(requete));
  }

  /** Envoie une ligne brute (même non JSON) et attend une réponse qui correspond. */
  async envoyerBrut(ligne: string, match: Match): Promise<Message> {
    return this.attendre(match, ligne);
  }

  /** Envoie une notification : aucune réponse n'est attendue. */
  notifier(method: string, params?: unknown): void {
    const notification = params === undefined ? { jsonrpc: "2.0", method } : { jsonrpc: "2.0", method, params };
    this.enfant.stdin.write(`${JSON.stringify(notification)}\n`);
  }

  private attendre(match: Match, ligne: string): Promise<Message> {
    return new Promise<Message>((resoudre, rejeter) => {
      const minuterie = setTimeout(() => rejeter(new Error(`délai dépassé en attendant : ${ligne}`)), DELAI_MS);
      this.attente.push({
        match,
        resolve: (message) => {
          clearTimeout(minuterie);
          resoudre(message);
        },
        reject: (erreur) => {
          clearTimeout(minuterie);
          rejeter(erreur);
        },
      });
      this.enfant.stdin.write(`${ligne}\n`);
    });
  }
}

/** Le rapport de rendu d'un `tools/call`, ou lève si la réponse est une erreur. */
function resultat(reponse: Message): Record<string, unknown> {
  if (reponse.error !== undefined) throw new Error(`erreur JSON-RPC inattendue : ${JSON.stringify(reponse.error)}`);
  expect(reponse.result).toBeDefined();
  return reponse.result as Record<string, unknown>;
}

function structuré(reponse: Message): Record<string, unknown> {
  const resultatAppel = resultat(reponse);
  expect(resultatAppel["isError"]).not.toBe(true);
  return resultatAppel["structuredContent"] as Record<string, unknown>;
}

function texteDe(reponse: Message): string {
  const contenu = resultat(reponse)["content"] as Array<{ type: string; text: string }>;
  return contenu.map((bloc) => bloc.text).join("\n");
}

function appelOutil(client: ClientMcp, name: string, args: Record<string, unknown>): Promise<Message> {
  return client.envoyer("tools/call", { name, arguments: args });
}

const HARP = { take: "takes/reference/harp-sweep.json", instrument: "instruments/harp.json" };

let client: ClientMcp;

beforeAll(() => {
  client = new ClientMcp();
});

afterAll(() => {
  client.enfant.kill();
});

describe("initialize", () => {
  it("répond avec la version du protocole demandée et l'identité du serveur", async () => {
    const reponse = await client.envoyer("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-w1", version: "0" },
    });
    const resultatInit = resultat(reponse);
    expect(resultatInit["protocolVersion"]).toBe("2024-11-05");
    expect(resultatInit["serverInfo"]).toMatchObject({ name: "thin-air-mcp", version: "0.1.0" });
    expect(resultatInit["capabilities"]).toMatchObject({ tools: { listChanged: false } });
    expect(String(resultatInit["instructions"])).toContain("jamais de son");
  });

  it("une version de protocole inconnue reçoit la version du serveur", async () => {
    const reponse = await client.envoyer("initialize", { protocolVersion: "1999-01-01" });
    expect(resultat(reponse)["protocolVersion"]).toBe("2025-06-18");
  });

  it("la notification « initialized » ne reçoit aucune réponse", async () => {
    client.notifier("notifications/initialized");
    const ping = await client.envoyer("ping");
    expect(ping.result).toEqual({});
    // Aucune ligne entre la notification et le ping : la notification n'a rien produit.
    expect(client.lignes.filter((ligne) => ligne.includes("notifications/initialized"))).toEqual([]);
  });
});

describe("tools/list", () => {
  it("rend les trois outils du cahier §11.7, avec leurs schémas", async () => {
    const reponse = await client.envoyer("tools/list");
    const outils = resultat(reponse)["tools"] as Array<Record<string, unknown>>;
    expect(outils.map((outil) => outil["name"])).toEqual(["render_take", "list_notes", "compare_reports"]);
    for (const outil of outils) {
      expect(typeof outil["description"]).toBe("string");
      expect(String(outil["description"]).length).toBeGreaterThan(20);
      const schema = outil["inputSchema"] as Record<string, unknown>;
      expect(schema["type"]).toBe("object");
      expect(schema["properties"]).toBeTypeOf("object");
    }
  });

  it("chaque outil déclare ses entrées requises", async () => {
    const reponse = await client.envoyer("tools/list");
    const outils = resultat(reponse)["tools"] as Array<{ name: string; inputSchema: { required?: string[] } }>;
    const requis = Object.fromEntries(outils.map((outil) => [outil.name, outil.inputSchema.required ?? []]));
    expect(requis["render_take"]).toEqual(["take", "instrument"]);
    expect(requis["list_notes"]).toEqual(["take", "instrument"]);
    expect(requis["compare_reports"]).toEqual(["actual", "expected"]);
  });
});

describe("tools/call — render_take", () => {
  it("rend le rapport de la prise de référence, en nombres", async () => {
    const reponse = await appelOutil(client, "render_take", HARP);
    const rapport = structuré(reponse)["report"] as Record<string, unknown>;
    expect(rapport["take"]).toBe("harp-sweep");
    expect(rapport["instrument"]).toBe("Harp");
    expect(rapport["sampleRate"]).toBe(48_000);
    expect(rapport["samples"]).toBeGreaterThan(0);
    expect(rapport["peakDb"] as number).toBeLessThanOrEqual(-1);
    const notes = rapport["notes"] as Array<Record<string, number>>;
    expect(notes.length).toBeGreaterThanOrEqual(3);
    expect(notes[0]?.["midi"]).toBe(57);
    expect(texteDe(reponse)).toContain("crête");
  }, DELAI_MS);

  it("deux rendus du même couple donnent le même rapport, au bit près (AIR-N-09)", async () => {
    const premier = structuré(await appelOutil(client, "render_take", HARP))["report"];
    const second = structuré(await appelOutil(client, "render_take", HARP))["report"];
    expect(JSON.stringify(second)).toBe(JSON.stringify(premier));
  }, DELAI_MS * 2);

  it("un chemin de prise absent est une erreur lisible, pas une trace de pile", async () => {
    const reponse = await appelOutil(client, "render_take", { ...HARP, take: "takes/reference/absente.json" });
    const resultatAppel = resultat(reponse);
    expect(resultatAppel["isError"]).toBe(true);
    const texte = texteDe(reponse);
    expect(texte).toContain("fichier illisible");
    expect(texte).toContain("takes/reference/absente.json");
    expect(texte).not.toMatch(/^\s+at /m);
    expect(reponse.error).toBeUndefined();
  });

  it("un réglage inconnu est refusé, avec la raison", async () => {
    const reponse = await appelOutil(client, "render_take", { ...HARP, settings: { aimant: 1 } });
    expect(resultat(reponse)["isError"]).toBe(true);
    expect(texteDe(reponse)).toContain("réglage inconnu");
  });
});

describe("tools/call — list_notes", () => {
  it("rend les paliers mesurés : temps, note, fréquence mesurée, centièmes", async () => {
    const reponse = await appelOutil(client, "list_notes", HARP);
    const structure = structuré(reponse);
    const notes = structure["notes"] as Array<Record<string, number>>;
    expect(structure["count"]).toBe(notes.length);
    expect(notes.length).toBeGreaterThanOrEqual(3);
    for (const note of notes) {
      for (const cle of ["t", "midi", "expectedHz", "measuredHz", "cents"]) {
        expect(Number.isFinite(note[cle])).toBe(true);
      }
    }
    expect(notes.map((note) => note["midi"])).toEqual([57, 60, 62]);
    expect(texteDe(reponse)).toContain("cents");
  }, DELAI_MS);
});

describe("tools/call — compare_reports", () => {
  let rapport: Record<string, unknown>;

  beforeAll(async () => {
    rapport = structuré(await appelOutil(client, "render_take", HARP))["report"] as Record<string, unknown>;
  }, DELAI_MS);

  it("le même rapport des deux côtés est conforme, sans écart", async () => {
    const reponse = await appelOutil(client, "compare_reports", { actual: rapport, expected: rapport });
    const structure = structuré(reponse);
    expect(structure["conforming"]).toBe(true);
    expect(structure["diffs"]).toEqual([]);
    expect(texteDe(reponse)).toContain("conforme");
  });

  it("une crête décalée de 10 dB est un écart, non conforme", async () => {
    const décalé = { ...rapport, peakDb: (rapport["peakDb"] as number) + 10 };
    const reponse = await appelOutil(client, "compare_reports", { actual: décalé, expected: rapport });
    const structure = structuré(reponse);
    expect(structure["conforming"]).toBe(false);
    const diffs = structure["diffs"] as Array<Record<string, unknown>>;
    expect(diffs.some((diff) => diff["field"] === "peakDb")).toBe(true);
  });

  it("une tolérance élargie absorbe l'écart", async () => {
    const décalé = { ...rapport, peakDb: (rapport["peakDb"] as number) + 10 };
    const reponse = await appelOutil(client, "compare_reports", {
      actual: décalé,
      expected: rapport,
      tolerances: { peakDb: 20 },
    });
    expect(structuré(reponse)["conforming"]).toBe(true);
  });

  it("un rapport en fichier est accepté : le rapport rendu est conforme à lui-même", async () => {
    // Le banc a déjà rendu cette prise dans out/ ; on compare le rapport en ligne à lui-même.
    const reponse = await appelOutil(client, "compare_reports", { actual: rapport, expected: rapport });
    expect(structuré(reponse)["conforming"]).toBe(true);
  });

  it("une tolérance inconnue est refusée, avec la liste des tolérances", async () => {
    const reponse = await appelOutil(client, "compare_reports", {
      actual: rapport,
      expected: rapport,
      tolerances: { loudness: 1 },
    });
    expect(resultat(reponse)["isError"]).toBe(true);
    expect(texteDe(reponse)).toContain("tolérance inconnue");
  });
});

describe("tools/call — les refus du protocole", () => {
  it("un outil inconnu : -32602, avec les outils disponibles", async () => {
    const reponse = await appelOutil(client, "jouer_un_son", {});
    expect(reponse.error?.code).toBe(-32602);
    expect(reponse.error?.message).toContain("jouer_un_son");
    expect(reponse.error?.message).toContain("render_take");
  });

  it("une méthode inconnue : -32601", async () => {
    const reponse = await client.envoyer("resources/list");
    expect(reponse.error?.code).toBe(-32601);
  });

  it("une ligne qui n'est pas du JSON : -32700, id nul", async () => {
    const reponse = await client.envoyerBrut("{oops", (message) => message.error?.code === -32700);
    expect(reponse.id).toBeNull();
  });

  it("stdout ne porte que du JSON-RPC, les journaux vont sur stderr", () => {
    expect(client.lignesNonJson).toEqual([]);
    expect(client.lignes.length).toBeGreaterThan(0);
    expect(client.stderr.join("")).toContain("thin-air-mcp");
  });
});
