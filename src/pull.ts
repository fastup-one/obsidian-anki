import { htmlToMarkdown, type App, type TFile } from "obsidian";
import type { AnkiClient, AnkiNote } from "./anki";
import { ConflictModal } from "./conflict-modal";
import type { CardSnapshot, PluginState } from "./domain";
import {
  applyRemoteCards,
  duplicateCardKeys,
  type ParserOptions,
  parseMarkdown,
  removeForgeMarkers,
} from "./parser";
import { preserveEquivalentMarkdown, snapshot } from "./render";
import { approvePull } from "./sync-preview-modal";

const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function field(note: AnkiNote, name: string, original: string) {
  return preserveEquivalentMarkdown(
    note.fields[name]?.value ?? "",
    original,
    htmlToMarkdown,
  );
}
function remoteSnapshot(note: AnkiNote, fallback: CardSnapshot): CardSnapshot {
  const frontField = field(note, "Front", fallback.front);
  const clozeField = field(note, "Cloze", fallback.front);
  const front = fallback.kind === "cloze" ? clozeField : frontField;
  return {
    kind: fallback.kind,
    front,
    back: fallback.kind === "cloze" ? "" : field(note, "Back", fallback.back),
    tags: [...note.tags].sort(),
  };
}

export interface PullSummary {
  changed: number;
  detached: number;
  conflicts: number;
}
export async function pullFromAnki(
  app: App,
  client: AnkiClient,
  file: TFile,
  state: PluginState,
  options: Partial<ParserOptions> = {},
  managedTags: string[] = [],
): Promise<PullSummary> {
  let source = await app.vault.read(file);
  const doc = parseMarkdown(source, options);
  if (doc.diagnostics.length)
    throw new Error(
      doc.diagnostics
        .map((item) => `Line ${item.line}: ${item.message}`)
        .join("; "),
    );
  const duplicateKeys = duplicateCardKeys(doc.cards);
  if (duplicateKeys.length)
    throw new Error(
      `Duplicate Forge key${duplicateKeys.length === 1 ? "" : "s"}: ${duplicateKeys.join(", ")}`,
    );
  const tracked = doc.cards.filter((c) => c.key && state.cards[c.key]);
  const notes = await client.notesInfo(
    tracked.map((c) => state.cards[c.key!]!.noteId),
  );
  const byId = new Map(notes.map((n) => [n.noteId, n]));
  const detached: string[] = [];
  const struck: typeof tracked = [];
  const changes: { card: (typeof tracked)[number]; value: CardSnapshot }[] = [];
  const commits: (() => void)[] = [];
  let conflicts = 0;
  let cancelled = false;
  for (const card of tracked) {
    const key = card.key!;
    const stored = state.cards[key]!;
    const note = byId.get(stored.noteId);
    if (!note) {
      detached.push(key);
      struck.push(card);
      commits.push(() => {
        delete state.cards[key];
      });
      continue;
    }
    const local = snapshot(card);
    const remote = remoteSnapshot(
      note,
      stored.remote ?? stored.source ?? local,
    );
    remote.tags = remote.tags.filter((tag) => !managedTags.includes(tag));
    const localChanged = stored.source ? !equal(local, stored.source) : false;
    const remoteChanged = stored.remote ? !equal(remote, stored.remote) : false;
    if (remoteChanged && !localChanged) {
      changes.push({ card, value: remote });
      commits.push(() => {
        stored.source = remote;
        stored.remote = remote;
      });
    } else if (remoteChanged && localChanged) {
      conflicts++;
      await new Promise<void>((resolve) =>
        new ConflictModal(app, card.range.line, local, remote, (choice) => {
          if (choice === "cancel") {
            cancelled = true;
            resolve();
            return;
          }
          if (choice === "remote") {
            changes.push({ card, value: remote });
            commits.push(() => {
              stored.source = remote;
              stored.remote = remote;
            });
          } else
            commits.push(() => {
              stored.source = local;
              stored.remote = local;
            });
          resolve();
        }).open(),
      );
      if (cancelled) return { changed: 0, detached: 0, conflicts };
    }
  }
  if (
    !(await approvePull(
      app,
      file.path,
      changes.map((change) => change.card),
      struck,
    ))
  )
    return { changed: 0, detached: 0, conflicts };
  source = removeForgeMarkers(
    applyRemoteCards(source, changes, struck, doc.globalTags),
    detached,
  );
  if (changes.length || detached.length)
    await app.vault.process(file, () => source);
  for (const commit of commits) commit();
  return { changed: changes.length, detached: detached.length, conflicts };
}
