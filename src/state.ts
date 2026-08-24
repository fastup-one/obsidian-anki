import type { PluginState } from "./domain";

// state.cards is a hash map keyed by Forge keys taken from note text (the
// "^af-<key>" marker), so its keys are untrusted. A plain object literal would let a
// "^af-__proto__" marker resolve state.cards["__proto__"] to Object.prototype and
// pollute it globally, so back the map with a null-prototype object and drop reserved
// keys from any state that was persisted before this fix.
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function newState(): PluginState {
  return { version: 1, cards: Object.create(null) as PluginState["cards"] };
}

export function hydrateState(persisted: PluginState | undefined): PluginState {
  const state = newState();
  if (persisted?.cards)
    for (const [key, value] of Object.entries(persisted.cards))
      if (!RESERVED_KEYS.has(key)) state.cards[key] = value;
  return state;
}
