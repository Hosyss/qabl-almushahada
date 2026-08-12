import { spawn } from "node:child_process";

import {
  CLOUDFLARE_PRODUCTION_CONFIG_PATH,
  writeCloudflareProductionConfig,
} from "./prepare-cloudflare-deploy.mjs";

const { path: configPath } = await writeCloudflareProductionConfig();
console.log(`Building with Cloudflare config: ${configPath}`);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["exec", "--", "vinext", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH: configPath,
  },
});

const exitCode = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (code, signal) => {
    if (signal) return reject(new Error(`Cloudflare build terminated by signal ${signal}.`));
    resolve(code ?? 1);
  });
});

if (exitCode !== 0) {
  console.error(`Cloudflare production build failed with exit code ${exitCode}.`);
  process.exitCode = exitCode;
} else {
  console.log(`Cloudflare production build succeeded using ${CLOUDFLARE_PRODUCTION_CONFIG_PATH}.`);
}
