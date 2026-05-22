#!/usr/bin/env node
// deploy.mjs — read .env.local and deploy with vars + optional custom domain
// Rules:
//   GATEWAY_TOKEN  → ignored (not needed by the Worker, used only in manifest.xml)
//   GATEWAY_URL    → custom domain if present (also passed as --var)
//   everything else → public var (--var)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const ENV_PATH = resolve(process.cwd(), ".env.local");

function loadEnv(path) {
  const content = readFileSync(path, "utf8");
  const lines = content.split("\n");
  const publicVars = [];
  let customDomain = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!value) continue;

    if (key === "GATEWAY_TOKEN") {
      // Skip — not needed by the Worker (only used in manifest.xml)
      continue;
    }

    publicVars.push({ key, value });

    if (key === "GATEWAY_URL") {
      customDomain = value.replace(/^https?:\/\//, "");
    }
  }
  return { publicVars, customDomain };
}

const { publicVars, customDomain } = loadEnv(ENV_PATH);

if (publicVars.length === 0) {
  console.log("No variables found in .env.local");
  process.exit(1);
}

// Build deploy flags
const varFlags = publicVars
  .map(({ key, value }) => ` --var ${key}:${value}`)
  .join("");

const domainFlag = customDomain ? ` --domain ${customDomain}` : "";

const deployCmd = `npx wrangler deploy${varFlags}${domainFlag}`;
console.log("Deploying...");
console.log(`  ${deployCmd}\n`);

try {
  execSync(deployCmd, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} catch (e) {
  console.error("Deploy failed.");
  process.exit(1);
}
