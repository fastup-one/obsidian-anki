import type { CardKind, ParsedCard, ParsedDocument } from "./domain";
import type { CardSnapshot } from "./domain";

export interface ParserOptions {
  cardTag: string;
  inlineSeparator: string;
  reverseSeparator: string;
  context: boolean;
}
const defaults: ParserOptions = {
  cardTag: "card",
  inlineSeparator: "::",
  reverseSeparator: ":::",
  context: true,
};

const stableMarker = /^\s*\^(af-[a-zA-Z0-9_-]+)\s*$/;
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cardTag(line: string, options: ParserOptions): RegExpExecArray | null {
  return new RegExp(
    `(?:^|\\s)#${escapeRegExp(options.cardTag)}(?:[/-](reverse|spaced))?(?=\\s|$)`,
    "iu",
  ).exec(line);
}

function splitTags(text: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  const clean = text
    .replace(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu, (_whole, tag: string) => {
      tags.push(tag.replaceAll("/", "::"));
      return "";
    })
    .trim();
  return { text: clean, tags };
}

function inline(
  line: string,
  options: ParserOptions,
): { kind: CardKind; front: string; back: string } | undefined {
  const reverseAt = line.indexOf(options.reverseSeparator);
  const normalAt = line.indexOf(options.inlineSeparator);
  const reversed = reverseAt >= 0 && (normalAt < 0 || reverseAt === normalAt);
  const at = reversed ? reverseAt : normalAt;
  const separator = reversed
    ? options.reverseSeparator
    : options.inlineSeparator;
  if (at <= 0) return;
  const front = line.slice(0, at).trim();
  const back = line.slice(at + separator.length).trim();
  if (!front || !back) return;
  return { kind: reversed ? "reversed" : "basic", front, back };
}

