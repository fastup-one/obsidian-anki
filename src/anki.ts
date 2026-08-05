import { requestUrl } from "obsidian";

export class AnkiError extends Error {
  constructor(
    message: string,
    readonly action: string,
  ) {
    super(message);
  }
}
type InvokeResponse<T> = { result: T; error: string | null };

export class AnkiClient {
  constructor(
    private readonly endpoint = "http://127.0.0.1:8765",
    private readonly timeoutMs = 10_000,
  ) {}

  async invoke<T>(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    try {
      const request = requestUrl({
        url: this.endpoint,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ action, version: 6, params }),
        throw: false,
      });
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(
          () =>
            reject(
              new AnkiError(`Timed out after ${this.timeoutMs}ms`, action),
            ),
          this.timeoutMs,
        ),
      );
      const response = await Promise.race([request, timeout]);
      if (response.status < 200 || response.status >= 300)
        throw new AnkiError(`HTTP ${response.status}`, action);
      const body = response.json as InvokeResponse<T>;
      if (!("result" in body) || !("error" in body))
        throw new AnkiError("Malformed AnkiConnect response", action);
      if (body.error) throw new AnkiError(body.error, action);
      return body.result;
    } catch (error) {
      if (error instanceof AnkiError) throw error;
      throw new AnkiError(
        error instanceof Error ? error.message : String(error),
        action,
      );
    }
  }

  version() {
    return this.invoke<number>("version");
  }
  createDeck(deck: string) {
    return this.invoke<number>("createDeck", { deck });
  }
  modelNames() {
    return this.invoke<string[]>("modelNames");
  }
  modelFieldNames(modelName: string) {
    return this.invoke<string[]>("modelFieldNames", { modelName });
  }
  modelFieldAdd(modelName: string, fieldName: string) {
    return this.invoke<null>("modelFieldAdd", { modelName, fieldName });
  }
  modelFieldRemove(modelName: string, fieldName: string) {
    return this.invoke<null>("modelFieldRemove", { modelName, fieldName });
  }
  modelFieldReposition(modelName: string, fieldName: string, index: number) {
    return this.invoke<null>("modelFieldReposition", {
      modelName,
      fieldName,
      index,
    });
  }
  updateModelTemplates(
    name: string,
    templates: Record<string, { Front: string; Back: string }>,
  ) {
    return this.invoke<null>("updateModelTemplates", {
      model: { name, templates },
    });
  }
  updateModelStyling(name: string, css: string) {
    return this.invoke<null>("updateModelStyling", { model: { name, css } });
  }
  createModel(params: Record<string, unknown>) {
    return this.invoke<number>("createModel", params);
  }
  findCards(query: string) {
    return this.invoke<number[]>("findCards", { query });
  }
  findNotes(query: string) {
    return this.invoke<number[]>("findNotes", { query });
  }
  changeDeck(cards: number[], deck: string) {
    return cards.length
      ? this.invoke<null>("changeDeck", { cards, deck })
      : Promise.resolve(null);
  }
  storeMediaFile(filename: string, data: string) {
    return this.invoke<string>("storeMediaFile", { filename, data });
  }
  notesInfo(notes: number[]) {
    return notes.length
      ? this.invoke<AnkiNote[]>("notesInfo", { notes })
      : Promise.resolve([]);
  }
  addNote(note: AnkiCreateNote) {
    return this.invoke<number | null>("addNote", { note });
  }
  canAddNotesWithErrorDetail(notes: AnkiCreateNote[]) {
    return this.invoke<{ canAdd: boolean; error: string | null }[]>(
      "canAddNotesWithErrorDetail",
      { notes },
    );
  }
  deleteNotes(notes: number[]) {
    return notes.length
      ? this.invoke<null>("deleteNotes", { notes })
      : Promise.resolve(null);
  }
  updateNoteFields(id: number, fields: Record<string, string>) {
    return this.invoke<null>("updateNoteFields", { note: { id, fields } });
  }
  addTags(notes: number[], tags: string) {
    return this.invoke<null>("addTags", { notes, tags });
  }
  removeTags(notes: number[], tags: string) {
    return this.invoke<null>("removeTags", { notes, tags });
  }
}

export interface AnkiCreateNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  options: { allowDuplicate: boolean };
}
export interface AnkiNote {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string }>;
  cards?: number[];
}
