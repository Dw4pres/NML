import { describe, it, expect } from "vitest";
import { scanRoutes, matchRoute, serializeRouteMap, deserializeRouteMap, createHandler } from "../src/index.js";
import type { ReadDirFn } from "../src/scanner.js";

// ---------------------------------------------------------------------------
// Mock filesystem helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock ReadDirFn from a flat list of relative paths.
 * e.g. ["index.nml", "about.nml", "users/[id].nml"]
 */
function mockReadDir(
  viewsDir: string,
  files: string[]
): ReadDirFn {
  return async (dir: string) => {
    const prefix = dir === viewsDir ? "" : dir.slice(viewsDir.length + 1).replace(/\\/g, "/") + "/";
    const entries: Array<{ name: string; isDirectory(): boolean }> = [];
    const seen = new Set<string>();

    for (const f of files) {
      const rel = f.startsWith(prefix) ? f.slice(prefix.length) : null;
      if (rel === null) continue;
      const firstSlash = rel.indexOf("/");
      if (firstSlash === -1) {
        entries.push({ name: rel, isDirectory: () => false });
      } else {
        const dirName = rel.slice(0, firstSlash);
        if (!seen.has(dirName)) {
          seen.add(dirName);
          entries.push({ name: dirName, isDirectory: () => true });
        }
      }
    }
    return entries;
  };
}

// ---------------------------------------------------------------------------
// scanRoutes
// ---------------------------------------------------------------------------

describe("scanRoutes", () => {
  it("maps index.nml to /", async () => {
    const viewsDir = "/views";
    const files = ["index.nml"];
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, files));
    expect(routeMap).toHaveLength(1);
    expect(routeMap[0].pattern).toBe("/");
  });

  it("maps about.nml to /about", async () => {
    const viewsDir = "/views";
    const files = ["about.nml"];
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, files));
    expect(routeMap[0].pattern).toBe("/about");
  });

  it("maps nested index.nml to parent path", async () => {
    const viewsDir = "/views";
    const files = ["users/index.nml"];
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, files));
    expect(routeMap[0].pattern).toBe("/users");
  });

  it("maps [id].nml to /:id param route", async () => {
    const viewsDir = "/views";
    const files = ["users/[id].nml"];
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, files));
    expect(routeMap[0].pattern).toBe("/users/:id");
  });

  it("sorts static routes before param routes (specificity)", async () => {
    const viewsDir = "/views";
    const files = ["users/[id].nml", "users/new.nml"];
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, files));
    expect(routeMap[0].pattern).toBe("/users/new");
    expect(routeMap[1].pattern).toBe("/users/:id");
  });

  it("handles empty views directory", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, []));
    expect(routeMap).toHaveLength(0);
  });

  it("scans nested directories recursively", async () => {
    const viewsDir = "/views";
    const files = ["index.nml", "blog/index.nml", "blog/[slug].nml"];
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, files));
    const patterns = routeMap.map((r) => r.pattern);
    expect(patterns).toContain("/");
    expect(patterns).toContain("/blog");
    expect(patterns).toContain("/blog/:slug");
  });

  it("assigns higher score to static than param than wildcard", async () => {
    const viewsDir = "/views";
    const files = ["a/[b]/c.nml", "a/b/c.nml"];
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, files));
    expect(routeMap[0].pattern).toBe("/a/b/c");
    expect(routeMap[0].score).toBeGreaterThan(routeMap[1].score);
  });
});

// ---------------------------------------------------------------------------
// matchRoute
// ---------------------------------------------------------------------------

describe("matchRoute", () => {
  it("matches the root route", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["index.nml"]));
    const result = matchRoute(routeMap, "/");
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({});
  });

  it("matches a static route", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["about.nml"]));
    const result = matchRoute(routeMap, "/about");
    expect(result).not.toBeNull();
  });

  it("extracts dynamic params", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["users/[id].nml"]));
    const result = matchRoute(routeMap, "/users/42");
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({ id: "42" });
  });

  it("returns null for unmatched paths", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["index.nml"]));
    const result = matchRoute(routeMap, "/does-not-exist");
    expect(result).toBeNull();
  });

  it("static wins over param collision", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["users/[id].nml", "users/new.nml"]));
    const result = matchRoute(routeMap, "/users/new");
    expect(result?.file).toContain("new.nml");
  });

  it("decodes URI-encoded params", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["posts/[slug].nml"]));
    const result = matchRoute(routeMap, "/posts/hello%20world");
    expect(result?.params?.slug).toBe("hello world");
  });

  it("strips query string and hash before matching", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["about.nml"]));
    const result = matchRoute(routeMap, "/about?ref=home#section");
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// manifest serialization
// ---------------------------------------------------------------------------

