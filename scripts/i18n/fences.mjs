/**
 * fences.mjs - split a markdown body into prose with code-block placeholders
 *
 * Uses the same fence pattern as verify-i18n.mjs so "what counts as code" is
 * identical in the producer and the checker.
 */
const FENCE_RE = /^(```|~~~)[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm;

/** Replace every fenced block with {{CODE:n}} (1-based); return text and blocks. */
export function splitFences(body) {
  const normalized = body.replace(/\r\n/g, '\n');
  const blocks = [];
  const text = normalized.replace(FENCE_RE, (m) => {
    blocks.push(m);
    return `{{CODE:${blocks.length}}}`;
  });
  return { text, blocks };
}

/** Put the blocks back. Throws if placeholders and blocks do not line up. */
export function joinFences(text, blocks) {
  const found = [...text.matchAll(/\{\{CODE:(\d+)\}\}/g)].map((m) => Number(m[1]));
  const expected = blocks.map((_, i) => i + 1);
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw new Error(`code placeholders are ${JSON.stringify(found)}, expected ${JSON.stringify(expected)} (same numbers, same order)`);
  }
  return text.replace(/\{\{CODE:(\d+)\}\}/g, (_, n) => blocks[Number(n) - 1]);
}
