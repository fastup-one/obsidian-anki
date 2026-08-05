import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));
import { requestUrl } from "obsidian";
import { AnkiClient, AnkiError } from "../src/anki";

describe("AnkiConnect transport", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("validates successful responses", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      json: { result: 6, error: null },
    } as never);
    await expect(new AnkiClient().version()).resolves.toBe(6);
  });
  it("surfaces action-specific protocol errors", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      json: { result: null, error: "duplicate" },
    } as never);
    await expect(
      new AnkiClient().addNote({
        deckName: "D",
        modelName: "M",
        fields: {},
        tags: [],
        options: { allowDuplicate: false },
      }),
    ).rejects.toMatchObject({
      action: "addNote",
      message: "duplicate",
    } satisfies Partial<AnkiError>);
  });
});
