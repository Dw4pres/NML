import * as monaco from "monaco-editor";
import { nmlCompiler, NMLParserError } from "@nml-lang/compiler-ts";

// ---------------------------------------------------------------------------
// Demo NML source — showcases components, @if, @each, HTMX, pipes
// ---------------------------------------------------------------------------

const DEMO_SOURCE = `// NML Interactive Test Bench — live demo
// Edit anything on the left, preview updates instantly.
// Note: template variables use flat context keys (no dot-property access).

@define.StatCard
    @style:
        .stat { background:#1e293b; border:1px solid #334155; border-radius:10px; padding:1.25rem; }
        .stat-value { font-size:2rem; font-weight:700; color:#58a6ff; }
        .stat-label { font-size:.8rem; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-top:.25rem; }
    div.class("stat")
        div.class("stat-value") | {{ value }}
        div.class("stat-label") | {{ label }}

doctype.html
html
    head
        title | NML Test Bench
        script.src("https://unpkg.com/htmx.org@1.9.12")
        style
            | * { box-sizing:border-box; margin:0; padding:0; }
            | body { font-family:system-ui,sans-serif; background:#0f172a; color:#e2e8f0; padding:2rem; }
            | h1 { font-size:1.75rem; font-weight:800; color:#f8fafc; margin-bottom:.25rem; }
            | .subtitle { color:#64748b; font-size:.875rem; margin-bottom:2rem; }
            | .stats { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:1rem; margin-bottom:2rem; }
            | h2 { font-size:1rem; font-weight:600; color:#94a3b8; margin-bottom:1rem; text-transform:uppercase; letter-spacing:.06em; }
            | .list { display:flex; flex-direction:column; gap:.5rem; }
            | .item { background:#1e293b; border:1px solid #334155; border-radius:8px; padding:.75rem 1rem; display:flex; justify-content:space-between; align-items:center; }
            | .badge { font-size:.7rem; font-weight:700; padding:2px 8px; border-radius:4px; background:#3b82f6; color:#fff; }
            | .badge.admin { background:#8b5cf6; }
            | .badge.offline { background:#374151; color:#9ca3af; }
            | .btn { font-size:.8rem; padding:.3rem .7rem; background:#1d4ed8; color:#fff; border:none; border-radius:6px; cursor:pointer; }
            | footer { margin-top:3rem; text-align:center; font-size:.75rem; color:#334155; }
    body
        h1 | ⚡ NML Test Bench
        p.class("subtitle") | Live compiler output · Edit the source on the left

        // Stats row — each component gets flat context vars
        div.class("stats")
            @each(stats as s)
                @StatCard.value("{{ s }}").label("{{ s }}")
            @endeach

        // Team list with @if / @else for online status
        h2 | Team
        div.class("list")
            @each(team as member)
                div.class("item")
                    span | {{ member }}
                    @if(onlineSet)
                        span.class("badge") | Online
                    @else
                        span.class("badge offline") | Offline
                    @endif
                    button.hx-get("/api/profile").hx-target("#detail").hx-swap("innerHTML").class("btn") | View
            @endeach

        div.id("detail").class("item").style("margin-top:1rem;color:#475569;") | ← Click View to load profile (HTMX)
        footer | Built with NML · Zero client JS · HTMX-native
`;

// ---------------------------------------------------------------------------
// Mock context — provides data for @if / @each in the demo
// ---------------------------------------------------------------------------

const MOCK_CONTEXT = {
  stats: ["4", "261", "2.2.1", "5ms"],
  team: ["Alice Chen", "Bob Torres", "Cara Lin", "Dan Park"],
  onlineSet: true,
};

// ---------------------------------------------------------------------------
// Monaco setup
// ---------------------------------------------------------------------------

// Worker setup — required by Monaco for standalone usage with Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "editorWorkerService") {
      return new Worker(
        new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url),
        { type: "module" }
      );
    }
    return new Worker(
      new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url),
      { type: "module" }
    );
  },
};

