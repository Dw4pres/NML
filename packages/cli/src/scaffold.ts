/**
 * scaffold.ts
 * Silent gap-filler used by `nml dev` (NOT `nml init`).
 * Writes only genuinely missing files with sensible defaults.
 * Never prompts, never overwrites.
 */

import { writeFile, access, mkdir } from "fs/promises";
import { join } from "path";

async function fileExists(p: string): Promise<boolean> {
  return access(p).then(() => true).catch(() => false);
}

async function writeIfMissing(p: string, content: string): Promise<void> {
  if (!(await fileExists(p))) {
    await mkdir(join(p, ".."), { recursive: true });
    await writeFile(p, content, "utf-8");
  }
}

export async function gapFill(cwd: string): Promise<void> {
  await writeIfMissing(
    join(cwd, "views", "index.nml"),
    'doctype.html\nhtml.lang("en")\n    head\n        title("NML App")\n    body\n        h1("Hello from NML")\n'
  );

  await writeIfMissing(
    join(cwd, "components.nml"),
    "// Define reusable components here\n// @define.MyComponent\n//     div\n//         @slot\n"
  );
}
