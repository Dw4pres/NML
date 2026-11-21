/**
 * @nml-lang/state — minimal client runtime for NML @state.
 *
 * Two pieces, both deliberately small:
 *
 *  - `applyAction(state, action)` — a pure function that applies ONE state
 *    action string (the `data-nml-action` contract the compiler emits) to a
 *    state object and returns a NEW state object. No VDOM, no store, no
 *    effects, no watchers, no computed values.
 *  - `mountNmlState({ render, initial, root })` — wires event delegation for
 *    `[data-nml-action]` elements; after a handled action it re-renders the
 *    view with the new state and patches the DOM.
 *
 * What this is NOT (v1 limits, by design):
 *  - No `$value` / input-value binding. `input` events are not wired; only
 *    `click`, `change`, and `submit` are handled.
 *  - No shared/global store. State is local to one mount; components share
 *    state by passing it down as props (server-rendered), not through here.
 *  - No SPA router. Server routing stays where it is.
 */

export type State = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type NmlStateErrorCode = "unknown-state" | "unsupported-form" | "type-error";

/**
 * Thrown by `applyAction` when an action cannot be applied. Carries the
 * action string and a machine-readable `code` plus a human-readable
 * `reason`, so an agent (or a human reading the console) can fix it in one
 * round instead of guessing.
 */
export class NmlStateError extends Error {
  readonly action: string;
  readonly code: NmlStateErrorCode;
  readonly reason: string;

  constructor(action: string, code: NmlStateErrorCode, reason: string) {
    super(`State action ${JSON.stringify(action)} failed: ${reason}`);
    this.name = "NmlStateError";
    this.action = action;
    this.code = code;
    this.reason = reason;
  }
}

const SUPPORTED_FORMS =
  "name++, name--, name = <literal>, name = !name, name = <arithmetic using state names and numbers>";

function unknownState(action: string, name: string): NmlStateError {
  return new NmlStateError(
    action,
    "unknown-state",
    `@state.${name} is not declared`
  );
}

function typeError(action: string, detail: string): NmlStateError {
  return new NmlStateError(action, "type-error", detail);
}

function unsupportedForm(action: string): NmlStateError {
  return new NmlStateError(
    action,
    "unsupported-form",
    `Unsupported state action. Supported forms: ${SUPPORTED_FORMS}.`
  );
}

// ---------------------------------------------------------------------------
// Action evaluator (pure)
// ---------------------------------------------------------------------------

const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * Apply ONE action string to a state object and return a NEW state object.
 * The input state is never mutated. Supported forms (mirroring the
 * compiler's validation in `classifyStateAction`, so anything the compiler
 * emits is applicable here):
 *
 *  - `name++` / `name--` (name must be a number)
 *  - `name = <literal>` — any JSON literal, or a single-quoted string
 *    (`label = 'hi'`; NML attribute values are double-quoted, so a string
 *    literal inside an action can only be written single-quoted)
 *  - `name = !name` (name must be a boolean)
 *  - `name = <arithmetic>` over state names, numeric literals, `+ - * / %`,
 *    parentheses, and unary minus
 *
 * Anything else throws `NmlStateError`.
 */
export function applyAction(state: State, action: string): State {
  const trimmed = action.trim();

  // Increment / decrement: `name++` or `name--`
  const incMatch = trimmed.match(/^([A-Za-z_$][\w$]*)\s*(\+\+|--)$/);
  if (incMatch) {
    const name = incMatch[1];
    const current = readNumber(state, name, trimmed);
    return { ...state, [name]: incMatch[2] === "++" ? current + 1 : current - 1 };
  }

  // Assignment: `name = <rhs>`
  const assignMatch = trimmed.match(/^([A-Za-z_$][\w$]*)\s*=\s*(.+)$/s);
  if (assignMatch) {
    const name = assignMatch[1];
    if (!(name in state)) throw unknownState(trimmed, name);
    const value = evalRhs(assignMatch[2].trim(), state, trimmed);
    return { ...state, [name]: value };
  }

  throw unsupportedForm(trimmed);
}

function readNumber(state: State, name: string, action: string): number {
  if (!(name in state)) throw unknownState(action, name);
  const value = state[name];
  if (typeof value !== "number") {
    throw typeError(
      action,
      `@state.${name} is ${value === null ? "null" : typeof value}, not a number`
    );
  }
  return value;
}

