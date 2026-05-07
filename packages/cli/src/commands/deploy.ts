/**
 * commands/deploy.ts
 * `nml deploy`: run build then `wrangler deploy`.
 */

import { spawn } from "child_process";
import { runBuild } from "./build.js";

function spawnProcess(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function runDeploy(cwd: string = process.cwd()): Promise<void> {
  await runBuild(cwd);

  console.log("\nDeploying with Wrangler...");
  const exitCode = await spawnProcess("bun", ["x", "wrangler", "deploy"], cwd);
  process.exit(exitCode);
}
