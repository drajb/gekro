/**
 * languages.ts - registry of blog translation languages
 *
 * Single source of truth for every language the blog is translated into.
 * English is the default edition and is NOT listed here: it lives at
 * /blog/<slug>/ and is never routed through the translation pipeline.
 *
 * Translated posts live at /blog/<lang>/<slug>/ (see pages/blog/[lang]/).
 * Adding a language = one entry here + a UI-strings entry in i18n.ts + a font
 * rule in global.css. Nothing else is language-aware.
 *
 * Fields:
 *  code      - folder name under src/translations/ and the URL segment
 *  endonym   - the language's own name, shown in the switcher (no flags)
 *  english   - English name, used in prose and logs
 *  bcp47     - value for <html lang>, JSON-LD inLanguage and hreflang
 *  ogLocale  - Open Graph locale (underscore form)
 *  dir       - text direction
 *  dateLocale- Intl locale for dates, with Latin digits forced (-u-nu-latn) so
 *              numerals match the digits kept inside translated prose
 *  fontFamily- Google Fonts family loaded only on pages in that language
 *  titleMax  - max characters of "<title> | gekro" before SERP truncation,
 *              per script (CJK and Indic glyphs are wider)
 */

export interface Language {
  code: string;
  endonym: string;
  english: string;
  bcp47: string;
  ogLocale: string;
  dir: 'ltr' | 'rtl';
  dateLocale: string;
  fontFamily: string;
  titleMax: number;
}

export const LANGUAGES: Language[] = [
  { code: 'hi', endonym: 'हिन्दी', english: 'Hindi', bcp47: 'hi', ogLocale: 'hi_IN', dir: 'ltr', dateLocale: 'hi-IN-u-nu-latn', fontFamily: 'Noto Sans Devanagari', titleMax: 50 },
  { code: 'bn', endonym: 'বাংলা', english: 'Bengali', bcp47: 'bn', ogLocale: 'bn_IN', dir: 'ltr', dateLocale: 'bn-IN-u-nu-latn', fontFamily: 'Noto Sans Bengali', titleMax: 50 },
  { code: 'mr', endonym: 'मराठी', english: 'Marathi', bcp47: 'mr', ogLocale: 'mr_IN', dir: 'ltr', dateLocale: 'mr-IN-u-nu-latn', fontFamily: 'Noto Sans Devanagari', titleMax: 50 },
  { code: 'te', endonym: 'తెలుగు', english: 'Telugu', bcp47: 'te', ogLocale: 'te_IN', dir: 'ltr', dateLocale: 'te-IN-u-nu-latn', fontFamily: 'Noto Sans Telugu', titleMax: 50 },
  { code: 'ta', endonym: 'தமிழ்', english: 'Tamil', bcp47: 'ta', ogLocale: 'ta_IN', dir: 'ltr', dateLocale: 'ta-IN-u-nu-latn', fontFamily: 'Noto Sans Tamil', titleMax: 50 },
  { code: 'zh', endonym: '简体中文', english: 'Chinese (Simplified)', bcp47: 'zh-Hans', ogLocale: 'zh_CN', dir: 'ltr', dateLocale: 'zh-CN-u-nu-latn', fontFamily: 'Noto Sans SC', titleMax: 30 },
  { code: 'es', endonym: 'Español', english: 'Spanish', bcp47: 'es', ogLocale: 'es_ES', dir: 'ltr', dateLocale: 'es-ES-u-nu-latn', fontFamily: 'Inter', titleMax: 60 },
  { code: 'ar', endonym: 'العربية', english: 'Arabic', bcp47: 'ar', ogLocale: 'ar_AR', dir: 'rtl', dateLocale: 'ar-u-nu-latn', fontFamily: 'Noto Sans Arabic', titleMax: 50 },
];

/** English edition metadata, used by the switcher and hreflang. */
export const ENGLISH = { id: 'en', endonym: 'English', bcp47: 'en-US', ogLocale: 'en_US' } as const;

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export function getLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function isLanguageCode(code: string): boolean {
  return LANGUAGE_CODES.includes(code);
}

/** Google Fonts CSS URL for a language's script family (null when Inter covers it). */
export function fontHref(lang: Language | undefined): string | null {
  if (!lang || lang.fontFamily === 'Inter') return null;
  const family = lang.fontFamily.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
}