function evalRhs(rhs: string, state: State, action: string): unknown {
  // Negation: `!name` (name must be a boolean)
  const negMatch = rhs.match(/^!\s*([A-Za-z_$][\w$]*)$/);
  if (negMatch) {
    const name = negMatch[1];
    if (!(name in state)) throw unknownState(action, name);
    const value = state[name];
    if (typeof value !== "boolean") {
      throw typeError(
        action,
        `@state.${name} is ${value === null ? "null" : typeof value}, not a boolean`
      );
    }
    return !value;
  }

  // JSON literal: number, string, boolean, null, array, object
  try {
    return JSON.parse(rhs);
  } catch {
    // Not a JSON literal — fall through
  }

  // Single-quoted string literal (see applyAction docs for why)
  const singleQuoted = rhs.match(/^'((?:[^'\\]|\\.)*)'$/);
  if (singleQuoted) return unescapeSingleQuoted(singleQuoted[1]);

  // Arithmetic over declared state names and numeric literals
  return evalArithmetic(rhs, state, action);
}

/**
 * Unescape a single-quoted string literal. Only `\\` and `\'` are unescaped;
 * any other backslash sequence is kept literally, so `'a\nb'` stays the
 * four characters `a`, `\`, `n`, `b` rather than silently gaining a newline.
 */
