import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { downloadLibrary, rewriteCdnSrcs, CDN_URLS } from "../src/localizer.js";

// ---------------------------------------------------------------------------
// rewriteCdnSrcs — pure function, no I/O
// ---------------------------------------------------------------------------

describe("rewriteCdnSrcs", () => {
  it("replaces a CDN URL with the local path", () => {
    const html = `<script src="${CDN_URLS.htmx}"></script>`;
    const result = rewriteCdnSrcs(html, { [CDN_URLS.htmx]: "/assets/htmx.js" });
    expect(result).toBe('<script src="/assets/htmx.js"></script>');
  });

  it("replaces multiple occurrences in the same file", () => {
    const html = `<script src="${CDN_URLS.htmx}"></script><script src="${CDN_URLS.htmx}"></script>`;
    const result = rewriteCdnSrcs(html, { [CDN_URLS.htmx]: "/assets/htmx.js" });
    expect(result).toBe('<script src="/assets/htmx.js"></script><script src="/assets/htmx.js"></script>');
  });

  it("rewrites multiple libraries in one pass", () => {
    const html = `<script src="${CDN_URLS.htmx}"></script><script src="${CDN_URLS.alpine}"></script>`;
    const result = rewriteCdnSrcs(html, {
      [CDN_URLS.htmx]: "/assets/htmx.js",
      [CDN_URLS.alpine]: "/assets/alpine.js",
    });
    expect(result).toBe('<script src="/assets/htmx.js"></script><script src="/assets/alpine.js"></script>');
  });

  it("returns HTML unchanged when no rewrites match", () => {
    const html = `<script src="https://example.com/other.js"></script>`;
    const result = rewriteCdnSrcs(html, { [CDN_URLS.htmx]: "/assets/htmx.js" });
    expect(result).toBe(html);
  });
});

// ---------------------------------------------------------------------------
// downloadLibrary — mocked fetch
// ---------------------------------------------------------------------------

describe("downloadLibrary", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "nml-localizer-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("downloads htmx and writes to dist/assets/htmx.js", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "// htmx mock content",
      status: 200,
      statusText: "OK",
    });

    const localPath = await downloadLibrary("htmx", {
      distDir: tmpDir,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(localPath).toBe("/assets/htmx.js");
    expect(mockFetch).toHaveBeenCalledWith(CDN_URLS.htmx);

    const written = await readFile(join(tmpDir, "assets", "htmx.js"), "utf-8");
    expect(written).toBe("// htmx mock content");
  });

  it("downloads alpine and writes to dist/assets/alpine.js", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "// alpine mock content",
      status: 200,
      statusText: "OK",
    });

    const localPath = await downloadLibrary("alpine", {
      distDir: tmpDir,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(localPath).toBe("/assets/alpine.js");

    const written = await readFile(join(tmpDir, "assets", "alpine.js"), "utf-8");
    expect(written).toBe("// alpine mock content");
  });

  it("skips download if file already exists", async () => {
    const mockFetch = vi.fn();

    // Pre-create the file
    const { mkdir, writeFile } = await import("fs/promises");
    await mkdir(join(tmpDir, "assets"), { recursive: true });
    await writeFile(join(tmpDir, "assets", "htmx.js"), "// cached", "utf-8");

    const localPath = await downloadLibrary("htmx", {
      distDir: tmpDir,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(localPath).toBe("/assets/htmx.js");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when fetch returns a non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    });

    await expect(
      downloadLibrary("htmx", {
        distDir: tmpDir,
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow("404");
  });
});
