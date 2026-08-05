import { type App, Modal } from "obsidian";
import type { SyncSummary } from "./sync";
export class ReportModal extends Modal {
  constructor(
    app: App,
    private summary: SyncSummary,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText("Anki Forge sync report");
    this.contentEl.createEl("p", {
      text: `${this.summary.created} created, ${this.summary.updated} updated, ${this.summary.deleted} deleted, ${this.summary.unchanged} unchanged.`,
    });
    if (this.summary.failures.length) {
      this.contentEl.createEl("h4", { text: "Skipped cards" });
      const list = this.contentEl.createEl("ul");
      for (const failure of this.summary.failures)
        list.createEl("li", { text: failure });
    }
  }
}
