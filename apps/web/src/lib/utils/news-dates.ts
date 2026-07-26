/**
 * lib/utils/news-dates.ts — Full ISO 8601 timestamps for daily briefings
 *
 * WHY
 *  `publishedAt` in news frontmatter is date-only ("2026-07-24"). That is valid
 *  ISO 8601 and Google accepts it, but for a daily news feed the time is a real
 *  freshness signal in Google News / Top Stories, and a bare date is read as
 *  midnight UTC — up to ~9h earlier than the briefing actually shipped.
 *
 * HOW
 *  New briefings carry an exact `publishedTime` written by the generator at run
 *  time. The 53 briefings published before that field existed have no stored
 *  time, and their markdown is covered by the Content Protection Protocol, so we
 *  do NOT rewrite them — we derive a timestamp at render time instead. That
 *  fixes every historical article without touching a single content file.
 *
 *  PUBLISH_HOUR_UTC is the observed steady-state of the pipeline: the workflow
 *  cron is 07:00 UTC and GitHub Actions dispatches it around 09:2x-09:3x UTC.
 *  09:00Z is therefore a conservative, defensible anchor for the backfilled
 *  articles — far closer to the truth than the implied midnight.
 */

/** Observed publish window of the daily briefing workflow (UTC hour). */
const PUBLISH_HOUR_UTC = '09:00:00';

interface NewsDateFields {
  publishedAt: string;
  /** Exact ISO 8601 instant, present only on briefings generated after this shipped. */
  publishedTime?: string;
  updatedAt?: string;
}

/**
 * Full ISO 8601 instant for a briefing, e.g. "2026-07-24T09:26:11Z".
 * Falls back to the documented publish hour for pre-`publishedTime` articles.
 */
export function newsPublishedISO(data: NewsDateFields): string {
  const exact = data.publishedTime?.trim();
  // Only trust a stored value that actually parses — a malformed string would
  // otherwise emit invalid structured data sitewide.
  if (exact && !Number.isNaN(Date.parse(exact))) return new Date(exact).toISOString();
  return `${data.publishedAt}T${PUBLISH_HOUR_UTC}Z`;
}

/**
 * Full ISO 8601 instant for last modification. Briefings are auto-published and
 * not edited afterwards, so this equals the publish instant unless an explicit
 * `updatedAt` is present.
 */
export function newsModifiedISO(data: NewsDateFields): string {
  const upd = data.updatedAt?.trim();
  if (upd && !Number.isNaN(Date.parse(upd))) return new Date(upd).toISOString();
  return newsPublishedISO(data);
}

/**
 * How many of the newest briefings stay on /news/. Older ones are reachable
 * through the month archives, which keeps the index from growing without bound
 * (53 briefings already made it a 134KB page) while turning the tail into its
 * own set of indexable, query-shaped pages ("AI news July 2026").
 */
export const NEWS_INDEX_LIMIT = 30;

/** "2026-07-24" → { year: "2026", month: "07" }. Slug IS the date, so no parsing risk. */
export function newsMonthParts(publishedAt: string): { year: string; month: string } {
  const [year, month] = publishedAt.split('-');
  return { year, month };
}

/** "2026", "07" → "July 2026" */
export function formatMonthLabel(year: string, month: string): string {
  return new Date(`${year}-${month}-01T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
