export type CardKind = "basic" | "reversed" | "spaced" | "cloze";

export interface SourceRange {
  start: number;
  end: number;
  line: number;
}

export interface ParsedCard {
  key?: string;
  kind: CardKind;
  front: string;
  back: string;
  tags: string[];
  context: string[];
  range: SourceRange;
  markerOffset: number;
}

export interface ParsedDocument {
  cards: ParsedCard[];
  deck?: string;
  globalTags: string[];
  diagnostics: { line: number; message: string }[];
}

export interface CardSnapshot {
  kind: CardKind;
  front: string;
  back: string;
  tags: string[];
}
export interface StoredCard {
  noteId: number;
  fingerprint: string;
  deck?: string;
  source?: CardSnapshot;
  remote?: CardSnapshot;
  filePath?: string;
}
export interface PluginState {
  version: 1;
  cards: Record<string, StoredCard>;
}
