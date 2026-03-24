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
