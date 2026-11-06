/**
 * games-list.ts - the browser games, read from the single registration point.
 *
 * Every game is marked `'GameApplication'` in src/lib/utils/apps-seo.ts, so the
 * game specs pick a new game up the moment it is registered instead of keeping
 * their own hand-written lists in step.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const seo = readFileSync(join(process.cwd(), 'src/lib/utils/apps-seo.ts'), 'utf8');

export const GAMES: string[] = [...seo.matchAll(/'([a-z0-9-]+)':\s*'GameApplication'/g)].map((m) => m[1]);
