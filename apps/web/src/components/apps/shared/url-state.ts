/**
 * url-state.ts — URL querystring state sync for gekro apps
 *
 * readState()  — reads URL params, coerces types from defaults, fills gaps with defaults
 * writeState() — updates window.location with replaceState (no history pollution)
 * shareLinkUrl() — returns the full current URL for the share-link button
 */

type StateValue = string | number | boolean;
type StateDefaults = Record<string, StateValue>;

export function readState<T extends StateDefaults>(defaults: T): T {
  const params = new URLSearchParams(window.location.search);
  const result = { ...defaults };

  for (const key of Object.keys(defaults)) {
    const raw = params.get(key);
    if (raw === null) continue;

    const defaultVal = defaults[key];
    if (typeof defaultVal === 'boolean') {
      (result as any)[key] = raw === 'true';
    } else if (typeof defaultVal === 'number') {
      const n = Number(raw);
      if (!isNaN(n)) (result as any)[key] = n;
    } else {
      (result as any)[key] = raw;
    }
  }

  return result;
}

export function writeState(state: Record<string, StateValue>): void {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    params.set(key, String(value));
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

export function shareLinkUrl(): string {
  return window.location.href;
}
