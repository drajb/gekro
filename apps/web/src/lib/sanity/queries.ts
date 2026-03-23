// Using String.raw as a local groq tag to avoid @sanity/client export issues
// and provide syntax highlighting support in IDEs.
const groq = String.raw;

export const ALL_POSTS_QUERY = groq`
  *[_type == "post" && publishedAt <= now()] | order(publishedAt desc) {
    title,
    slug,
    description,
    tldr,
    publishedAt,
    body,
    "mainImage": featuredImage.asset->url,
    "topics": topics[]->title
  }
`;

export const RECENT_POSTS_QUERY = groq`
  *[_type == "post" && publishedAt <= now()] | order(publishedAt desc)[0...5] {
    title,
    slug,
    description,
    tldr,
    publishedAt,
    "mainImage": featuredImage.asset->url,
    "topics": topics[]->title,
    estimatedReadingTime
  }
`;

export const ALL_EXPERIMENTS_QUERY = groq`
  *[_type == "experiment"] | order(startDate desc) {
    title,
    slug,
    summary,
    status,
    stack,
    "mainImage": architectureDiagram.asset->url
  }
`;

export const TOPIC_CLUSTERS_QUERY = groq`
  *[_type == "topic"] {
    title,
    slug,
    "icon": icon.asset->url
  }
`;
