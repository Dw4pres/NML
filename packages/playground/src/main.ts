import * as monaco from "monaco-editor";
import { nmlCompiler, NMLParserError } from "@nml-lang/compiler-ts";

// ---------------------------------------------------------------------------
// Demo NML source — showcases components, @if, @each, HTMX, pipes
// ---------------------------------------------------------------------------

const DEMO_SOURCE = `// NML Interactive Test Bench — live demo
// Edit anything on the left, preview updates in real time.

@define.UserCard
    div.class("card")
        div.class("card-header")
            h3 | {{ name }}
            span.class("role-badge") | {{ role|uppercase }}
        div.class("card-body")
            p | {{ bio|default("No bio provided.") }}
        div.class("card-footer")
            button.hx-get("/api/users/{{ name }}").hx-target("#detail").class("btn") | View Profile
            @if(active)
                span.class("status active") | ● Online
            @else
                span.class("status") | ○ Offline
            @endif

doctype.html
html
    head
        title | NML Test Bench — Live Preview
        style
            | * { box-sizing: border-box; margin: 0; padding: 0; }
            | body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
            | h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: .25rem; color: #f8fafc; }
            | .subtitle { color: #94a3b8; margin-bottom: 2rem; font-size: .875rem; }
            | .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
            | .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow: hidden; }
            | .card-header { padding: .875rem 1rem; background: #0f172a; display: flex; justify-content: space-between; align-items: center; }
            | .card-header h3 { font-size: 1rem; font-weight: 600; }
            | .role-badge { font-size: .65rem; font-weight: 700; text-transform: uppercase; padding: 2px 8px; background: #3b82f6; color: #fff; border-radius: 4px; letter-spacing: .06em; }
            | .card-body { padding: 1rem; font-size: .875rem; color: #94a3b8; }
            | .card-footer { padding: .75rem 1rem; border-top: 1px solid #334155; display: flex; gap: .5rem; align-items: center; }
            | .btn { font-size: .8rem; padding: .35rem .75rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; }
            | .btn:hover { background: #2563eb; }
            | .status { font-size: .75rem; color: #64748b; margin-left: auto; }
            | .status.active { color: #22c55e; }
            | #detail { margin-top: 2rem; padding: 1rem; background: #1e293b; border-radius: 10px; min-height: 60px; color: #94a3b8; font-size: .875rem; }
            | footer { margin-top: 3rem; text-align: center; font-size: .75rem; color: #475569; }
    body
        h1 | Team Directory
        p.class("subtitle") | Rendered by NML compiler · HTMX-ready attributes pre-wired
        div.class("grid")
            @each(users as user)
                @UserCard.name("{{ user.name }}").role("{{ user.role }}").bio("{{ user.bio }}").active("{{ user.active }}")
            @endeach
        div.id("detail") | ← Click "View Profile" (requires HTMX in production)
        footer | Built with ⚡ NML · Zero client-side JS bundled
`;

// ---------------------------------------------------------------------------
// Mock context — provides data for @if / @each in the demo
// ---------------------------------------------------------------------------

const MOCK_CONTEXT = {
  users: [
    { name: "Alice Chen", role: "Admin", bio: "Platform architect and NML core contributor.", active: true },
    { name: "Bob Torres", role: "Engineer", bio: "Full-stack developer specialising in edge deployments.", active: true },
    { name: "Cara Lin", role: "Designer", bio: "UX lead. Builds design systems with zero bloat.", active: false },
    { name: "Dan Park", role: "DevRel", bio: "", active: true },
  ],
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
