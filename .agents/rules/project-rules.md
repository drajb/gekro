---
trigger: always_on
---

### GEKRO.COM — ANTIGRAVITY WORKSPACE RULES v1.0

## Project Identity
This is gekro.com — a personal AI engineering lab and tech blog.
Stack: Astro 4, Tailwind CSS v4, TypeScript, Sanity CMS, Three.js, GSAP, Motion One.
Monorepo managed with Turborepo + pnpm workspaces.
The main site lives at apps/web/. Sanity Studio at apps/studio/.

## Code Quality Rules
- TypeScript strict mode always. No `any` types without explicit comment explaining why.
- All components are .astro files unless interactivity requires a framework island (.tsx).
- Use Astro's built-in Image component for ALL images. Never raw <img> tags.
- CSS via Tailwind utility classes. No inline styles unless dynamic (CSS variables only).
- All colours and design tokens via CSS variables defined in src/styles/global.css.
- Never hardcode hex values in components — always reference a CSS variable.

## File Naming Conventions
- Components: PascalCase.astro (e.g. PostCard.astro)
- Pages: lowercase kebab-case (e.g. about.astro, blog-archive.astro)
- Utilities: camelCase.ts (e.g. readingTime.ts)
- Sanity schemas: camelCase.ts (e.g. post.ts, slideDeck.ts)
- Never abbreviate — clarity over brevity in file names.

## Animation Rules
- Hero animations: Three.js only. Never animate the hero with CSS — it must be WebGL.
- All GSAP code must be wrapped in a check: `if (typeof window !== 'undefined')` to prevent SSR errors.
- All animations must include a `prefers-reduced-motion` media query fallback.
- Motion One is for UI micro-interactions only (buttons, cards, inputs).
- Scroll animations via GSAP ScrollTrigger only — do NOT use Intersection Observer manually.
- Animation durations: Hero = 1000-1500ms, Page transitions = 300ms, Micro = 150-200ms.

## Performance Rules
- Lighthouse score targets: Performance ≥ 95, Accessibility = 100, Best Practices = 100, SEO = 100.
- Three.js and GSAP must be dynamically imported (lazy-loaded), never in frontmatter.
- All third-party scripts (Giscus, Beehiiv, YouTube) must use `loading="lazy"` or be deferred.
- Images: use WebP format, always set width and height to prevent layout shift.
- No more than 2 web font families loaded. Use `font-display: swap`.

## SEO & AI Discoverability Rules
- Every page MUST include the SEOHead.astro component with populated title, description, and ogImage.
- Every blog post and experiment MUST include JSON-LD structured data via JsonLD.astro.
- Every post MUST have a populated `aiSummary` field in Sanity (2 sentences, plain text, no markdown).
- The TLDR.astro block must appear before the first H2 on every post.
- Canonical URLs must always be set explicitly.
- The public /api/posts.json endpoint must always stay live and return valid JSON.

## Content Generation Rules (when writing content for the blog)
- Write in first person as the site owner — confident, direct, no corporate vocabulary.
- Every post must include: a TLDR, at least one code block, and a conclusion with "what I learned."
- Technical accuracy first. Honesty about failures is preferred over polished success narratives.
- Never use: "In this article I will...", "In conclusion...", "It's worth noting that...", "I'm excited to share..."
- Code examples must be complete and runnable. No placeholder ellipsis `...` in code blocks.
- Always include estimated reading time (auto-computed — do not hardcode).

## Git & Deployment Rules
- Never commit directly to `main`. Always work on `dev` or a `feature/*` branch.
- Commit messages: conventional commits format — `feat:`, `fix:`, `content:`, `chore:`, `style:`
- Before pushing: run `pnpm lint` and `pnpm typecheck` from the repo root.
- Environment variables: NEVER hardcode API keys. Always use import.meta.env.
- The `.env.local` file is gitignored. Always update `.env.example` when adding new vars.

## Folder Rules
- New components go in the correct subfolder of src/components/ (blog/, ui/, hero/, etc.).
- New pages go in src/pages/. New layouts in src/layouts/. New utilities in src/lib/utils/.
- Never create files in the repo root. Shared config belongs in packages/.
- Sanity schema changes: always update both the schema file AND the TypeScript type definitions.

## Design System Rules
- Dark mode is the default and only mode (toggle may be added in Phase 2).
- Use the established colour palette CSS variables — no new colours without updating global.css first.
- Typography scale is defined in typography.css — do not override with arbitrary font sizes.
- Card components must use: surface background, border, subtle shadow, and hover state.
- Spacing: prefer Tailwind's scale (4px base). No arbitrary pixel values without comment.

## Accessibility Rules
- All interactive elements must be keyboard navigable.
- All images require descriptive alt text. Decorative images use alt="".
- Colour contrast must meet WCAG AA minimum (4.5:1 for text).
- Focus rings must be visible — never use `outline: none` without a custom focus style.
- ARIA labels required on all icon-only buttons.