// Register a minimal NML language (uses HTML-like tokeniser as base)
monaco.languages.register({ id: "nml" });
monaco.languages.setMonarchTokensProvider("nml", {
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/\{\{[^}]*\}\}/, "variable"],
      [/@define\.[A-Z][A-Za-z0-9]*/, "keyword.define"],
      [/@(each|endeach|if|else|endif|slot|style|include)\b/, "keyword"],
      [/@[A-Z][A-Za-z0-9]*/, "type"],
      [/doctype\.html/, "keyword"],
      [/\|/, "operator"],
      [/\.[a-zA-Z][\w-]*(?=\()/, "attribute"],
      [/"[^"]*"/, "string"],
      [/'[^']*'/, "string"],
      [/[a-z][\w-]*(?=[\s.(|]|$)/, "tag"],
    ],
  },
});

monaco.editor.defineTheme("nml-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6e7681", fontStyle: "italic" },
    { token: "keyword", foreground: "ff7b72", fontStyle: "bold" },
    { token: "keyword.define", foreground: "ffa657", fontStyle: "bold" },
    { token: "type", foreground: "d2a8ff" },
    { token: "variable", foreground: "79c0ff" },
    { token: "tag", foreground: "7ee787" },
    { token: "attribute", foreground: "e3b341" },
    { token: "operator", foreground: "ff7b72" },
    { token: "string", foreground: "a5d6ff" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#e6edf3",
    "editorLineNumber.foreground": "#3d444d",
    "editorLineNumber.activeForeground": "#8b949e",
    "editor.selectionBackground": "#264f78",
    "editor.lineHighlightBackground": "#161b22",
    "editorCursor.foreground": "#58a6ff",
    "editorIndentGuide.background1": "#21262d",
  },
});

const editor = monaco.editor.create(
  document.getElementById("editor-container")!,
  {
    value: DEMO_SOURCE,
    language: "nml",
    theme: "nml-dark",
    fontSize: 13,
    fontFamily: '"SFMono-Regular", Consolas, "Cascadia Code", monospace',
    fontLigatures: true,
    lineHeight: 22,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 4,
    insertSpaces: true,
    wordWrap: "on",
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: "line",
    smoothScrolling: true,
  }
);

// ---------------------------------------------------------------------------
// Compilation loop
// ---------------------------------------------------------------------------

const frame = document.getElementById("preview-frame") as HTMLIFrameElement;
const mTime = document.getElementById("m-time")!;
const mSize = document.getElementById("m-size")!;
const errorBadge = document.getElementById("error-badge")!;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function renderError(message: string, line?: number, col?: number): string {
  const loc = line != null ? ` — line ${line}${col != null ? `:${col}` : ""}` : "";
  return `<!DOCTYPE html><html><head><style>
    body { font-family: monospace; background: #0d1117; color: #f85149; padding: 2rem; }
    h2 { margin-bottom: .5rem; font-size: 1rem; }
    pre { font-size: .85rem; color: #ff7b72; white-space: pre-wrap; line-height: 1.6; }
  </style></head><body>
    <h2>⚠ NML Parse Error${loc}</h2>
    <pre>${message.replace(/</g, "&lt;")}</pre>
  </body></html>`;
}

async function compile(source: string): Promise<void> {
  const t0 = performance.now();
  try {
    const html = await nmlCompiler.render(source, MOCK_CONTEXT);
    const elapsed = performance.now() - t0;

    frame.srcdoc = html;
    mTime.textContent = `${elapsed.toFixed(2)}ms`;
    mSize.textContent = formatBytes(new TextEncoder().encode(html).byteLength);
    errorBadge.style.display = "none";
  } catch (err) {
    const elapsed = performance.now() - t0;
    mTime.textContent = `${elapsed.toFixed(2)}ms`;
    mSize.textContent = "—";
    errorBadge.style.display = "inline-block";

    if (err instanceof NMLParserError) {
      frame.srcdoc = renderError(
        (err as NMLParserError).message,
        (err as NMLParserError).loc?.line,
        (err as NMLParserError).loc?.column
      );
    } else {
      frame.srcdoc = renderError(String(err));
    }
  }
}

// Debounced listener
let debounce: ReturnType<typeof setTimeout> | null = null;
editor.onDidChangeModelContent(() => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => compile(editor.getValue()), 50);
});

// Initial compile
compile(DEMO_SOURCE);
