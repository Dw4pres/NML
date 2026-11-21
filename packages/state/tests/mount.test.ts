import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountNmlState, type State } from "../src/index.js";

// Flush pending microtasks/macrotasks so async re-renders land.
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("mountNmlState — basics", () => {
  it("mounts without re-rendering (page is already SSR'd)", async () => {
    document.body.innerHTML = "<p>Count: 0</p>";
    const render = vi.fn(async (_ctx: State) => "<p>Count: 99</p>");
    const mount = mountNmlState({ render, initial: { count: 0 } });
    await flush();
    expect(render).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toBe("<p>Count: 0</p>");
    expect(mount.getState()).toEqual({ count: 0 });
    mount.destroy();
  });

  it("getState returns a copy — mutating it does not affect mounted state", () => {
    const mount = mountNmlState({
      render: async () => "",
      initial: { count: 1 },
    });
    const state = mount.getState();
    state.count = 99;
    expect(mount.getState()).toEqual({ count: 1 });
    mount.destroy();
  });

  it("setState merges and re-renders", async () => {
    document.body.innerHTML = "<p>Count: 0</p>";
    const render = vi.fn(async (ctx: State) => `<p>Count: ${ctx.count}</p>`);
    const mount = mountNmlState({ render, initial: { count: 0 } });
    mount.setState({ count: 5 });
    await flush();
    expect(document.body.innerHTML).toBe("<p>Count: 5</p>");
    expect(mount.getState()).toEqual({ count: 5 });
    mount.destroy();
  });
});

describe("mountNmlState — actions", () => {
  function counterPage(): void {
    document.body.innerHTML =
      '<p id="count-label">Count: 0</p>' +
      '<button id="inc" data-nml-action="count++" data-nml-event="click">Increment</button>' +
      '<button id="reset" data-nml-action="count = 0" data-nml-event="click">Reset</button>';
  }

  function renderCounter(ctx: State): Promise<string> {
    return Promise.resolve(
      `<p id="count-label">Count: ${ctx.count}</p>` +
        `<button id="inc" data-nml-action="count++" data-nml-event="click">Increment</button>` +
        `<button id="reset" data-nml-action="count = 0" data-nml-event="click">Reset</button>`
    );
  }

  it("click increments and the DOM updates", async () => {
    counterPage();
    const mount = mountNmlState({ render: renderCounter, initial: { count: 0 } });
    click(document.getElementById("inc")!);
    await flush();
    expect(document.getElementById("count-label")!.textContent).toBe("Count: 1");
    expect(mount.getState()).toEqual({ count: 1 });
    click(document.getElementById("inc")!);
    await flush();
    expect(document.getElementById("count-label")!.textContent).toBe("Count: 2");
    mount.destroy();
  });

  it("handles clicks on children of the action element", async () => {
    document.body.innerHTML =
      '<button id="inc" data-nml-action="count++" data-nml-event="click"><span id="inner">+</span></button>';
    const mount = mountNmlState({
      render: async (ctx: State) =>
        `<button id="inc" data-nml-action="count++" data-nml-event="click"><span id="inner">+</span></button><p>${ctx.count}</p>`,
      initial: { count: 0 },
    });
    click(document.getElementById("inner")!);
    await flush();
    expect(mount.getState()).toEqual({ count: 1 });
    mount.destroy();
  });

  it("ignores a click when data-nml-event says otherwise", async () => {
    document.body.innerHTML =
      '<button id="t" data-nml-action="open = !open" data-nml-event="change">Toggle</button>';
    const render = vi.fn(async (_ctx: State) => "<p>noop</p>");
    const mount = mountNmlState({ render, initial: { open: false } });
    click(document.getElementById("t")!);
    await flush();
    expect(mount.getState()).toEqual({ open: false });
    expect(render).not.toHaveBeenCalled();
    mount.destroy();
  });

  it("defaults to click when data-nml-event is missing", async () => {
    document.body.innerHTML =
      '<button id="inc" data-nml-action="count++">Increment</button>';
    const mount = mountNmlState({
      render: async (ctx: State) =>
        `<button id="inc" data-nml-action="count++">Increment</button><p>${ctx.count}</p>`,
      initial: { count: 0 },
    });
    click(document.getElementById("inc")!);
    await flush();
    expect(mount.getState()).toEqual({ count: 1 });
    mount.destroy();
  });

  it("change toggles a checkbox", async () => {
    document.body.innerHTML =
      '<input id="done" type="checkbox" data-nml-action="done = !done" data-nml-event="change">';
    const mount = mountNmlState({
      render: async (ctx: State) =>
        `<input id="done" type="checkbox" data-nml-action="done = !done" data-nml-event="change"${ctx.done ? " checked" : ""}>`,
      initial: { done: false },
    });
    const input = document.getElementById("done") as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    expect(mount.getState()).toEqual({ done: true });
    expect((document.getElementById("done") as HTMLInputElement).checked).toBe(true);
    mount.destroy();
  });

  it("submit preventDefaults and applies the action", async () => {
    document.body.innerHTML =
      '<form id="f" data-nml-action="count = 0" data-nml-event="submit"><button>Reset</button></form>';
    const mount = mountNmlState({
      render: async (ctx: State) =>
        `<form id="f" data-nml-action="count = 0" data-nml-event="submit"><button>Reset</button></form><p>${ctx.count}</p>`,
      initial: { count: 7 },
    });
    const form = document.getElementById("f")!;
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    await flush();
    expect(ev.defaultPrevented).toBe(true);
    expect(mount.getState()).toEqual({ count: 0 });
    mount.destroy();
  });

  it("leaves clicks on elements without data-nml-action alone", async () => {
    document.body.innerHTML = '<button id="plain">Plain</button>';
    const render = vi.fn(async (_ctx: State) => "<p>noop</p>");
    const mount = mountNmlState({ render, initial: { count: 0 } });
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.getElementById("plain")!.dispatchEvent(ev);
    await flush();
    expect(ev.defaultPrevented).toBe(false);
    expect(mount.getState()).toEqual({ count: 0 });
    expect(render).not.toHaveBeenCalled();
    mount.destroy();
  });

  it("logs and ignores a failing action without breaking state", async () => {
    document.body.innerHTML =
      '<button id="bad" data-nml-action="count++" data-nml-event="click">Bad</button>';
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // count is a string, so count++ is a type error at runtime
    const render = vi.fn(async (_ctx: State) => "<p>noop</p>");
    const mount = mountNmlState({ render, initial: { count: "zero" } });
    click(document.getElementById("bad")!);
    await flush();
    expect(mount.getState()).toEqual({ count: "zero" });
    expect(render).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    mount.destroy();
  });
});

