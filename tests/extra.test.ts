import { describe, expect, it } from "vitest";
import { applyRemoteCards, parseMarkdown } from "../src/parser";
import { fingerprint, renderCard } from "../src/render";

const first = (source: string) => parseMarkdown(source).cards[0]!;

const fields = (card: ReturnType<typeof parseMarkdown>["cards"][number], link: string, include?: boolean) =>
  renderCard(card, link, include) as Record<string, string>;

describe("per-card Extra", () => {
  it("extracts an Extra comment and keeps it out of Front/Back", () => {
    const card = parseMarkdown(
      "Term :: Definition <!--extra: see the runbook-->\n",
    ).cards[0]!;
    expect(card.front).toBe("Term");
    expect(card.back).toBe("Definition");
    expect(card.extra).toBe("see the runbook");
  });

  it("still detects a reversed card that carries an Extra comment", () => {
    const card = parseMarkdown(
      "Term ::: Definition <!--extra: note-->\n",
    ).cards[0]!;
    expect(card.kind).toBe("reversed");
    expect(card.back).toBe("Definition");
    expect(card.extra).toBe("note");
  });

  it("renders custom Extra text when provided", () => {
    const card = parseMarkdown("Term :: Definition <!--extra: my note-->\n")
      .cards[0]!;
    const f = fields(card, "obsidian://x");
    expect(f.Extra).toContain("my note");
    expect(f.Extra).not.toContain("CONTEXT");
  });

  it("defaults to a CONTEXT backlink when no Extra is declared", () => {
    const card = parseMarkdown("Term :: Definition\n").cards[0]!;
    const f = fields(card, "obsidian://vault/file");
    expect(f.Extra).toContain("CONTEXT");
    expect(f.Extra).toContain("obsidian://");
    expect(f.Extra).not.toContain("Open source note");
  });

  it("leaves Extra empty when disabled, even with heading context", () => {
    const card = first("# Topic\nTerm :: Definition <!--extra: ignored-->\n");
    expect(card.context).toContain("Topic");
    expect(fields(card, "obsidian://x", false).Extra).toBe("");
  });

  it("changes the fingerprint when only the Extra changes", () => {
    const a = first("Term :: Definition <!--extra: one-->\n");
    const b = first("Term :: Definition <!--extra: two-->\n");
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it("changes the fingerprint when the feature is toggled", () => {
    const card = first("# Topic\nTerm :: Definition\n");
    expect(fingerprint(card, true)).not.toBe(fingerprint(card, false));
  });

  it("ignores an extra comment inside an inline code span", () => {
    const card = first("How to :: Write `<!--extra: x-->` in a note\n");
    expect(card.extra).toBeUndefined();
    expect(card.back).toContain("<!--extra: x-->");
  });

  it("still reads an extra comment whose text contains a code span", () => {
    const card = first("Term :: Definition <!--extra: run `npm ci` first-->\n");
    expect(card.extra).toBe("run `npm ci` first");
    expect(card.back).toBe("Definition");
  });

  it("preserves the Extra comment when a remote edit is written back", () => {
    const source = "Term :: Definition <!--extra: keep me-->\n^af-k\n";
    const card = parseMarkdown(source).cards[0]!;
    const pulled = applyRemoteCards(source, [
      {
        card,
        value: { kind: "basic", front: "Term", back: "Updated", tags: [] },
      },
    ]);
    const reparsed = parseMarkdown(pulled).cards[0]!;
    expect(reparsed.back).toBe("Updated");
    expect(reparsed.extra).toBe("keep me");
  });
});