describe("serializeRouteMap / deserializeRouteMap", () => {
  it("round-trips a RouteMap", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["index.nml", "users/[id].nml"]));
    const json = serializeRouteMap(routeMap);
    const restored = deserializeRouteMap(json);
    expect(restored).toHaveLength(routeMap.length);
    expect(restored[0].pattern).toBe(routeMap[0].pattern);
    expect(restored[0].file).toBe(routeMap[0].file);
  });

  it("returns empty array for invalid JSON", () => {
    expect(deserializeRouteMap("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(deserializeRouteMap('{"key":"value"}')).toEqual([]);
  });

  it("restored RouteMap can still match routes", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["users/[id].nml"]));
    const restored = deserializeRouteMap(serializeRouteMap(routeMap));
    const result = matchRoute(restored, "/users/99");
    expect(result?.params?.id).toBe("99");
  });
});

// ---------------------------------------------------------------------------
// createHandler — universal fetch handler (Phase 10)
// ---------------------------------------------------------------------------

describe("createHandler", () => {
  const mockCompiler = {
    render: async (src: string, ctx?: Record<string, unknown>) => {
      const contextStr = ctx ? JSON.stringify(ctx) : "{}";
      return `<html><body>${src}|ctx=${contextStr}</body></html>`;
    },
  };

  async function makeHandler(files: Record<string, string>, notFoundSrc?: string) {
    const viewsDir = "/views";
    const fileMap: Record<string, string> = {};
    for (const [rel, content] of Object.entries(files)) {
      fileMap[`${viewsDir}/${rel}`] = content;
    }

    const readFileFn = async (path: string) => {
      const normalized = path.replace(/\\/g, "/");
      const content = fileMap[normalized];
      if (!content) throw new Error(`Not found: ${path}`);
      return content;
    };

    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, Object.keys(files)));
    return createHandler(routeMap, mockCompiler, {
      readFile: readFileFn,
      ...(notFoundSrc ? { notFoundSrc } : {}),
    });
  }

  it("returns 200 with rendered HTML for a matched route", async () => {
    const handler = await makeHandler({ "index.nml": "div(Hello)" });
    const res = await handler(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("div(Hello)");
  });

  it("sets Content-Type: text/html on success", async () => {
    const handler = await makeHandler({ "index.nml": "div(Hi)" });
    const res = await handler(new Request("http://localhost/"));
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("returns 404 for an unmatched path", async () => {
    const handler = await makeHandler({ "index.nml": "div(Home)" });
    const res = await handler(new Request("http://localhost/missing"));
    expect(res.status).toBe(404);
  });

  it("uses custom notFoundSrc for 404 responses", async () => {
    const handler = await makeHandler(
      { "index.nml": "div(Home)" },
      "h1(Custom 404)"
    );
    const res = await handler(new Request("http://localhost/missing"));
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain("h1(Custom 404)");
  });

  it("injects dynamic params into render context", async () => {
    const handler = await makeHandler({ "users/[id].nml": "p(User)" });
    const res = await handler(new Request("http://localhost/users/42"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"id":"42"');
  });

  it("merges baseContext into render context", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["index.nml"]));
    const readFileFn = async () => "p(page)";
    const handler = createHandler(routeMap, mockCompiler, {
      readFile: readFileFn,
      baseContext: { appName: "MyApp" },
    });
    const res = await handler(new Request("http://localhost/"));
    const text = await res.text();
    expect(text).toContain('"appName":"MyApp"');
  });

  it("returns 404 when readFile throws (file missing on disk)", async () => {
    const viewsDir = "/views";
    const routeMap = await scanRoutes(viewsDir, mockReadDir(viewsDir, ["about.nml"]));
    const handler = createHandler(routeMap, mockCompiler, {
      readFile: async () => { throw new Error("ENOENT"); },
    });
    const res = await handler(new Request("http://localhost/about"));
    expect(res.status).toBe(404);
  });
});
