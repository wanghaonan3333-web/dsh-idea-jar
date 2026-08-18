# Changelog

All notable changes to Idea Jar are documented here.

## 0.3.1

- Redesign the library as a compact warm-paper panel with focused primary actions and overflow menus.
- Retry one empty model response and show localized errors when no content is returned.
- Preserve the complete multi-line next-step plan instead of parsing it as a single idea line.

## 0.3.0

- Add next-step expansion: break a favorite into a one-line goal, first action, and materials list using the current default model.
- Add optional send-to-new-session handoff: copy a favorite as an executable prompt and open a new blank session. Off by default (`enableNewSession`).

## 0.2.0

- Generate up to three candidates at once, and regenerate with the same requirement.
- Export favorites to JSON or Markdown, and import JSON or the legacy dynamic-plugin backup.
- Undo delete and AI optimization.

## 0.1.0

- Initial release: generate ideas, favorite them as jar notes, edit, optimize, copy, delete, assign status, and persist favorites through DSH Settings.
