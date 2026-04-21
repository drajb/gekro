---
title: "systemd Unit File Generator"
category: "infra"
job: "Generate a properly-formatted systemd unit file from a command, restart policy, env vars, and user — with security-hardening defaults baked in"
description: "Pick the unit type (simple / forking / oneshot / notify), enter your command, set restart policy and env vars, optionally add a user/group and working directory. The tool emits a complete .service file with the security-hardening defaults you should always have but rarely remember (NoNewPrivileges, ProtectSystem, PrivateTmp, etc.). Copy-paste-ready."
aiSummary: "A client-side systemd unit file generator that emits .service files with security-hardening directives baked in (NoNewPrivileges, ProtectSystem, ProtectHome, PrivateTmp, RestrictAddressFamilies, etc.). Supports all major unit types (simple, forking, oneshot, notify, idle), restart policies (always, on-failure, no), environment variable injection (inline or via EnvironmentFile), runtime user/group specification, working directory, and resource limits (MemoryMax, CPUQuota). Output includes inline comments explaining each directive."
personalUse: "I run ~12 services on my Pi cluster as systemd units. Every time I add a new one, I look up the same security directives and forget half of them. This emits the unit file I should have been writing all along — with the hardening defaults I keep meaning to apply."
status: "active"
publishedAt: "2026-04-20"
lastVerified: "2026-04-20"
companionPostSlug: ""
license: "MIT"
icon: "⚙️"
---

## How this works

Fill in the form. Tool emits a complete `.service` unit file with:

- **The unit type and command** you specified
- **Restart policy** (default: `on-failure` with 5s delay)
- **Environment variables** — inline `Environment=` or pointing at `EnvironmentFile=`
- **User / Group** — runs as the specified non-root user (default: `nobody`)
- **Working directory** if you provided one
- **Resource limits** — optional `MemoryMax`, `CPUQuota`
- **Security hardening** — the directives you should always set but never remember

## Security hardening defaults

These are baked in by default (toggle off only with reason):

| Directive | Effect |
|---|---|
| `NoNewPrivileges=true` | Prevents `setuid` escalation |
| `ProtectSystem=strict` | Mounts `/usr`, `/boot`, `/etc` read-only |
| `ProtectHome=true` | Hides `/home`, `/root`, `/run/user` |
| `PrivateTmp=true` | Per-service `/tmp` (no shared tmp attacks) |
| `PrivateDevices=true` | No access to `/dev` except `/dev/null`, `/dev/zero`, `/dev/random` |
| `ProtectKernelTunables=true` | `/proc/sys`, `/sys` read-only |
| `ProtectKernelModules=true` | Cannot load/unload kernel modules |
| `ProtectControlGroups=true` | `/sys/fs/cgroup` read-only |
| `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX` | Drops AF_NETLINK, AF_PACKET, etc. unless needed |
| `RestrictNamespaces=true` | Cannot create new namespaces |
| `LockPersonality=true` | Cannot change exec personality |
| `MemoryDenyWriteExecute=true` | No W^X violations |

These pair well with `systemd-analyze security <unit>` which scores your unit and tells you which hardening you're missing.

## Why I built this

The systemd unit format is verbose, the security directives are documented in 8 different man pages, and most copy-paste examples online were written before the security hardening directives existed. The result: most services running on the average Pi are running with privileges and access they don't need.

This generates the unit file the way it should be written by default. Paste, install, run.

## Limitations

- **No socket-activated unit support** — generates `.service` only, not `.socket` companions
- **No user services** — emits system services (`/etc/systemd/system/`); user services (`~/.config/systemd/user/`) work the same but the install path differs
- **No timer companion** — for cron-replacement use cases, the matching `.timer` unit is left as an exercise
- **No drop-in overrides** — generates the full unit file, not partial drop-ins