function cloze(line: string): string | undefined {
  let found = false;
  let output = "";
  let index = 0;
  const escaped = (at: number) => {
    let slashes = 0;
    for (let i = at - 1; i >= 0 && line[i] === "\\"; i--) slashes++;
    return slashes % 2 === 1;
  };
  while (index < line.length) {
    const char = line[index]!;
    if (char === "`") {
      const run = /^`+/.exec(line.slice(index))![0];
      const end = line.indexOf(run, index + run.length);
      if (end < 0) {
        output += line.slice(index);
        break;
      }
      output += line.slice(index, end + run.length);
      index = end + run.length;
      continue;
    }
    if (char === "$" && !escaped(index)) {
      const delimiter = line[index + 1] === "$" ? "$$" : "$";
      let end = index + delimiter.length;
      while ((end = line.indexOf(delimiter, end)) >= 0 && escaped(end))
        end += delimiter.length;
      if (end < 0) {
        output += line.slice(index);
        break;
      }
      output += line.slice(index, end + delimiter.length);
      index = end + delimiter.length;
      continue;
    }
    if (line.startsWith("==", index)) {
      const end = line.indexOf("==", index + 2);
      if (end >= 0) {
        const body = line.slice(index + 2, end);
        if (body) {
          output += `{{c1::${body}}}`;
          found = true;
          index = end + 2;
          continue;
        }
      }
    }
    if (char === "{" && !escaped(index)) {
      const end = line.indexOf("}", index + 1);
      if (end >= 0) {
        const body = line.slice(index + 1, end);
        const numbered = /^(\d+):(.*)$/.exec(body);
        const content = numbered?.[2] ?? body;
        if (content && !content.includes("{")) {
          output += `{{c${numbered?.[1] ?? "1"}::${content}}}`;
          found = true;
          index = end + 1;
          continue;
        }
      }
    }
    output += char;
    index++;
  }
  return found ? output : undefined;
}

export function parseMarkdown(
  source: string,
  overrides: Partial<ParserOptions> = {},
): ParsedDocument {
  const options = { ...defaults, ...overrides };
  const lines = source.split(/(?<=\n)/);
  const cards: ParsedCard[] = [];
  const diagnostics: ParsedDocument["diagnostics"] = [];
  const headings: { level: number; title: string }[] = [];
  let offset = 0;
  let fence: string | undefined;
  let deck: string | undefined;
  let globalTags: string[] = [];
  let inFrontmatter = false;
  let consumedUntil = -1;
  let displayMath = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.replace(/\r?\n$/, "");
    const trimmed = line.trim();
    if (i === 0 && trimmed === "---") {
      inFrontmatter = true;
      offset += raw.length;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === "---") inFrontmatter = false;
      else if (/^anki-deck\s*:/i.test(line))
        deck = line.slice(line.indexOf(":") + 1).trim();
      else if (/^tags\s*:/i.test(line))
        globalTags = splitTags(line.slice(line.indexOf(":") + 1)).tags;
      offset += raw.length;
      continue;
    }
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const token = fenceMatch[1]!;
      fence = fence
        ? token[0] === fence[0] && token.length >= fence.length
          ? undefined
          : fence
        : token;
      offset += raw.length;
      continue;
    }
    if (fence) {
      offset += raw.length;
      continue;
    }
    const displayDelimiters = [...line.matchAll(/(?<!\\)\$\$/g)].length;
    if (displayMath) {
      if (displayDelimiters % 2 === 1) displayMath = false;
      offset += raw.length;
      continue;
    }
    if (displayDelimiters % 2 === 1) displayMath = true;
    if (/^~~[\s\S]+~~$/.test(trimmed)) {
      offset += raw.length;
      continue;
    }
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1]!.length;
      headings.splice(level - 1);
      headings[level - 1] = {
        level,
        title: heading[2]!.replace(/\s+#[\w/-]+\s*$/, ""),
      };
    }

    if (i <= consumedUntil) {
      offset += raw.length;
      continue;
    }
    const tagged = cardTag(line, options);
    const tagData = splitTags(line);
    let candidate:
      | Omit<
          ParsedCard,
          | "range"
          | "markerOffset"
          | "tags"
          | "context"
          | "sourceStyle"
          | "sourceTag"
        >
      | undefined;
    let rangeEnd = offset + raw.length;
    let markerOffset = rangeEnd;
    let sourceStyle: ParsedCard["sourceStyle"] = "inline";
    let sourceTag: string | undefined;
    if (tagged) {
      sourceStyle = "tagged";
      sourceTag = tagged[0].trim();
      const mode = tagged[1]?.toLowerCase();
      const before = line.slice(0, tagged.index).trim();
      if (!before)
        diagnostics.push({ line: i + 1, message: "Card tag has no prompt" });
      else {
        const answer: string[] = [];
        let answerDisplayMath = false;
        let answerFence: string | undefined;
        if (mode !== "spaced")
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = (lines[j] ?? "").replace(/\r?\n$/, "");
            const nextText = splitTags(nextLine).text;
            const mathDelimiters = [...nextLine.matchAll(/(?<!\\)\$\$/g)]
              .length;
            const isDisplayMath = answerDisplayMath || mathDelimiters > 0;
            const fenceMatch = nextLine.trim().match(/^(`{3,}|~{3,})/);
            const inCodeFence = Boolean(answerFence || fenceMatch);
            if (
              !isDisplayMath &&
              !inCodeFence &&
              (!nextLine.trim() ||
                stableMarker.test(nextLine) ||
                /^ {0,3}#{1,6}\s/.test(nextLine) ||
                cardTag(nextLine, options) ||
                inline(nextText, options) ||
                cloze(nextText))
            )
              break;
            answer.push(nextLine);
            rangeEnd += (lines[j] ?? "").length;
            markerOffset = rangeEnd;
            consumedUntil = j;
            if (mathDelimiters % 2 === 1)
              answerDisplayMath = !answerDisplayMath;
            if (fenceMatch) {
              const token = fenceMatch[1]!;
              answerFence = answerFence
                ? token[0] === answerFence[0] &&
                  token.length >= answerFence.length
                  ? undefined
                  : answerFence
                : token;
            }
          }
        candidate = {
          kind:
            mode === "reverse"
              ? "reversed"
              : mode === "spaced"
                ? "spaced"
                : "basic",
          front: before,
          back:
            mode === "spaced" ? "Review complete" : answer.join("\n").trim(),
        };
      }
    } else {
      const parsedInline = inline(tagData.text, options);
      const parsedCloze = parsedInline ? undefined : cloze(tagData.text);
      if (parsedInline) candidate = parsedInline;
      else if (parsedCloze)
        candidate = { kind: "cloze", front: parsedCloze, back: "" };
      if (parsedCloze && !parsedInline) sourceStyle = "cloze";
    }
    if (candidate) {
      const markerLine = consumedUntil >= i ? consumedUntil + 1 : i + 1;
      const next = (lines[markerLine] ?? "").trim();
      const marker = stableMarker.exec(next);
      const context = options.context
        ? headings.filter(Boolean).map((h) => h.title)
        : [];
      cards.push({
        ...candidate,
        key: marker?.[1]?.slice(3),
        tags: [
          ...new Set([
            ...globalTags,
            ...tagData.tags.filter(
              (t) =>
                !new RegExp(
                  `^${escapeRegExp(options.cardTag)}(?:[/-])?`,
                  "i",
                ).test(t),
            ),
          ]),
        ],
        context,
        range: { start: offset, end: rangeEnd, line: i + 1 },
        markerOffset,
        sourceStyle,
        ...(sourceTag ? { sourceTag } : {}),
      });
    }
    offset += raw.length;
  }
  return { cards, deck, globalTags, diagnostics };
}