function unescapeSingleQuoted(inner: string): string {
  return inner.replace(/\\(\\|')/g, "$1");
}

// ---------------------------------------------------------------------------
// Arithmetic evaluator (same grammar as the compiler's isValidArithmetic,
// but evaluating instead of only validating). Single-pass recursive descent
// over the string — no token array — to keep the runtime small.
// ---------------------------------------------------------------------------

function evalArithmetic(rhs: string, state: State, action: string): number {
  // Reject characters that can never appear in an action expression
  // (`=`, `&`, `?`, quotes, …) before any name lookup, so `count = a == b`
  // reports unsupported-form — the same verdict as the compiler — rather
  // than unknown-state for `a`.
  if (/[^0-9A-Za-z_$\s+\-*/%().]/.test(rhs)) throw unsupportedForm(action);
  let i = 0;
  const skipWs = (): void => {
    while (i < rhs.length && /\s/.test(rhs[i])) i++;
  };
  const parseExpr = (): number => {
    let value = parseTerm();
    for (;;) {
      skipWs();
      const ch = rhs[i];
      if (ch !== "+" && ch !== "-") return value;
      i++;
      const term = parseTerm();
      value = ch === "+" ? value + term : value - term;
    }
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    for (;;) {
      skipWs();
      const ch = rhs[i];
      if (ch !== "*" && ch !== "/" && ch !== "%") return value;
      i++;
      const factor = parseFactor();
      value = ch === "*" ? value * factor : ch === "/" ? value / factor : value % factor;
    }
  };
  const parseFactor = (): number => {
    skipWs();
    const ch = rhs[i];
    if (ch === undefined) throw unsupportedForm(action);
    if (ch === "(") {
      i++;
      const value = parseExpr();
      skipWs();
      if (rhs[i] !== ")") throw unsupportedForm(action);
      i++;
      return value;
    }
    if (ch === "-") {
      i++;
      return -parseFactor();
    }
    if (/\d/.test(ch)) {
      let j = i + 1;
      while (j < rhs.length && /[\d.]/.test(rhs[j])) j++;
      const num = rhs.slice(i, j);
      if (!/^\d+(\.\d+)?$/.test(num)) throw unsupportedForm(action);
      i = j;
      return Number(num);
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < rhs.length && /[\w$]/.test(rhs[j])) j++;
      const name = rhs.slice(i, j);
      // A name followed by `(` is a function call, not arithmetic.
      let k = j;
      while (k < rhs.length && /\s/.test(rhs[k])) k++;
      if (rhs[k] === "(") throw unsupportedForm(action);
      i = j;
      return readNumber(state, name, action);
    }
    throw unsupportedForm(action);
  };
  const value = parseExpr();
  skipWs();
  if (i !== rhs.length) throw unsupportedForm(action);
  return value;
}

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------

export interface MountOptions {
  /** View render function: full state in, HTML string out. */
  render: (ctx: State) => Promise<string>;
  /** Initial state — normally read from the SSR `script[data-nml-state]` payload. */
  initial: State;
  /**
   * Element the mount owns for fragment patching. Defaults to
   * `document.body`. Event delegation always listens on `document`, but only
   * actions on elements inside `root` are handled.
   */
  root?: Element;
}

export interface StateMount {
  /** Current state (a copy — mutating the return value does nothing). */
  getState(): State;
  /** Merge a partial state update and re-render. */
  setState(patch: Partial<State>): void;
  /** Remove all listeners. Safe to call twice. */
  destroy(): void;
}

/**
 * One live mount per root element. A root may only have one live mount: if a
 * mount already exists for the root (e.g. Vite HMR re-imported the view
 * module, which auto-mounted again), the old one is destroyed first so its
 * listeners cannot fire twice. The module-level registry survives .nml
 * re-imports because the state package itself is not reloaded by HMR.
 */
const MOUNTED_ROOTS = new WeakMap<Element, () => void>();

export function mountNmlState(options: MountOptions): StateMount {
  const root = options.root ?? document.body;
  const render = options.render;
  let state: State = { ...options.initial };
  let destroyed = false;

  const previousDestroy = MOUNTED_ROOTS.get(root);
  if (previousDestroy) previousDestroy();

  const update = async (): Promise<void> => {
    let html: string;
    try {
      html = await render({ ...state });
    } catch (err) {
      console.error("[nml-state] render failed:", err);
      return;
    }
    if (destroyed) return;
    patchDom(html);
  };

  /**
   * Patch strategy: if the fresh HTML is a full page (contains a `<body>`),
   * replace `document.body`'s children with the new body's children. That
   * keeps `<head>` intact — styles and scripts there survive a patch — and
   * the fresh SSR payload script comes along with the new children, so the
   * DOM stays consistent with the mounted state. Otherwise (a fragment),
   * set `root.innerHTML` to the fresh HTML.
   *
   * Focus: the id of the focused element is recorded before patching and
   * restored afterwards when an element with that id still exists. Only
   * elements with an id can be found again — an input with no id loses focus
   * and cursor position on patch. That is a known v1 limit; DOM morphing
   * (patching nodes in place instead of replacing innerHTML) is the
   * follow-up.
   */
  const patchDom = (html: string): void => {
    const activeId =
      (document.activeElement as HTMLElement | null)?.id || null;
    if (/<body[\s>]/.test(html)) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      // Collect first: doc.body.childNodes is a live list.
      const newChildren = Array.from(doc.body.childNodes);
      document.body.replaceChildren(...newChildren);
    } else {
      root.innerHTML = html;
    }
    if (activeId) {
      const el = document.getElementById(activeId) as HTMLElement | null;
      if (el) el.focus();
    }
  };

  const onEvent = (ev: Event): void => {
    if (destroyed) return;
    const target = ev.target as Element | null;
    const el = target?.closest?.("[data-nml-action]") as Element | null;
    if (!el) return;
    if (!root.contains(el)) return;
    const action = el.getAttribute("data-nml-action");
    if (!action) return;
    // data-nml-event carries the event the compiler translated the on:*
    // handler from; missing (or empty) means click.
    const eventName = el.getAttribute("data-nml-event") || "click";
    if (ev.type !== eventName) return;
    ev.preventDefault();
    let next: State;
    try {
      next = applyAction(state, action);
    } catch (err) {
      // A bad action must never break the page: log it and leave state alone.
      console.error(`[nml-state] action ${JSON.stringify(action)} failed:`, err);
      return;
    }
    state = next;
    void update();
  };

  document.addEventListener("click", onEvent);
  document.addEventListener("change", onEvent);
  document.addEventListener("submit", onEvent);

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    document.removeEventListener("click", onEvent);
    document.removeEventListener("change", onEvent);
    document.removeEventListener("submit", onEvent);
    if (MOUNTED_ROOTS.get(root) === destroy) MOUNTED_ROOTS.delete(root);
  };
  MOUNTED_ROOTS.set(root, destroy);

  // The page is already server-rendered with the initial state, so mounting
  // does not re-render — it only wires the listeners.
  return {
    getState(): State {
      return { ...state };
    },
    setState(patch: Partial<State>): void {
      state = { ...state, ...patch };
      void update();
    },
    destroy,
  };
}
