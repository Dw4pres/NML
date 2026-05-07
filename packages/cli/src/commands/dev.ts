/**
 * commands/dev.ts
 * `nml dev`: gap-fill missing files then launch Vite dev server.
 */

import { spawn } from "child_process";
import { gapFill } from "../scaffold.js";

export async function runDev(cwd: string = process.cwd()): Promise<void> {
  await gapFill(cwd);

  console.log("Starting Vite dev server...\n");

  const child = spawn("bun", ["x", "vite"], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}
