import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/common";
import type { CardSnapshot, ParsedCard } from "./domain";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const md: MarkdownIt = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  highlight(code: string, language: string): string {
    if (language && hljs.getLanguage(language))
      return `<pre><code class="hljs language-${language}">${hljs.highlight(code, { language }).value}</code></pre>`;
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  },
});
const RENDER_VERSION = 5;
const mediaName = (path: string) =>
  (path.split("/").pop() ?? path).toLocaleLowerCase("en-US");
export function snapshot(card: ParsedCard): CardSnapshot {
  return {
    kind: card.kind,
    front: card.front,
    back: card.back,
    tags: [...card.tags].sort(),
  };
}
export function markdownToAnki(value: string): string {
  const expanded = value
    .replace(
      /!\[\[([^\]|]+\.(?:mp3|wav|m4a|ogg|flac))(?:\|[^\]]+)?\]\]/gi,
      (_m, path: string) => `[sound:${mediaName(path)}]`,
    )
    .replace(
      /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,
      (_m, path: string) => `![](${mediaName(path)})`,
    )
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_m, alt: string, path: string) =>
        `![${alt}](${encodeURI(mediaName(path))})`,
    )
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "[$2]($1)")
    .replace(/\[\[([^\]]+)\]\]/g, "[$1]($1)")
    .replace(/\$\$([\s\S]+?)\$\$/g, "\\\\[$1\\\\]")
    .replace(/(^|[^$])\$([^\n$]+?)\$/g, "$1\\\\($2\\\\)");
  return md.render(expanded);
}
export function renderCard(card: ParsedCard, sourceLink: string) {
  const context = card.context.join(" › ");
  const extra = [context, `[Open source note](${sourceLink})`]
    .filter(Boolean)
    .join("\n\n");
  const common = {
    Extra: markdownToAnki(extra),
    ForgeKey: card.key ?? "",
  };
  return card.kind === "cloze"
    ? { Cloze: markdownToAnki(card.front), ...common }
    : {
        Front: markdownToAnki(card.front),
        Back: markdownToAnki(card.back),
        ...common,
      };
}

export function fingerprint(card: ParsedCard): string {
  const stable = JSON.stringify({
    renderVersion: RENDER_VERSION,
    kind: card.kind,
    front: card.front,
    back: card.back,
    tags: [...card.tags].sort(),
    context: card.context,
  });
  let hash = 2166136261;
  for (let i = 0; i < stable.length; i++) {
    hash ^= stable.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