describe("mountNmlState — patching and focus", () => {
  it("replaces body children on a full-page re-render, keeping head intact", async () => {
    document.head.innerHTML = '<style id="keep-me">p{color:red}</style>';
    document.body.innerHTML =
      '<p>Count: 0</p><button id="inc" data-nml-action="count++" data-nml-event="click">+</button>';
    const mount = mountNmlState({
      render: async (ctx: State) =>
        `<!DOCTYPE html><html><head><title>t</title></head><body><p>Count: ${ctx.count}</p><button id="inc" data-nml-action="count++" data-nml-event="click">+</button><script type="application/json" data-nml-state>{"count":${ctx.count}}</script></body></html>`,
      initial: { count: 0 },
    });
    click(document.getElementById("inc")!);
    await flush();
    expect(document.body.textContent).toContain("Count: 1");
    expect(document.getElementById("keep-me")).not.toBeNull();
    expect(document.title).toBe("");
    expect(document.querySelector("script[data-nml-state]")!.textContent).toBe(
      '{"count":1}'
    );
    mount.destroy();
  });

  it("sets root.innerHTML for fragment renders", async () => {
    const root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
    const mount = mountNmlState({
      render: async (ctx: State) =>
        `<p>Count: ${ctx.count}</p><button data-nml-action="count++" data-nml-event="click">+</button>`,
      initial: { count: 0 },
      root,
    });
    mount.setState({ count: 3 });
    await flush();
    expect(root.innerHTML).toContain("Count: 3");
    mount.destroy();
  });

  it("restores focus to the element with the same id after patching", async () => {
    document.body.innerHTML =
      '<input id="name" value="Al"><button id="inc" data-nml-action="count++" data-nml-event="click">+</button>';
    const mount = mountNmlState({
      render: async (ctx: State) =>
        `<input id="name" value="Al"><button id="inc" data-nml-action="count++" data-nml-event="click">+</button><p>${ctx.count}</p>`,
      initial: { count: 0 },
    });
    (document.getElementById("name") as HTMLInputElement).focus();
    expect(document.activeElement?.id).toBe("name");
    click(document.getElementById("inc")!);
    await flush();
    expect(document.activeElement?.id).toBe("name");
    mount.destroy();
  });

  it("destroy removes listeners so later clicks do nothing", async () => {
    document.body.innerHTML =
      '<button id="inc" data-nml-action="count++" data-nml-event="click">+</button>';
    const render = vi.fn(async (_ctx: State) => "<p>noop</p>");
    const mount = mountNmlState({ render, initial: { count: 0 } });
    mount.destroy();
    mount.destroy(); // safe to call twice
    click(document.getElementById("inc")!);
    await flush();
    expect(mount.getState()).toEqual({ count: 0 });
    expect(render).not.toHaveBeenCalled();
  });

  it("remounting the same root destroys the previous mount (no double actions)", async () => {
    document.body.innerHTML =
      '<button id="inc" data-nml-action="count++" data-nml-event="click">+</button>';
    const render = async (ctx: State) =>
      `<button id="inc" data-nml-action="count++" data-nml-event="click">+</button><p>${ctx.count}</p>`;
    const first = mountNmlState({ render, initial: { count: 0 } });
    const second = mountNmlState({ render, initial: { count: 10 } });
    click(document.getElementById("inc")!);
    await flush();
    // Only the second mount's listener fired: 10 -> 11, not 0 -> 1 -> 11.
    expect(second.getState()).toEqual({ count: 11 });
    expect(first.getState()).toEqual({ count: 0 });
    second.destroy();
  });
});
