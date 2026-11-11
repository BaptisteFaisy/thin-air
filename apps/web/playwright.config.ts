import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

/**
 * Preuve de bout en bout (cahier §13.1, niveau 3) : la page entière dans un
 * vrai Chromium, fausse caméra, son coupé (AIR-N-02). Aucun test n'émet un
 * son : `--mute-audio` est dans les arguments de lancement, et aucune spec ne
 * règle de volume. Le site est construit puis servi par `vite preview` sous
 * `/thin-air/` (AIR-N-13), et chaque test est borné à moins d'une minute.
 */
const racine = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./out/e2e/artefacts",
  timeout: 50_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173/thin-air/",
    launchOptions: {
      args: [
        "--mute-audio",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "npx vite build apps/web && npx vite preview apps/web --port 4173 --strictPort --host 127.0.0.1",
    cwd: racine,
    url: "http://127.0.0.1:4173/thin-air/",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
