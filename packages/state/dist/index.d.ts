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
export type NmlStateErrorCode = "unknown-state" | "unsupported-form" | "type-error";
/**
 * Thrown by `applyAction` when an action cannot be applied. Carries the
 * action string and a machine-readable `code` plus a human-readable
 * `reason`, so an agent (or a human reading the console) can fix it in one
 * round instead of guessing.
 */
export declare class NmlStateError extends Error {
    readonly action: string;
    readonly code: NmlStateErrorCode;
    readonly reason: string;
    constructor(action: string, code: NmlStateErrorCode, reason: string);
}
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
export declare function applyAction(state: State, action: string): State;
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
export declare function mountNmlState(options: MountOptions): StateMount;
//# sourceMappingURL=index.d.ts.map