# Anki Forge

Write flashcards naturally in Obsidian and study them in Anki.

Anki Forge finds cards in your Markdown notes, shows you what will change, and sends them to Anki. You can keep your explanations, images, tags, headings, and source material together in Obsidian while Anki handles review scheduling.

## Why Anki Forge?

- Write cards without leaving your notes.
- Write rich, multi-line cards as collapsible callouts.
- Preview every create, update, and deletion before it reaches Anki.
- Edit cards in Obsidian or Anki and safely bring changes back.
- Include images, audio, Markdown formatting, math, code, and embedded notes.
- Keep cards organized with note tags, folder-based decks, and frontmatter.

## What you need

- Obsidian 1.5.0 or newer on desktop
- [Anki](https://apps.ankiweb.net/)
- The [AnkiConnect](https://ankiweb.net/shared/info/2055492159) Anki add-on

Anki must be open while syncing. Anki Forge connects to AnkiConnect at `http://127.0.0.1:8765` by default.

## Installation

When Anki Forge is available in Obsidian's community plugin directory:

1. Open **Settings → Community plugins → Browse**.
2. Search for **Anki Forge**.
3. Select **Install**, then **Enable**.
4. Open Anki and make sure AnkiConnect is installed.

For a manual installation, download `main.js` and `manifest.json` from the latest GitHub release. Put them in `<your vault>/.obsidian/plugins/anki-forge/`, then reload Obsidian.

Release files include signed GitHub build-provenance attestations. After downloading them, you can verify each file with the [GitHub CLI](https://cli.github.com/):

```sh
gh attestation verify main.js --repo fastup-one/obsidian-anki
gh attestation verify manifest.json --repo fastup-one/obsidian-anki
```

## Your first cards

The simplest card uses two colons:

```markdown
What is the powerhouse of the cell?::The mitochondrion
```

For a card that should be tested in both directions, use three colons:

```markdown
bonjour:::hello
```

Highlights and braces create cloze cards:

```markdown
The ==mitochondrion== is the powerhouse of the cell.
Water freezes at {0°C}.
The heart has {1:four} chambers and {2:two} atria.
```

You can also write a longer answer beneath a tagged prompt:

```markdown
Why do leaves look green? #card
Chlorophyll absorbs mostly red and blue light, while reflecting green light.
```

Before its first sync, a blank line ends a multiline card. The first sync adds
the card's `^af-...` block ID, which then becomes its authoritative endpoint.
That lets later edits pulled from Anki safely contain multiple lines or
paragraphs:

```markdown
Why do leaves look green? #card
Chlorophyll absorbs mostly red and blue light.

Leaves reflect more green light than other visible wavelengths.
^af-k3f8x2m1qz
```

Keep the generated block ID directly beneath the complete answer and avoid
editing or copying it by hand.

Add ordinary Obsidian tags anywhere on the card and Anki Forge will carry them into Anki:

```markdown
What does DNA stand for?::Deoxyribonucleic acid #biology #genetics
```

## Rich cards with callouts

For a card with a multi-line front, a multi-line back, or supporting detail, write it as an `[!anki]` callout. It renders as a tidy, collapsible box in Obsidian and still syncs to Anki:

```markdown
> [!anki] What is Workload Identity Federation?
> ![[wif-diagram.png]]
> ---
> A way for external workloads to obtain Google Cloud credentials
> **without long-lived service-account keys**.
> ---
> Related: [[Identity and Access Management]]
^af-1c5px49s0a
```

The quoted body is divided by `---` lines into up to three sections:

1. **Front** — the question. Text after `[!anki]` on the header line (the callout title) becomes the first line of the front.
2. **Back** — the answer.
3. **Extra** — optional supporting notes (see [The Extra field](#the-extra-field)).

Everything inside the callout renders normally in Obsidian — images, links, math, and formatting — so the card reads well both in your notes and in Anki.

For a card tested in both directions, use `> [!anki|reverse]` (or `> [!anki-reverse]`). Add a `-` after the type to start the box collapsed: `> [!anki]-`.

To drop in an empty card, run **Insert Anki card** or **Insert reversed Anki card** from the command palette, or right-click in the editor and choose one.

A few things to know:

- The first two `---` lines separate the sections. A `---` inside a fenced code block counts as content, but a stand-alone `---` elsewhere in an answer starts a new section — wrap such content in a code fence.
- Separate adjacent callouts with a blank line.
- The `^af-...` block ID goes on the line directly below the callout; Anki Forge adds it for you on the first sync.

## The Extra field

Every card has an **Extra** field in Anki. By default it holds a **CONTEXT** link back to the source note in Obsidian, along with the heading trail when "Include heading context" is on.

You can set your own Extra text per card:

- In a callout, add a third `---` section.
- On any single-line card, add an `<!--extra: ...-->` comment (hidden in Obsidian's reading view):

  ```markdown
  What does DNA stand for?::Deoxyribonucleic acid <!--extra: see the genetics note-->
  ```

Turn the field off entirely with the **Add Extra to cards** setting; cards then sync with an empty Extra.

## Choosing a deck

Add an `anki-deck` property to the top of a note:

```yaml
---
anki-deck: Biology
tags: [school]
---
```

This chooses the Anki deck and opts the note into automatic syncing. Notes without `anki-deck` are left alone unless you sync them manually.

By default, Anki Forge can also turn Obsidian folders into nested Anki decks. You can change this and the fallback deck in the plugin settings.

## Syncing

Open the command palette and choose one of these commands:

- **Sync current note to Anki**
- **Sync opted-in notes in current folder**
- **Sync all opted-in notes**

Before anything changes in Anki, you will see a preview with the number of cards to create, update, or delete. Nothing is applied until you approve it.

Anki Forge can also sync an opted-in note when you leave it and check for Anki edits when you open it. Both behaviors can be turned off in settings.

## Editing cards later

On the first sync, Anki Forge adds a small block ID below each card:

```markdown
What is the powerhouse of the cell?::The mitochondrion
^af-k3f8x2m1qz
```

That ID connects the Markdown card to the correct Anki note. It is normal Obsidian block-ID syntax. You can move the card around, but avoid editing or copying its `^af-...` line by hand.

If only Obsidian changed, the next sync updates Anki. If only Anki changed, Anki Forge can update the Markdown. If both changed, it shows both versions and asks which one you want to keep.

If a tracked note was deleted in Anki, Anki Forge keeps your Markdown text and visually strikes it through instead of silently deleting it.

## Media and formatting

Cards can contain common Markdown formatting, links, code blocks, math, images, and audio. Local media is copied into Anki's media collection during sync.

Embedded Markdown notes are expanded into the card. You can embed a whole note or one section:

```markdown
![[Cell biology]]
![[Cell biology#Mitochondria]]
```

Missing media or failed cards appear in a report. One bad card does not stop unrelated cards from syncing.

## Settings

You can configure:

- The AnkiConnect address
- The default deck and folder-based decks
- Default Anki tags
- Inline and reversed-card separators
- Heading context on cards
- Whether to add an Extra field to cards
- Automatic sync when leaving a note, independently toggleable
- Automatic pulling of Anki edits when opening a note, independently toggleable

## Privacy

Anki Forge sends card text and media only to the AnkiConnect endpoint in its settings. It has no accounts, telemetry, analytics, advertising, or payment features. Its card mappings and settings stay in Obsidian's local plugin data.

## Development

```sh
npm ci
npm run check
```

`npm run check` runs the test suite, TypeScript checks, and the production build. The finished plugin files are written to `dist/`.

## License

[MIT](LICENSE)
