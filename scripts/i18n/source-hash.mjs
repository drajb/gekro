/**
 * source-hash.mjs - staleness fingerprint shared by every i18n tool
 *
 * A translation records the sha256 of the English post it was made from. When
 * the English title, description or body changes, the hash changes and
 * verify-i18n.mjs reports the translation as stale.
 *
 * Line endings and surrounding whitespace are normalised so a CRLF checkout
 * and an LF checkout hash identically. Any translation producer (Claude in a
 * session, a local model service) must use this exact function.
 */
import { createHash } from 'node:crypto';

export function normalizeBody(body) {
  return body.replace(/\r\n/g, '\n').trim();
}

export function sourceHash({ title, description, body }) {
  const payload = [title, description, normalizeBody(body)].join('\n---\n');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Minimal frontmatter reader for the shapes our posts use: top-level
 * `key: value` lines where value is a JSON-compatible string, number, boolean
 * or array. Nested keys are ignored (the checks never need them). Returns
 * { data, body }.
 */
export function parseFrontmatter(raw) {
  // Strip a UTF-8 byte-order mark (two English posts start with one).
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    const val = rawVal.trim();
    if (val === '') continue;
    try {
      data[key] = JSON.parse(val);
    } catch {
      data[key] = val.replace(/^['"]|['"]$/g, '');
    }
  }
  return { data, body: m[2] };
}
