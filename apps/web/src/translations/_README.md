# Blog translations

One file per language per post: `src/translations/<lang>/<slug>.md`, where
`<slug>` is the English post's file name under `src/content/blog/`.

This folder is outside `src/content/` on purpose. English article markdown is
protected (CLAUDE.md section 6a); translations are machine output that tooling
may write and refresh.

Full rules, the frontmatter contract and the checks that enforce them are in
`.gekro/docs/i18n-standard.md`. Run `node scripts/verify-i18n.mjs` from the repo
root after any change here.
