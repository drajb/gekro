# Gekro Project Decision Log

- **2026-03-22**: Initial review of `gekro-blueprint.md`.
- **Decision 1**: Sanity Project ID to be added later once created by the user. Placeholders (`xxxx`) used in `sanity.config.ts`, `sanity.cli.ts`, and Astro integrations. Permission bypassed and logged per user instructions to keep moving.
- **Decision 2**: Will use the NPM scope `@gekro/` for internal monorepo packages (e.g. `@gekro/ui`, `@gekro/eslint-config`).
- **Decision 3**: Docker compose and infra configurations (n8n, Umami on Pi) will be kept in the same monorepo directory for easy portability.
