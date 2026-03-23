import { createClient } from "@sanity/client";

export const client = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID || "tpon4xn2",
  dataset: process.env.PUBLIC_SANITY_DATASET || "production",
  useCdn: false,
  apiVersion: "2024-03-22",
});
