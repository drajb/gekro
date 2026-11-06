/**
 * games-list.ts - the browser games, read from the single registration point.
 *
 * Every game is listed in src/lib/utils/games.ts (GAME_GENRE), so the
 * game specs pick a new game up the moment it is registered instead of keeping
 * their own hand-written lists in step. Games live at /games/<slug>/.
 */
import { GAME_SLUGS } from '../src/lib/utils/games';

export const GAMES: string[] = [...GAME_SLUGS];