export function insertMarkers(
  source: string,
  cards: ParsedCard[],
  makeKey: () => string,
): { source: string; keys: string[] } {
  const missing = cards
    .filter((c) => !c.key)
    .map((card) => ({ card, key: makeKey() }));
  const keys = missing.map((item) => item.key);
  for (const { card, key } of missing.sort(
    (a, b) => b.card.markerOffset - a.card.markerOffset,
  )) {
    const prefix =
      card.markerOffset > 0 && source[card.markerOffset - 1] !== "\n"
        ? "\n"
        : "";
    source =
      source.slice(0, card.markerOffset) +
      `${prefix}^af-${key}\n` +
      source.slice(card.markerOffset);
  }
  return { source, keys };
}

export function duplicateCardKeys(cards: ParsedCard[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const card of cards)
    if (card.key && seen.has(card.key)) duplicates.add(card.key);
    else if (card.key) seen.add(card.key);
  return [...duplicates];
}

export function serializeSnapshot(
  value: CardSnapshot,
  card?: ParsedCard,
): string {
  const tags = value.tags.length
    ? ` ${value.tags.map((tag) => `#${tag.replaceAll("::", "/")}`).join(" ")}`
    : "";
  if (value.kind === "cloze")
    return value.front.replace(/\{\{c(\d+)::(.+?)\}\}/g, "{$1:$2}") + tags;
  if (card?.sourceStyle === "tagged") {
    const tag =
      card.sourceTag ??
      `#card${value.kind === "reversed" ? "-reverse" : value.kind === "spaced" ? "-spaced" : ""}`;
    return `${value.front} ${tag}${tags}${value.kind === "spaced" || !value.back ? "" : `\n${value.back}`}`;
  }
  if (value.kind === "spaced") return `${value.front} #card-spaced${tags}`;
  return `${value.front}${value.kind === "reversed" ? ":::" : "::"}${value.back}${tags}`;
}

export function applyRemoteCards(
  source: string,
  changes: { card: ParsedCard; value: CardSnapshot }[],
  strikes: ParsedCard[] = [],
): string {
  const edits = changes.map(({ card, value }) => ({
    card,
    replacement:
      serializeSnapshot(value, card) +
      (source.slice(card.range.start, card.range.end).endsWith("\n")
        ? "\n"
        : ""),
  }));
  for (const card of strikes) {
    const original = source.slice(card.range.start, card.range.end);
    const replacement = original
      .split(/(?<=\n)/)
      .map((part) => {
        const newline = part.endsWith("\n") ? "\n" : "";
        const text = part.replace(/\r?\n$/, "");
        return text.trim() ? `~~${text}~~${newline}` : part;
      })
      .join("");
    edits.push({ card, replacement });
  }
  for (const { card, replacement } of edits.sort(
    (a, b) => b.card.range.start - a.card.range.start,
  ))
    source =
      source.slice(0, card.range.start) +
      replacement +
      source.slice(card.range.end);
  return source;
}

export function removeForgeMarkers(source: string, keys: string[]): string {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    source = source.replace(
      new RegExp(`^\\s*\\^af-${escaped}\\s*\\r?\\n?`, "m"),
      "",
    );
  }
  return source;
}

/** Repairs block IDs produced by the early no-final-newline bug. */
export function separateInlineForgeMarkers(source: string): string {
  return source.replace(/([^\n])\^(af-[a-zA-Z0-9_-]+)\s*$/gm, "$1\n^$2");
}
