/**
 * translations.ts - access to translated blog editions
 *
 * Lives beside posts.ts but is deliberately separate: getAllPosts() stays
 * English-only so translations never leak into the archive, topic hubs,
 * related posts, RSS or the posts API. Everything language-aware goes through
 * this module.
 *
 * Entry ids in the `translations` collection are "<lang>/<slug>" where <slug>
 * is the English post id. Entries whose language is not in the registry are
 * ignored here (scripts/verify-i18n.mjs fails the build on them instead).
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import { LANGUAGES, getLanguage, type Language } from '../languages';

export type TranslationEntry = CollectionEntry<'translations'>;

export interface TranslationRef {
  lang: Language;
  slug: string;
  entry: TranslationEntry;
}

/** Split a collection id ("hi/my-post") into its language and English slug. */
export function splitTranslationId(id: string): { lang: string; slug: string } {
  const i = id.indexOf('/');
  return { lang: id.slice(0, i), slug: id.slice(i + 1) };
}

/** URL of a translated post, trailing slash (decision-log 2026-04-17). */
export function translationPath(lang: string, slug: string): string {
  return `/blog/${lang}/${slug}/`;
}

/** URL of a language's archive page. */
export function languageArchivePath(lang: string): string {
  return `/blog/${lang}/`;
}

let cache: Promise<TranslationRef[]> | undefined;

/** Every translation in a registered language, in registry order then slug. */
export function getAllTranslations(): Promise<TranslationRef[]> {
  // Memoized: every blog page asks, and Astro logs a warning per call while
  // the collection is empty.
  cache ??= loadTranslations();
  return cache;
}

async function loadTranslations(): Promise<TranslationRef[]> {
  const entries = await getCollection('translations');
  const refs: TranslationRef[] = [];
  for (const entry of entries) {
    const { lang, slug } = splitTranslationId(entry.id);
    const language = getLanguage(lang);
    if (!language || !slug) continue;
    refs.push({ lang: language, slug, entry });
  }
  const order = (code: string) => LANGUAGES.findIndex((l) => l.code === code);
  return refs.sort((a, b) => order(a.lang.code) - order(b.lang.code) || a.slug.localeCompare(b.slug));
}

/** Translations of one English post, in registry order. */
export async function getTranslationsForSlug(slug: string): Promise<TranslationRef[]> {
  return (await getAllTranslations()).filter((r) => r.slug === slug);
}

/** All translated posts in one language, newest first. */
export async function getTranslationsForLang(code: string): Promise<TranslationRef[]> {
  return (await getAllTranslations())
    .filter((r) => r.lang.code === code)
    .sort((a, b) => b.entry.data.publishedAt.localeCompare(a.entry.data.publishedAt));
}

/** Languages that have at least one translated post, in registry order. */
export async function getActiveLanguages(): Promise<Language[]> {
  const present = new Set((await getAllTranslations()).map((r) => r.lang.code));
  return LANGUAGES.filter((l) => present.has(l.code));
}
