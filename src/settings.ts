import {
  App,
  PluginSettingTab,
  Setting,
  type SettingDefinitionItem,
} from "obsidian";
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

type TextSetting =
  | "endpoint"
  | "deck"
  | "cardTag"
  | "inlineSeparator"
  | "reverseSeparator"
  | "defaultTag";
type ToggleSetting =
  | "folderDecks"
  | "context"
  | "syncOnClose"
  | "pullOnOpen";

const normalizeText = (
  key: TextSetting,
  value: string,
  previous: string,
): string => {
  switch (key) {
    case "endpoint":
    case "defaultTag":
      return value.trim();
    case "deck":
      return value.trim() || "Default";
    case "cardTag":
      return value.trim() || "card";
    case "inlineSeparator":
    case "reverseSeparator":
      return value || previous;
  }
};

export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: AnkiForgePlugin,
  ) {
    super(app, plugin);
  }
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      this.textDefinition("AnkiConnect endpoint", "endpoint"),
      this.textDefinition("Default deck", "deck"),
      this.toggleDefinition("Use folder decks", "folderDecks"),
      this.toggleDefinition("Include heading context", "context"),
      this.textDefinition("Card tag", "cardTag"),
      this.textDefinition("Inline separator", "inlineSeparator"),
      this.textDefinition("Reversed separator", "reverseSeparator"),
      this.textDefinition("Default Anki tag", "defaultTag"),
      this.toggleDefinition("Sync on file close", "syncOnClose"),
      this.toggleDefinition("Pull Anki edits on open", "pullOnOpen"),
    ];
  }
  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof Settings];
  }
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (typeof value === "string") {
      const textKey = key as TextSetting;
      this.plugin.settings[textKey] = normalizeText(
        textKey,
        value,
        this.plugin.settings[textKey],
      );
    } else if (typeof value === "boolean") {
      this.plugin.settings[key as ToggleSetting] = value;
    } else {
      return;
    }
    await this.plugin.saveSettings();
  }
  display() {
    this.containerEl.empty();
    this.addText("AnkiConnect endpoint", "endpoint");
    this.addText("Default deck", "deck");
    this.addToggle("Use folder decks", "folderDecks");
    this.addToggle("Include heading context", "context");
    this.addText("Card tag", "cardTag");
    this.addText("Inline separator", "inlineSeparator");
    this.addText("Reversed separator", "reverseSeparator");
    this.addText("Default Anki tag", "defaultTag");
    this.addToggle("Sync on file close", "syncOnClose");
    this.addToggle("Pull Anki edits on open", "pullOnOpen");
  }
  private addText(
    name: string,
    key: TextSetting,
  ) {
    new Setting(this.containerEl).setName(name).addText((text) =>
      text.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = normalizeText(
          key,
          value,
          this.plugin.settings[key],
        );
        await this.plugin.saveSettings();
      }),
    );
  }
  private addToggle(
    name: string,
    key: ToggleSetting,
  ) {
    new Setting(this.containerEl).setName(name).addToggle((toggle) =>
      toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value;
        await this.plugin.saveSettings();
      }),
    );
  }
  private textDefinition(name: string, key: TextSetting): SettingDefinitionItem {
    return { name, control: { type: "text", key } };
  }
  private toggleDefinition(
    name: string,
    key: ToggleSetting,
  ): SettingDefinitionItem {
    return { name, control: { type: "toggle", key } };
  }
}
