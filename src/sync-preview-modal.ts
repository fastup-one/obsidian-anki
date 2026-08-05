import { type App, Modal, Setting } from "obsidian";
import type { SyncPlan } from "./sync";
import type { ParsedCard } from "./domain";

export class SyncPreviewModal extends Modal {
  private settled = false;
  constructor(
    app: App,
    private filePath: string,
    private plan: SyncPlan,
    private resolveDecision: (approved: boolean) => void,
  ) {
    super(app);
  }
  onOpen() {
    if (
      !this.plan.create.length &&
      !this.plan.update.length &&
      !this.plan.remove.length
    ) {
      this.choose(false);
      return;
    }
    this.titleEl.setText("Approve Anki sync");
    this.contentEl.createEl("p", { text: this.filePath });
    this.contentEl.createEl("p", {
      text: `${this.plan.create.length} create, ${this.plan.update.length} update, ${this.plan.remove.length} delete, ${this.plan.unchanged} unchanged.`,
    });
    if (this.plan.remove.length) {
      const warning = this.contentEl.createEl("p", {
        text: `⚠ ${this.plan.remove.length} Anki note(s) will be permanently deleted.`,
      });
      warning.addClass("mod-warning");
    }
    const details = this.contentEl.createEl("details");
    details.createEl("summary", { text: "Review affected cards" });
    const list = details.createEl("ul");
    for (const card of this.plan.create)
      list.createEl("li", {
        text: `Create, line ${card.range.line}: ${card.front.slice(0, 100)}`,
      });
    for (const item of this.plan.update)
      list.createEl("li", {
        text: `Update note ${item.noteId}, line ${item.card.range.line}: ${item.card.front.slice(0, 100)}`,
      });
    for (const noteId of this.plan.remove)
      list.createEl("li", { text: `Delete Anki note ${noteId}` });
    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => this.choose(false)),
      )
      .addButton((button) =>
        button
          .setCta()
          .setButtonText("Approve sync")
          .onClick(() => this.choose(true)),
      );
  }
  private choose(approved: boolean) {
    if (this.settled) return;
    this.settled = true;
    this.resolveDecision(approved);
    this.close();
  }
  onClose() {
    if (!this.settled) {
      this.settled = true;
      this.resolveDecision(false);
    }
    this.contentEl.empty();
  }
}

export function approveSync(
  app: App,
  filePath: string,
  plan: SyncPlan,
): Promise<boolean> {
  if (!plan.create.length && !plan.update.length && !plan.remove.length)
    return Promise.resolve(true);
  return new Promise((resolve) =>
    new SyncPreviewModal(app, filePath, plan, resolve).open(),
  );
}

export function approvePull(
  app: App,
  filePath: string,
  edits: ParsedCard[],
  strikes: ParsedCard[],
): Promise<boolean> {
  if (!edits.length && !strikes.length) return Promise.resolve(true);
  return new Promise((resolve) => {
    const modal = new (class extends Modal {
      private settled = false;
      onOpen() {
        this.titleEl.setText("Approve changes from Anki");
        this.contentEl.createEl("p", { text: filePath });
        this.contentEl.createEl("p", {
          text: `${edits.length} Markdown edit(s), ${strikes.length} deleted Anki card(s) to strike through.`,
        });
        if (strikes.length) {
          const warning = this.contentEl.createEl("p", {
            text: `⚠ ${strikes.length} card line(s) will be struck through.`,
          });
          warning.addClass("mod-warning");
        }
        const details = this.contentEl.createEl("details");
        details.createEl("summary", { text: "Review affected lines" });
        const list = details.createEl("ul");
        for (const card of edits)
          list.createEl("li", {
            text: `Update line ${card.range.line}: ${card.front.slice(0, 100)}`,
          });
        for (const card of strikes)
          list.createEl("li", {
            text: `Strike line ${card.range.line}: ${card.front.slice(0, 100)}`,
          });
        new Setting(this.contentEl)
          .addButton((b) =>
            b.setButtonText("Cancel").onClick(() => this.choose(false)),
          )
          .addButton((b) =>
            b
              .setCta()
              .setButtonText("Approve changes")
              .onClick(() => this.choose(true)),
          );
      }
      private choose(value: boolean) {
        if (this.settled) return;
        this.settled = true;
        resolve(value);
        this.close();
      }
      onClose() {
        if (!this.settled) {
          this.settled = true;
          resolve(false);
        }
        this.contentEl.empty();
      }
    })(app);
    modal.open();
  });
}
