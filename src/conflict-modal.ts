import { type App, Modal, Setting } from "obsidian";
import type { CardSnapshot } from "./domain";

export class ConflictModal extends Modal {
  private settled = false;
  constructor(
    app: App,
    private line: number,
    private local: CardSnapshot,
    private remote: CardSnapshot,
    private resolveChoice: (choice: "local" | "remote" | "cancel") => void,
  ) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText(`Flashcard conflict on line ${this.line}`);
    this.contentEl.createEl("p", {
      text: "Both Obsidian and Anki changed since the last sync. Choose which version to keep.",
    });
    this.contentEl.createEl("h4", { text: "Obsidian" });
    this.contentEl.createEl("pre", {
      text: `${this.local.front}\n${this.local.back}`,
    });
    this.contentEl.createEl("h4", { text: "Anki" });
    this.contentEl.createEl("pre", {
      text: `${this.remote.front}\n${this.remote.back}`,
    });
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Keep Obsidian").onClick(() => {
          this.choose("local");
        }),
      )
      .addButton((b) =>
        b
          .setCta()
          .setButtonText("Use Anki")
          .onClick(() => {
            this.choose("remote");
          }),
      );
  }
  private choose(choice: "local" | "remote") {
    if (this.settled) return;
    this.settled = true;
    this.resolveChoice(choice);
    this.close();
  }
  onClose() {
    if (!this.settled) {
      this.settled = true;
      this.resolveChoice("cancel");
    }
    this.contentEl.empty();
  }
}
