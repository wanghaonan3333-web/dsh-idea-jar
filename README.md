# Idea Jar for DeepSeek Harness

English | [中文](README.zh.md)

Idea Jar is a floating creative tool for DeepSeek Harness Web. Click the transparent jar to generate one idea, then keep useful results as colored paper notes inside the jar.

## Features

- Generates general-purpose creative ideas with the currently configured DSH default model.
- Accepts an optional follow-up requirement after the first result; Enter generates again.
- Generates up to three candidates at once; "换一个" regenerates with the same requirement.
- Shows saved ideas as status-colored folded notes inside a transparent jar.
- Supports expand, edit, copy, AI optimization, delete, status changes, filtering, and undo for delete/optimize.
- Expands a favorite into an executable next-step breakdown (goal, first action, materials).
- Optionally sends a favorite to a new session as an executable prompt (off by default).
- Exports favorites to JSON or Markdown and imports JSON or the legacy dynamic-plugin backup.
- Persists favorites through the DSH Settings `idea-jar` namespace across page reloads, plugin updates, and DSH restarts.

## Install

### npm (recommended)

After the package is published:

```sh
dsh plugin --profile web add dsh-idea-jar
```

Restart `dsh web`, then refresh the browser page.

### GitHub source

```sh
dsh plugin --profile web add github:wanghaonan3333-web/dsh-idea-jar
```

GitHub installation runs the package `prepare` build. pnpm 10 and newer block dependency builds by default. Review the source, add the exact package key printed by the CLI to the profile's `pnpm-workspace.yaml` `allowBuilds`, and retry the installation.

### GitHub Release tarball

The prebuilt release avoids dependency-build approval:

```sh
dsh plugin --profile web add "https://github.com/wanghaonan3333-web/dsh-idea-jar/releases/latest/download/dsh-idea-jar-0.2.0.tgz"
```

## Usage

1. Click the transparent jar in the lower-right corner.
2. Favorite a generated idea with the star in its bubble.
3. Use "换一个" to regenerate or "来三条" to generate three candidates at once.
4. Open the library with the star button attached to the jar.
5. Edit, copy, optimize, expand, delete, or assign a status from each paper card.
6. Export or import from the toolbar at the top of the library.

Copy writes `category｜idea` to the system clipboard and reports browser permission failures on the card.

## Next steps and new session

- **下一步** expands a favorite into an executable breakdown: a one-line goal, the first action, and the materials or tools you need. The result is shown inline and can be copied; it is generated on demand and not persisted.
- **新会话** copies the favorite as an executable prompt and opens a new blank session through the DSH `workspaces` service; paste the copied prompt to start. It is hidden unless `enableNewSession` is set to `true`.

## Import and export

- **Export JSON** produces the canonical backup: full fidelity with status, re-importable on any machine.
- **Export Markdown** produces a human-readable list for sharing; it is read-only and not re-imported.
- **Import** accepts the plugin's own JSON backup (bare array or `{ "favorites": [...] }`) and the legacy dynamic-plugin `.idea-jar-favorites.txt` (tab-separated, base64-encoded category and idea).
- Deleting or optimizing a favorite shows a short-lived "撤销" toast that restores the previous state.

## Configuration

Override the complete `idea-jar` row config in the profile's `cordis.patch.yml`:

```yaml
- id: idea-jar
  config:
    maxFavorites: 200
    maxRequestChars: 2000
    maxIdeaChars: 1000
    maxTokens: 320
    maxBatch: 3
    enableNewSession: false
```

| Field | Default | Purpose |
|---|---:|---|
| `maxFavorites` | `200` | Maximum saved favorites. |
| `maxRequestChars` | `2000` | Maximum extra-requirement length. |
| `maxIdeaChars` | `1000` | Maximum saved idea length. |
| `maxTokens` | `320` | Output-token cap for generation, optimization, and expansion. |
| `maxBatch` | `3` | Maximum candidates per generation request. |
| `enableNewSession` | `false` | Show the "新会话" action that opens a new session with the idea as a prompt. |

## Data and permissions

- Favorites live in the `idea-jar` section of `$DSH_HOME/settings.yaml`; the plugin creates no project-local data file.
- Generation and optimization use the configured DSH default model and its existing credentials.
- The Host registers the same-origin POST endpoint `/idea-jar/api`; cross-site requests are rejected and bodies are capped at 2 MiB.
- The Client invokes the browser Clipboard API only after a copy click.
- The plugin contains no telemetry, advertising, or third-party analytics.

## Development

Node.js 22.19 or newer is required.

```sh
npm install
npm run check
```

Install the checkout into a Web profile:

```sh
dsh plugin --profile web add ./dsh-idea-jar
dsh --profile web --dump-config
```

The composed output should contain the `idea-jar` row.

## Publishing

1. Replace every `wanghaonan3333-web` placeholder in the project with the real GitHub owner.
2. Create a public GitHub repository and add the `dsh-plugin` topic.
3. Run `npm run check` and `npm pack --dry-run`.
4. Prefer `npm publish --access public` so installs use prebuilt artifacts.
5. After the repository is at least one day old and has at least 10 commits, submit the entry in `community/awesome-entry.yml` to `awesome-dsh-plugin/awesome-dsh-plugin`.

## Model experience

Generation and optimization are independent auxiliary model requests and do not enter the active chat session. The plugin sends one requirement or saved idea to the current default model and requests only `category｜idea`. Each call requests at most `maxTokens` output tokens. Changes to the requirement, saved idea, default model, or system prompt change the independent request prefix.

## Known limitations

- Settings persistence is local to one DSH installation and does not synchronize across devices.
- Clipboard access depends on browser permission and a trusted local context.
- The plugin targets the `web` profile and provides no headless UI.

## License

[MIT](LICENSE)
