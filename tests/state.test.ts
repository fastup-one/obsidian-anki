import { describe, expect, it } from "vitest";
import type { PluginState } from "../src/domain";
import { hydrateState, newState } from "../src/state";

describe("plugin state hydration", () => {
  it("backs the cards map with a null prototype", () => {
    expect(Object.getPrototypeOf(newState().cards)).toBe(null);
  });

  it("does not pollute Object.prototype when a card key is __proto__", () => {
    const state = newState();
    // Reproduce what reconcileKeys does: read, then write, via an attacker-chosen key.
    const key = "__proto__";
    expect(state.cards[key]).toBeUndefined();
    state.cards[key] = { noteId: 1, fingerprint: "" };
    // The write must land as an ordinary own entry, not on the global prototype.
    expect(({} as Record<string, unknown>).filePath).toBeUndefined();
    expect(Object.getPrototypeOf(state.cards)).toBe(null);
    expect(state.cards[key]?.noteId).toBe(1);
  });

  it("drops reserved keys from previously persisted state", () => {
    const persisted = {
      version: 1,
      cards: JSON.parse(
        '{"real":{"noteId":5,"fingerprint":"x"},' +
          '"__proto__":{"noteId":9,"fingerprint":"y"}}',
      ),
    } as PluginState;
    const state = hydrateState(persisted);
    expect(state.cards.real?.noteId).toBe(5);
    expect(Object.prototype.hasOwnProperty.call(state.cards, "__proto__")).toBe(
      false,
    );
    expect(Object.getPrototypeOf(state.cards)).toBe(null);
  });

  it("preserves ordinary card entries unchanged", () => {
    const persisted: PluginState = {
      version: 1,
      cards: { af1: { noteId: 3, fingerprint: "z", filePath: "n.md" } },
    };
    expect(hydrateState(persisted).cards.af1).toEqual({
      noteId: 3,
      fingerprint: "z",
      filePath: "n.md",
    });
  });
});
