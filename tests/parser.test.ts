import { describe, expect, it } from "vitest";
import {
  applyRemoteCards,
  duplicateCardKeys,
  insertMarkers,
  parseMarkdown,
  separateInlineForgeMarkers,
} from "../src/parser";
import { extractMediaPaths } from "../src/media";
import {
  markdownToAnki,
  preserveEquivalentMarkdown,
  renderCard,
} from "../src/render";

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
  it("preserves original math when Anki only normalizes rendered HTML", () => {
    const original = String.raw`$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$`;
    const stripParagraph = (html: string) =>
      html.replace(/^<p>|<\/p>\n?$/g, "");
    const normalizedByAnki = markdownToAnki(original)
      .replace("<p>", "<div>")
      .replace("</p>", "</div>");
    const normalizeBlocks = (html: string) =>
      stripParagraph(html.replace(/^<div>|<\/div>\n?$/g, ""));

    expect(
      preserveEquivalentMarkdown(normalizedByAnki, original, normalizeBlocks),
    ).toBe(original);
    expect(
      preserveEquivalentMarkdown("<div>(y)</div>", original, normalizeBlocks),
    ).toBe("(y)");
  });
  it("preserves multiline math when Anki changes its line layout", () => {
    const original = String.raw`$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$`;
    const ankiHtml = String.raw`<div>\[x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}\]</div>`;
    const htmlToMarkdown = (html: string) =>
      html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(?:p|div)>/gi, "")
        .trim();

    expect(preserveEquivalentMarkdown(ankiHtml, original, htmlToMarkdown)).toBe(
      original,
    );
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
  it("keeps adjacent cards separate through a pull round trip", () => {
    const source = "One::1\n^af-one\nTwo::2\n^af-two\n";
    const cards = parseMarkdown(source).cards;
    const pulled = applyRemoteCards(
      source,
      cards.map((card) => ({ card, value: { ...card } })),
    );
    const reparsed = parseMarkdown(pulled).cards;

    expect(pulled).toBe(source);
    expect(
      reparsed.map(({ key, front, back }) => ({ key, front, back })),
    ).toEqual([
      { key: "one", front: "One", back: "1" },
      { key: "two", front: "Two", back: "2" },
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
  it("separates a multiline card from an adjacent inline card", () => {
    const source = "Why? #card\nBecause\nNext::Card\n";
    const cards = parseMarkdown(source).cards;
    expect(cards.map(({ front, back }) => ({ front, back }))).toEqual([
      { front: "Why?", back: "Because" },
      { front: "Next", back: "Card" },
    ]);

    let index = 0;
    const marked = insertMarkers(
      source,
      cards,
      () => ["multi", "inline"][index++]!,
    );
    expect(marked.source).toBe(
      "Why? #card\nBecause\n^af-multi\nNext::Card\n^af-inline\n",
    );
    expect(
      parseMarkdown(marked.source).cards.map(({ key, front, back }) => ({
        key,
        front,
        back,
      })),
    ).toEqual([
      { key: "multi", front: "Why?", back: "Because" },
      { key: "inline", front: "Next", back: "Card" },
    ]);
  });
  it("places a multiline card marker after an entire display-math answer", () => {
    const source = String.raw`Solve this #card
$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
Next::Card
`;
    const cards = parseMarkdown(source).cards;
    expect(cards).toHaveLength(2);
    expect(cards[0]?.back).toContain(
      String.raw`\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
    );

    let index = 0;
    const marked = insertMarkers(
      source,
      cards,
      () => ["math", "inline"][index++]!,
    ).source;
    expect(marked).toContain("\n$$\n^af-math\nNext::Card");
    expect(marked).not.toContain("$$\n^af-math\nx =");
    expect(parseMarkdown(marked).cards.map((card) => card.key)).toEqual([
      "math",
      "inline",
    ]);
  });
  it("preserves tagged multiline syntax when applying an Anki edit", () => {
    const source = "Why? #card\nOld answer\n^af-key\n";
    const card = parseMarkdown(source).cards[0]!;
    const updated = applyRemoteCards(source, [
      { card, value: { ...card, back: "New answer" } },
    ]);
    expect(updated).toBe("Why? #card\nNew answer\n^af-key\n");
  });
  it("keeps fenced code inside a multiline answer", () => {
    const source =
      "Explain #card\n```ts\nconst answer = { value: 42 };\n```\nNext::Card\n";
    const cards = parseMarkdown(source).cards;
    expect(cards).toHaveLength(2);
    expect(cards[0]?.back).toContain("const answer = { value: 42 };");
    expect(cards[1]?.front).toBe("Next");
  });
  it("treats configured card tags as literal text", () => {
    const cards = parseMarkdown("Question #[\nAnswer\n", {
      cardTag: "[",
    }).cards;
    expect(cards).toHaveLength(1);
    expect(cards[0]?.back).toBe("Answer");
  });
  it("detects duplicate Forge keys", () => {
    const cards = parseMarkdown("One::1\n^af-same\nTwo::2\n^af-same\n").cards;
    expect(duplicateCardKeys(cards)).toEqual(["same"]);
  });
});
