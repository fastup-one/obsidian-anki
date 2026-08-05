import type { App, TFile } from "obsidian";
import type { AnkiClient } from "./anki";
import type { ParsedCard } from "./domain";

const mediaPattern =
  /!\[\[([^\]|]+\.(?:png|jpe?g|gif|webp|svg|mp3|wav|m4a|ogg|flac))(?:\|[^\]]+)?\]\]|!\[[^\]]*\]\(([^)]+)\)/giu;
export function extractMediaPaths(markdown: string): string[] {
  return [...markdown.matchAll(mediaPattern)].map((match) =>
    decodeURIComponent((match[1] ?? match[2] ?? "").trim().replace(/^<|>$/g, "")),
  );
}
function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function resolveMedia(app: App, file: TFile, link: string): TFile | undefined {
  const cached = app.metadataCache.getFirstLinkpathDest(link, file.path);
  if (cached) return cached;

  // Obsidian's link cache can lag immediately after pasting an attachment.
  // Resolve the literal vault path, then fall back to an unambiguous basename.
  const normalized = link.replace(/^\.\//, "").replaceAll("\\", "/");
  const direct = app.vault.getAbstractFileByPath(normalized);
  if (direct && "extension" in direct) return direct as TFile;
  const matches = app.vault
    .getFiles()
    .filter((candidate) => candidate.name === normalized.split("/").at(-1));
  return matches.length === 1 ? matches[0] : undefined;
}

export async function uploadMedia(
  app: App,
  anki: AnkiClient,
  file: TFile,
  cards: ParsedCard[],
): Promise<string[]> {
  const warnings: string[] = [];
  const paths = new Set<string>();
  for (const card of cards)
    for (const value of [card.front, card.back])
      for (const path of extractMediaPaths(value)) paths.add(path);
  for (const path of paths) {
    const asset = resolveMedia(app, file, path);
    if (!asset) {
      warnings.push(`Missing media: ${path}`);
      continue;
    }
    try {
      await anki.storeMediaFile(
        // Anki normalizes media filenames to lowercase. Use that canonical
        // name up front so rendered fields and the media collection agree on
        // case-sensitive platforms.
        asset.name.toLocaleLowerCase("en-US"),
        base64(await app.vault.readBinary(asset)),
      );
    } catch (error) {
      warnings.push(
        `Media ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return warnings;
}

const noteEmbed = /!\[\[([^\]|]+?)(?:\.md)?(?:#([^\]|]+))?(?:\|[^\]]+)?\]\]/giu;
function section(markdown: string, heading?: string) {
  if (!heading) return markdown;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, "mi").exec(markdown);
  if (!match) return markdown;
  const level = /^#+/.exec(match[0])?.[0].length ?? 6;
  const rest = markdown.slice(match.index + match[0].length);
  const end = new RegExp(`^#{1,${level}}\\s+`, "m").exec(rest);
  return rest.slice(0, end?.index).trim();
}
export async function expandNoteEmbeds(
  app: App,
  file: TFile,
  cards: ParsedCard[],
): Promise<string[]> {
  const warnings: string[] = [];
  for (const card of cards)
    for (const side of ["front", "back"] as const) {
      const value = card[side];
      const matches = [...value.matchAll(noteEmbed)];
      let result = value;
      for (const match of matches.reverse()) {
        const target = app.metadataCache.getFirstLinkpathDest(
          match[1]!,
          file.path,
        );
        if (!target) {
          warnings.push(`Missing embedded note: ${match[1]}`);
          continue;
        }
        if (target.extension !== "md") continue;
        const replacement = section(
          await app.vault.cachedRead(target),
          match[2],
        );
        result =
          result.slice(0, match.index!) +
          replacement +
          result.slice(match.index! + match[0].length);
      }
      card[side] = result;
    }
  return warnings;
}
