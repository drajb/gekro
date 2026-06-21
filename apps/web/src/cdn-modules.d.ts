// Ambient declaration for runtime ESM imports from a CDN URL specifier —
// e.g. `await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@.../+esm')`
// in the translator and rag-eval-toolkit apps. TypeScript cannot resolve URL
// module specifiers; these imports are intentionally dynamic and carry a
// `/* @vite-ignore */` so the bundler leaves them as runtime CDN fetches.
// This stops `astro check` from erroring (ts2307) on them.
declare module 'https://*';
