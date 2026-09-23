# Working in docs/

Before you write or edit any page under `docs/`, or the root `README.md`, read
[STYLE.md](./STYLE.md) and follow it. It defines the voice, the section rhythm,
the page templates, when to use each callout, and the facts that several pages
repeat and must keep in sync.

Practical notes:

- Run `pnpm format` after editing, then `pnpm docs:build`. The build fails on dead links.
- `STYLE.md` and this file are excluded from the published site through `srcExclude` in `.vitepress/config.mts`. Add any other non-page Markdown there too.
- New example pages need a sidebar entry in `.vitepress/config.mts` and a row in `examples/README.md`. Highlighted examples also get a card in `index.md`.
- Runnable code in an example page must match the spec it links to under `examples/`.
- The Simplified Chinese site lives in `zh/` and mirrors every page at the same relative path. When you change an English page, update its `zh/` twin in the same change. Code blocks stay byte-for-byte identical. Chinese headings carry an explicit `{#id}` equal to the English heading's slug, so anchors and cross-links keep working. New pages also need an entry in the `zh` sidebar in `.vitepress/config.mts`.
