---
title: "Docker Compose Visualizer"
category: "infra"
job: "Paste docker-compose.yml and see your service graph — dependencies, ports, volumes, networks, all rendered visually"
description: "Drop in a docker-compose.yml file and the tool renders a service dependency graph (depends_on arrows), with ports, volumes, environment variables, and networks shown per service. Catches the most common compose mistakes — missing depends_on, port collisions, orphan networks — and surfaces them inline. 100% client-side YAML parsing, no upload."
aiSummary: "A client-side docker-compose.yml visualizer that parses YAML and renders services as cards with their image, ports, volumes, environment, and depends_on relationships. Detects port collisions across services, orphan networks (declared but unused), missing depends_on for shared databases, and circular dependencies. Outputs a service dependency graph as either ASCII or Mermaid. Built for self-hosted infrastructure work where compose files grow to 10+ services and become hard to reason about visually."
personalUse: "My Pi cluster runs ~12 services across 3 nodes via docker-compose. When I'm debugging why something can't reach the database, the first question is always 'is the depends_on chain right?' This shows me in one glance."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "🐳"
---

## How this works

Paste any docker-compose.yml (v2 or v3 format) and the tool:

1. **Parses the YAML** using a built-in subset parser (no external dep)
2. **Extracts each service's** image, ports, volumes, environment, depends_on, networks
3. **Renders each service as a card** with all its config visible
4. **Generates a dependency graph** as ASCII art and Mermaid syntax
5. **Runs lint checks** for the most common compose mistakes

## What it catches

| Issue | Example | Severity |
|---|---|---|
| Port collision | Two services both binding `8080:80` | High |
| Orphan network | Network declared but no service uses it | Low |
| Missing depends_on | App service references DB env vars but no depends_on | Medium |
| Circular dependency | A depends on B depends on A | High |
| Implicit `latest` tag | `image: postgres` (no tag pinned) | Medium |
| Missing restart policy | No `restart:` directive on long-running services | Low |
| Privileged container | `privileged: true` flagged | Medium |
| Bind mount of `/` | `/:/host` or similar | High |

## Why I built this

A 12-service docker-compose file is hard to reason about textually. You can't see at a glance "if I restart the postgres service, what else needs to restart?" or "which service is binding port 5432?" without scrolling and counting indentation.

This is the visualization I kept wishing existed in my Pi cluster work. The Mermaid output also pastes directly into experiment writeups and architecture docs.

## Limitations

- **YAML subset only** — handles standard compose v2/v3 syntax. Doesn't handle YAML anchors/aliases (`&` and `*`), multi-doc files (`---`), or external `${VAR}` substitution
- **No swarm/stack-specific syntax** — `deploy:` blocks are read but not deeply analyzed
- **No `build:` graph** — only services with an `image:` are graphed; multi-stage build chains aren't traversed
- **No security audit beyond simple checks** — for real CIS Docker Benchmark validation, use `docker-bench-security`
