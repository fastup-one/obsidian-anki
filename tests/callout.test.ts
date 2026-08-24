import { describe, expect, it } from "vitest";
import { applyRemoteCards, insertMarkers, parseMarkdown } from "../src/parser";
import { renderCard } from "../src/render";

const one = (s: string) => parseMarkdown(s).cards[0]!;
const extraOf = (card: Parameters<typeof renderCard>[0], link = "obsidian://x") =>
  (renderCard(card, link) as Record<string, string>).Extra;

describe("callout cards", () => {
  it("parses a basic callout into front/back", () => {
    const card = one("> [!anki]\n> Question\n> ---\n> Answer\n^af-k\n");
    expect(card.sourceStyle).toBe("callout");
    expect(card.kind).toBe("basic");
    expect(card.front).toBe("Question");
    expect(card.back).toBe("Answer");
    expect(card.key).toBe("k");
    expect(card.extra).toBeUndefined();
  });

  it("keeps multi-line front, back, and extra sections", () => {
    const card = one(
      "> [!anki]\n> F1\n> F2\n> ---\n> B1\n> B2\n> ---\n> E1\n> E2\n^af-x\n",
    );
    expect(card.front).toBe("F1\nF2");
    expect(card.back).toBe("B1\nB2");
    expect(card.extra).toBe("E1\nE2");
  });

  it("marks [!anki|reverse] and [!anki-reverse] as reversed", () => {
    expect(one("> [!anki|reverse]\n> A\n> ---\n> B\n").kind).toBe("reversed");
    expect(one("> [!anki-reverse]\n> A\n> ---\n> B\n").kind).toBe("reversed");
  });

  it("tolerates fold markers on the callout header", () => {
    expect(one("> [!anki]-\n> A\n> ---\n> B\n").front).toBe("A");
    expect(one("> [!anki]+\n> A\n> ---\n> B\n").back).toBe("B");
  });

  it("ignores a non-anki callout", () => {
    expect(parseMarkdown("> [!note]\n> Not a card\n").cards).toHaveLength(0);
  });

  it("stops at the first line that leaves the callout", () => {
    const doc = parseMarkdown("> [!anki]\n> Q\n> ---\n> A\n\nParagraph.\n");
    expect(doc.cards).toHaveLength(1);
    expect(doc.cards[0]!.back).toBe("A");
  });

  it("skips an incomplete callout without blocking the note's sync", () => {
    const doc = parseMarkdown("> [!anki]\n> Only a front\n");
    expect(doc.cards).toHaveLength(0);
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("uses the callout title as the front and preserves it on pull", () => {
    const source = "> [!anki] What is WIF?\n> ---\n> Federation\n^af-k\n";
    const card = one(source);
    expect(card.front).toBe("What is WIF?");
    expect(card.back).toBe("Federation");
    const pulled = applyRemoteCards(source, [
      { card, value: { kind: "basic", front: "What is WIF?", back: "WIF", tags: [] } },
    ]);
    expect(one(pulled).front).toBe("What is WIF?");
    expect(one(pulled).back).toBe("WIF");
  });

  it("keeps content past a third divider in Extra rather than dropping it", () => {
    const source = "> [!anki]\n> Q\n> ---\n> A\n> ---\n> E1\n> ---\n> E2\n^af-k\n";
    const card = one(source);
    expect(card.front).toBe("Q");
    expect(card.back).toBe("A");
    expect(card.extra).toBe("E1\n---\nE2");
    const pulled = applyRemoteCards(source, [
      { card, value: { kind: "basic", front: "Q", back: "A", tags: [] } },
    ]);
    expect(one(pulled).extra).toBe("E1\n---\nE2");
  });

  it("does not let a preceding #card swallow a marked callout or steal its key", () => {
    const doc = parseMarkdown(
      "New question #card\nThe answer\n> [!anki]\n> Q2\n> ---\n> A2\n^af-existing\n",
    );
    expect(doc.cards).toHaveLength(2);
    const tagged = doc.cards.find((c) => c.sourceStyle === "tagged")!;
    const callout = doc.cards.find((c) => c.sourceStyle === "callout")!;
    expect(tagged.back).toBe("The answer");
    expect(tagged.key).toBeUndefined();
    expect(callout.key).toBe("existing");
    expect(callout.front).toBe("Q2");
  });

  it("does not split a --- inside a fenced code block", () => {
    const source =
      "> [!anki]\n> Q\n> ---\n> ```\n> name\n> ---\n> value\n> ```\n^af-k\n";
    const card = one(source);
    expect(card.back).toBe("```\nname\n---\nvalue\n```");
    expect(card.extra).toBeUndefined();
    const pulled = applyRemoteCards(source, [
      {
        card,
        value: {
          kind: "basic",
          front: "Q",
          back: "```\nname\n---\nvalue\n```",
          tags: [],
        },
      },
    ]);
    expect(one(pulled).back).toBe("```\nname\n---\nvalue\n```");
  });

  it("isolates an unbalanced $$ inside a callout body", () => {
    const doc = parseMarkdown(
      "> [!anki]\n> Cost is $$5\n> ---\n> Five dollars\n^af-k\nNext :: Card\n^af-n\n",
    );
    expect(doc.diagnostics).toHaveLength(0);
    expect(doc.cards.map((c) => c.key).sort()).toEqual(["k", "n"]);
  });

  it("inserts a marker directly after the callout block", () => {
    const source = "> [!anki]\n> Q\n> ---\n> A\n";
    const card = one(source);
    const { source: marked } = insertMarkers(source, [card], () => "k1");
    expect(marked).toBe("> [!anki]\n> Q\n> ---\n> A\n^af-k1\n");
    expect(one(marked).key).toBe("k1");
  });

  it("renders CONTEXT with no extra section and custom text when present", () => {
    expect(extraOf(one("> [!anki]\n> Q\n> ---\n> A\n"))).toContain("CONTEXT");
    expect(extraOf(one("> [!anki]\n> Q\n> ---\n> A\n> ---\n> note\n"))).toContain(
      "note",
    );
  });

  it("survives a pull rewrite (front, back, extra, kind, quoting)", () => {
    const source =
      "> [!anki|reverse]\n> Q1\n> Q2\n> ---\n> Old\n> ---\n> keep\n^af-k\n";
    const card = one(source);
    const pulled = applyRemoteCards(source, [
      {
        card,
        value: { kind: "reversed", front: "Q1\nQ2", back: "New", tags: [] },
      },
    ]);
    const reparsed = one(pulled);
    expect(reparsed.sourceStyle).toBe("callout");
    expect(reparsed.kind).toBe("reversed");
    expect(reparsed.front).toBe("Q1\nQ2");
    expect(reparsed.back).toBe("New");
    expect(reparsed.extra).toBe("keep");
    expect(reparsed.key).toBe("k");
  });
});
