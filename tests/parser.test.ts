import { describe, expect, it } from "vitest";
import {
  applyRemoteCards,
  insertMarkers,
  parseMarkdown,
  separateInlineForgeMarkers,
} from "../src/parser";
import { extractMediaPaths } from "../src/media";
import { markdownToAnki, renderCard } from "../src/render";

describe("Markdown scanner", () => {
  it("preserves spaces in embedded media paths", () => {
    expect(
      extractMediaPaths("![[Pasted image 20260805144412.png|323]]"),
    ).toEqual(["Pasted image 20260805144412.png"]);
  });
  it("renders wiki images as HTML elements rather than escaped markup", () => {
    const html = markdownToAnki("![[Pasted image 20260805144412.png|323]]");
    expect(html).toContain('<img src="pasted%20image%2020260805144412.png"');
    expect(html).not.toContain("&lt;img");
  });
  it("keeps cloze syntax only in the visible cloze field", () => {
    const card = parseMarkdown("Learn {1:this} and {2:that}\n").cards[0]!;
    const fields = renderCard(card, "obsidian://source");
    expect(fields).not.toHaveProperty("ForgeMarkdown");
    expect("Cloze" in fields && fields.Cloze).toContain("{{c1::this}}");
  });
  it("parses compatible card styles and context", () => {
    const doc = parseMarkdown(
      `---\nanki-deck: Study::Biology\ntags: #school #bio/cells\n---\n# Cells\nMitochondria::Powerhouse #exam\nCapital of France:::Paris\nRemember ==ATP==\nPrompt only #card-spaced\n`,
    );
    expect(doc.deck).toBe("Study::Biology");
    expect(doc.cards.map((c) => c.kind)).toEqual([
      "basic",
      "reversed",
      "cloze",
      "spaced",
    ]);
    expect(doc.cards[0]?.context).toEqual(["Cells"]);
    expect(doc.cards[0]?.tags).toEqual(["school", "bio::cells", "exam"]);
    expect(doc.cards[2]?.front).toContain("{{c1::ATP}}");
  });

  it("ignores syntax inside fenced code", () => {
    const doc = parseMarkdown(
      "```ts\nconst fake = 'Question::Answer';\n```\nReal::Card\n",
    );
    expect(doc.cards).toHaveLength(1);
    expect(doc.cards[0]?.front).toBe("Real");
  });

  it("inserts stable markers without corrupting offsets", () => {
    const source = "One::1\nTwo::2\n";
    const parsed = parseMarkdown(source);
    let id = 0;
    const result = insertMarkers(source, parsed.cards, () => `key-${++id}`);
    expect(result.source).toBe("One::1\n^af-key-1\nTwo::2\n^af-key-2\n");
    expect(parseMarkdown(result.source).cards.map((c) => c.key)).toEqual([
      "key-1",
      "key-2",
    ]);
  });

  it("puts a block ID on its own line when the file has no final newline", () => {
    const source = "One::1";
    const result = insertMarkers(
      source,
      parseMarkdown(source).cards,
      () => "key",
    );
    expect(result.source).toBe("One::1\n^af-key\n");
    expect(parseMarkdown(result.source).cards[0]?.back).toBe("1");
  });
  it("repairs early inline Forge block IDs", () => {
    expect(separateInlineForgeMarkers("Question::Answer^af-key")).toBe(
      "Question::Answer\n^af-key",
    );
  });
  it("ignores fully struck cards", () => {
    expect(
      parseMarkdown("~~Retired::Card~~\nLive::Card\n").cards.map(
        (c) => c.front,
      ),
    ).toEqual(["Live"]);
  });
  it("strikes deleted cards without disturbing neighboring content", () => {
    const source = "Keep::This\nDelete::This\n^af-doomed\nAfter::This\n";
    const cards = parseMarkdown(source).cards;
    const result = applyRemoteCards(source, [], [cards[1]!]);
    expect(result).toBe(
      "Keep::This\n~~Delete::This~~\n^af-doomed\nAfter::This\n",
    );
  });
  it("never treats LaTeX or code braces as clozes", () => {
    const source =
      "Math $\\frac{a}{b}$ and {real}\nCode `const x = {a: 1}` and {2:outside}\nEscaped \\{literal\\}\n";
    const cards = parseMarkdown(source).cards;
    expect(cards).toHaveLength(2);
    expect(cards[0]?.front).toContain("$\\frac{a}{b}$");
    expect(cards[0]?.front).toContain("{{c1::real}}");
    expect(cards[1]?.front).toContain("`const x = {a: 1}`");
    expect(cards[1]?.front).toContain("{{c2::outside}}");
  });
  it("ignores braces throughout multiline display math", () => {
    expect(
      parseMarkdown("$$\n\\frac{a}{b}\n$$\nOutside {cloze}\n").cards.map(
        (c) => c.front,
      ),
    ).toEqual(["Outside {{c1::cloze}}"]);
  });

  it("parses multiline tagged answers as one card", () => {
    const cards = parseMarkdown(
      "Why? #card\nBecause line one\nand line two\n\nNext::Card\n",
    ).cards;
    expect(cards).toHaveLength(2);
    expect(cards[0]?.back).toBe("Because line one\nand line two");
  });
});
