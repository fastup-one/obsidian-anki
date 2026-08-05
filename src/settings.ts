import { App, PluginSettingTab, Setting } from "obsidian";
import type AnkiForgePlugin from "./main";
export interface Settings {
  endpoint: string;
  deck: string;
  folderDecks: boolean;
  cardTag: string;
  context: boolean;
  defaultTag: string;
  inlineSeparator: string;
  reverseSeparator: string;
  syncOnClose: boolean;
  pullOnOpen: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  endpoint: "http://127.0.0.1:8765",
  deck: "Default",
  folderDecks: true,
  cardTag: "card",
  context: true,
  defaultTag: "obsidian",
  inlineSeparator: "::",
  reverseSeparator: ":::",
  syncOnClose: true,
  pullOnOpen: true,
};
export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: AnkiForgePlugin,
  ) {
    super(app, plugin);
  }
  display() {
    this.containerEl.empty();
    this.addText("AnkiConnect endpoint", "endpoint", (value) => value.trim());
    this.addText("Default deck", "deck", (value) =>
      value.trim() || "Default",
    );
    this.addToggle("Use folder decks", "folderDecks");
    this.addToggle("Include heading context", "context");
    this.addText("Card tag", "cardTag", (value) => value.trim() || "card");
    this.addText("Inline separator", "inlineSeparator", (value, previous) =>
      value || previous,
    );
    this.addText("Reversed separator", "reverseSeparator", (value, previous) =>
      value || previous,
    );
    this.addText("Default Anki tag", "defaultTag", (value) => value.trim());
    this.addToggle("Sync on file close", "syncOnClose");
    this.addToggle("Pull Anki edits on open", "pullOnOpen");
  }
  private addText(
    name: string,
    key: "endpoint" | "deck" | "cardTag" | "inlineSeparator" | "reverseSeparator" | "defaultTag",
    normalize: (value: string, previous: string) => string,
  ) {
    new Setting(this.containerEl).setName(name).addText((text) =>
      text.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = normalize(
          value,
          this.plugin.settings[key],
        );
        await this.plugin.saveSettings();
      }),
    );
  }
  private addToggle(
    name: string,
    key: "folderDecks" | "context" | "syncOnClose" | "pullOnOpen",
  ) {
    new Setting(this.containerEl).setName(name).addToggle((toggle) =>
      toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value;
        await this.plugin.saveSettings();
      }),
    );
  }
}
