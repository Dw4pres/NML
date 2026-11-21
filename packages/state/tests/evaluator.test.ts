import { describe, it, expect } from "vitest";
import { applyAction, NmlStateError } from "../src/index.js";

describe("applyAction — increment / decrement", () => {
  it("increments a number", () => {
    expect(applyAction({ count: 0 }, "count++")).toEqual({ count: 1 });
    expect(applyAction({ count: 41 }, "count++")).toEqual({ count: 42 });
  });

  it("decrements a number", () => {
    expect(applyAction({ count: 1 }, "count--")).toEqual({ count: 0 });
    expect(applyAction({ count: 0 }, "count--")).toEqual({ count: -1 });
  });

  it("tolerates whitespace", () => {
    expect(applyAction({ count: 0 }, "  count++  ")).toEqual({ count: 1 });
    expect(applyAction({ count: 0 }, "count ++")).toEqual({ count: 1 });
  });

  it("throws unknown-state for an undeclared name", () => {
    expect(() => applyAction({}, "count++")).toThrow(NmlStateError);
    try {
      applyAction({}, "count++");
    } catch (err) {
      expect(err).toBeInstanceOf(NmlStateError);
      expect((err as NmlStateError).code).toBe("unknown-state");
      expect((err as NmlStateError).action).toBe("count++");
    }
  });

  it("throws type-error for ++ on a non-number", () => {
    expect(() => applyAction({ label: "hi" }, "label++")).toThrow(NmlStateError);
    try {
      applyAction({ label: "hi" }, "label++");
    } catch (err) {
      expect((err as NmlStateError).code).toBe("type-error");
    }
    expect(() => applyAction({ done: true }, "done++")).toThrow(NmlStateError);
    expect(() => applyAction({ items: [] }, "items++")).toThrow(NmlStateError);
  });
});

describe("applyAction — assignment literals", () => {
  it("assigns JSON literals", () => {
    expect(applyAction({ count: 0 }, "count = 5")).toEqual({ count: 5 });
    expect(applyAction({ count: 0 }, "count = -3")).toEqual({ count: -3 });
    expect(applyAction({ count: 0 }, "count = 1.5")).toEqual({ count: 1.5 });
    expect(applyAction({ open: false }, "open = true")).toEqual({ open: true });
    expect(applyAction({ label: "a" }, "label = null")).toEqual({ label: null });
    expect(applyAction({ items: [] }, 'items = ["a", "b"]')).toEqual({
      items: ["a", "b"],
    });
    expect(applyAction({ user: {} }, 'user = {"name": "Al"}')).toEqual({
      user: { name: "Al" },
    });
  });

  it("assigns double-quoted JSON strings", () => {
    expect(applyAction({ label: "a" }, 'label = "hi"')).toEqual({ label: "hi" });
  });

  it("assigns single-quoted string literals", () => {
    expect(applyAction({ label: "a" }, "label = 'hi'")).toEqual({ label: "hi" });
    expect(applyAction({ label: "a" }, "label = 'it\\'s'")).toEqual({
      label: "it's",
    });
    expect(applyAction({ label: "a" }, "label = 'a\\\\b'")).toEqual({
      label: "a\\b",
    });
    // Other backslash sequences stay literal
    expect(applyAction({ label: "a" }, "label = 'a\\nb'")).toEqual({
      label: "a\\nb",
    });
  });

  it("assigns a state value to another state name", () => {
    expect(applyAction({ count: 3, total: 0 }, "total = count")).toEqual({
      count: 3,
      total: 3,
    });
  });

  it("throws unknown-state when assigning to an undeclared name", () => {
    try {
      applyAction({ count: 0 }, "other = 1");
      expect.unreachable();
    } catch (err) {
      expect((err as NmlStateError).code).toBe("unknown-state");
    }
  });
});

describe("applyAction — negation", () => {
  it("negates a boolean", () => {
    expect(applyAction({ open: false }, "open = !open")).toEqual({ open: true });
    expect(applyAction({ open: true }, "open = !open")).toEqual({ open: false });
    expect(applyAction({ open: false }, "open = ! open")).toEqual({ open: true });
  });

  it("throws type-error for ! on a non-boolean", () => {
    try {
      applyAction({ count: 0 }, "count = !count");
      expect.unreachable();
    } catch (err) {
      expect((err as NmlStateError).code).toBe("type-error");
    }
  });

  it("throws unknown-state for ! on an undeclared name", () => {
    try {
      applyAction({}, "open = !missing");
      expect.unreachable();
    } catch (err) {
      expect((err as NmlStateError).code).toBe("unknown-state");
    }
  });
});

describe("applyAction — arithmetic", () => {
  const state = { count: 10, total: 3 };

  it("evaluates + - * / % with correct precedence", () => {
    expect(applyAction(state, "count = count + 1")).toEqual({ count: 11, total: 3 });
    expect(applyAction(state, "count = count - total")).toEqual({ count: 7, total: 3 });
    expect(applyAction(state, "count = count * 2 + 1")).toEqual({ count: 21, total: 3 });
    expect(applyAction(state, "count = count + 2 * 3")).toEqual({ count: 16, total: 3 });
    expect(applyAction(state, "count = (count + 1) * 2")).toEqual({ count: 22, total: 3 });
    expect(applyAction(state, "count = total % 2")).toEqual({ count: 1, total: 3 });
    expect(applyAction(state, "count = count / 4")).toEqual({ count: 2.5, total: 3 });
    expect(applyAction(state, "count = -count")).toEqual({ count: -10, total: 3 });
    expect(applyAction(state, "count = -(count + 2)")).toEqual({ count: -12, total: 3 });
    expect(applyAction(state, "count = count + 1 - 2")).toEqual({ count: 9, total: 3 });
    expect(applyAction(state, "count = 2 * (3 + total)")).toEqual({ count: 12, total: 3 });
  });

  it("throws unknown-state for an undeclared name in arithmetic", () => {
    try {
      applyAction(state, "count = missing + 1");
      expect.unreachable();
    } catch (err) {
      expect((err as NmlStateError).code).toBe("unknown-state");
    }
  });

  it("throws type-error for arithmetic on a non-number", () => {
    try {
      applyAction({ label: "hi", count: 0 }, "count = label + 1");
      expect.unreachable();
    } catch (err) {
      expect((err as NmlStateError).code).toBe("type-error");
    }
  });
});

describe("applyAction — unsupported forms", () => {
  it("throws unsupported-form with the action attached", () => {
    const bad = ["count + 1", "count += 1", "count = foo()", "count = a == b", "count"];
    for (const action of bad) {
      try {
        applyAction({ count: 0 }, action);
        expect.unreachable(`expected ${action} to throw`);
      } catch (err) {
        expect(err).toBeInstanceOf(NmlStateError);
        expect((err as NmlStateError).code).toBe("unsupported-form");
        expect((err as NmlStateError).action).toBe(action.trim());
        expect((err as NmlStateError).reason).toContain("Supported forms");
      }
    }
  });

  it("does not mutate the input state", () => {
    const state = { count: 0, items: ["a"] };
    const next = applyAction(state, "count++");
    expect(state).toEqual({ count: 0, items: ["a"] });
    expect(next).toEqual({ count: 1, items: ["a"] });
    expect(next).not.toBe(state);
  });
});
