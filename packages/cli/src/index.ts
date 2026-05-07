#!/usr/bin/env bun
/**
 * NML CLI entry point.
 * Dispatches to subcommands: init, dev, build, deploy, test.
 */

import { runInit } from "./commands/init.js";
import { runDev } from "./commands/dev.js";
import { runBuild } from "./commands/build.js";
import { runDeploy } from "./commands/deploy.js";
import { runTest } from "./commands/test.js";

const [, , command, ...args] = process.argv;

const cwd = process.cwd();

switch (command) {
  case "init":
    await runInit({ cwd });
    break;

  case "dev":
    await runDev(cwd);
    break;

  case "build":
    await runBuild(cwd);
    break;

  case "deploy":
    await runDeploy(cwd);
    break;

  case "test":
    await runTest(cwd);
    break;

  default:
    console.log(`
nml — NML Framework CLI v2.2

Usage:
  nml init      Interactive project scaffold
  nml dev       Start the Vite dev server
  nml build     Build for production
  nml deploy    Build + wrangler deploy
  nml test      Lint .nml files + run Vitest
`);
    process.exit(command ? 1 : 0);
}
