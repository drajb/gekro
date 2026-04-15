/**
 * lib/sanity/client.ts — Sanity CMS client (stub-safe)
 *
 * Exports a configured Sanity client when PUBLIC_SANITY_PROJECT_ID is set,
 * or a stub object whose fetch() always rejects when it's not.
 *
 * Callers (getAllPosts, getStaticPaths in blog/[slug].astro) wrap all fetches
 * in try/catch, so the stub rejection is handled gracefully and the site
 * builds cleanly with only local Content Collections.
 *
 * Configuration:
 *  useCdn: false  — ensures fresh data at build time (not CDN-cached)
 *  apiVersion     — pinned to 2024-03-22; update when adopting new Sanity APIs
 *
 * Required env vars (.env.local):
 *  PUBLIC_SANITY_PROJECT_ID — the Sanity project ID
 *  PUBLIC_SANITY_DATASET    — defaults to "production" if absent
 */

import { createClient } from "@sanity/client";

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;

// When projectId is missing (e.g. local dev without .env), provide a stub
// client whose fetch() always rejects. Callers already catch errors and
// fall back to local content collections.
export const client = projectId
  ? createClient({
      projectId,
      dataset: import.meta.env.PUBLIC_SANITY_DATASET || "production",
      useCdn: false,
      apiVersion: "2024-03-22",
    })
  : ({ fetch: () => Promise.reject(new Error("Sanity projectId not configured")) } as unknown as ReturnType<typeof createClient>);
