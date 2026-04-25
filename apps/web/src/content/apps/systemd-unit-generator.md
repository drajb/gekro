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

## What It Does

systemd Unit File Generator produces a complete, properly-formatted `.service` file from a form — no manual lookup of directives, no copy-paste from outdated StackOverflow answers. Security-hardening directives are baked in by default. Output includes inline comments explaining each directive. Copy, install, enable, and run.

## How to Use It

1. Enter your service **name** and **description**.
2. Set the **unit type**: simple (default), forking, oneshot, notify, or idle.
3. Enter the **ExecStart command** — the full path to the binary and its arguments.
4. Choose a **restart policy**: `on-failure` (default), `always`, `no`, or `on-abnormal`.
5. Add **environment variables** — inline `KEY=VALUE` pairs or an `EnvironmentFile` path.
6. Optionally set **User / Group**, **WorkingDirectory**, **MemoryMax**, and **CPUQuota**.
7. Copy the generated unit file.

Install and enable:
```bash
sudo cp myservice.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable myservice
sudo systemctl start myservice
```

Check status:
```bash
systemctl status myservice
journalctl -u myservice -f
```

## Why Services Need Proper Unit Files

The gap between "running a process" and "running a production service" is exactly the gap between `nohup ./app &` and a proper systemd unit file.

`nohup ./app &` puts a process in the background. It doesn't restart if the process crashes. It doesn't start at boot. It runs as root (unless you manually `sudo -u`) . The process has access to your entire filesystem, all your devices, and can load kernel modules. If the process is compromised or buggy, it has maximum blast radius.

A systemd unit with proper security hardening:
- **Restarts automatically** on failure, with configurable backoff
- **Starts at boot** when enabled
- **Runs as a non-privileged user** with the minimum necessary permissions
- **Has a restricted filesystem view** — can't see `/home`, can't write to `/usr` or `/etc`
- **Has a private `/tmp`** — can't read files other services left in shared tmp
- **Cannot escalate privileges** via setuid binaries
- **Cannot load kernel modules** or modify kernel tunables
- **Gets its own network socket namespace** restrictions

The security directives aren't optional hardening — they're the correct default for any service you didn't explicitly design to need root or broad filesystem access.

## Security Hardening Defaults — What Each Directive Does

These are baked in by default and togglable with reason:

| Directive | Effect | Attack surface closed |
|---|---|---|
| `NoNewPrivileges=true` | Prevents `setuid` binary execution | Privilege escalation via compromised binary |
| `ProtectSystem=strict` | Mounts `/usr`, `/boot`, `/etc` read-only | Persistent filesystem modification |
| `ProtectHome=true` | Hides `/home`, `/root`, `/run/user` | Credential theft from user home directories |
| `PrivateTmp=true` | Per-service `/tmp` — not shared | Tmp file snooping and symlink attacks across services |
| `PrivateDevices=true` | No `/dev` except null, zero, random | Raw device access, disk reads from other partitions |
| `ProtectKernelTunables=true` | `/proc/sys`, `/sys` read-only | Kernel parameter manipulation |
| `ProtectKernelModules=true` | Cannot load/unload kernel modules | Rootkit-via-module insertion |
| `ProtectControlGroups=true` | `/sys/fs/cgroup` read-only | Container escape via cgroup manipulation |
| `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX` | Blocks AF_NETLINK, AF_PACKET, etc. | Raw network packet capture, low-level netlink operations |
| `RestrictNamespaces=true` | Cannot create new namespaces | Container escape vectors |
| `LockPersonality=true` | Cannot change exec personality | ABI compatibility attack vectors |
| `MemoryDenyWriteExecute=true` | No writable+executable memory | JIT-based shellcode injection |

The generator includes all of these with comments explaining each one. You can toggle off any directive that your specific service legitimately requires — for example, `PrivateDevices` needs to be off for services that access hardware devices directly.

## How to Read `systemd-analyze security` Output

After installing a unit, `systemd-analyze security myservice.service` gives it a security score and a table of each directive's status. The score ranges from 0 (fully exposed) to 10 (fully hardened). The table shows which directives are applied and which are missing.

A typical unprotected service scores 4–5. A service generated by this tool with all hardening directives scores 8–9. Scores above 9 require additional hardening that most services don't need (system call filtering via `SystemCallFilter`, capability dropping beyond `NoNewPrivileges`, `MemoryAccounting`).

The output looks like:
```
→ Overall exposure level for myservice.service: 2.4 SAFE
  ✓ PrivateTmp=         Service has private tmp namespace
  ✓ NoNewPrivileges=    Service cannot gain new privileges
  ✗ SystemCallFilter=   System call allow list not defined
```

Use `systemd-analyze security` after every new unit file to confirm the hardening is taking effect.

## The Pi Cluster Use Case for Long-Lived ML Inference Services

Running an LLM inference server (llama.cpp, Ollama, vLLM lite) on a Raspberry Pi 5 or similar edge hardware as a persistent service is a real use case. The requirements are specific:

- **Restart on OOM.** Inference servers can exhaust memory under heavy requests. `Restart=on-failure` with `RestartSec=10s` handles this automatically.
- **MemoryMax.** Set a memory ceiling lower than total RAM to prevent the inference server from killing the OS. `MemoryMax=3G` on a 4GB Pi prevents total system lockup.
- **CPUQuota.** If you're running other services alongside inference, `CPUQuota=80%` leaves headroom for system tasks and SSH.
- **Working directory.** Inference servers often look for model files relative to their working directory. `WorkingDirectory=/opt/models` makes this explicit.
- **EnvironmentFile.** API keys, model paths, and inference parameters belong in an environment file (`/etc/myservice/env`) with restricted permissions (`chmod 600`), not hardcoded in the unit file.
- **Non-root user.** Create a dedicated system user (`adduser --system --no-create-home mlserve`) and run the inference server as that user. It doesn't need root for any inference task.

The generated unit file for an inference service pairs naturally with the [Docker Compose Visualizer](/apps/docker-compose-visualizer/) approach — use Docker if you need container isolation; use systemd if you want native performance and simpler resource accounting on constrained hardware.

## Tips & Power Use

- **Check `journalctl -u myservice -f`** immediately after starting the service. The first 30 seconds often reveal permission issues that the security directives caused — a service trying to write to a path that's now read-only, for example. Fix these by removing only the specific directives your service needs.
- **Use `EnvironmentFile=` for secrets.** Inline `Environment=API_KEY=secret` in the unit file is readable by `systemctl show`. Use `EnvironmentFile=/etc/myservice/env` with the file permissions set to 600 and owned by the service user.
- **Set `After=network.target`** for any service that makes network connections on startup. Without this, the service may start before the network interface is configured, fail to connect, and exit.
- **`oneshot` with `RemainAfterExit=yes`** is the right pattern for initialization scripts — tasks that run once at boot and don't keep a process running. The service appears as "active" even after the script exits.
- **Resource limits are soft floors, not hard safety nets.** `MemoryMax=3G` triggers OOM kill when the service exceeds 3 GB. It doesn't prevent the service from accumulating memory up to that point. Watch `systemctl status` and `journalctl` for OOM kill events.

## Limitations

- **No socket-activated unit support** — generates `.service` only, not `.socket` companions for socket activation
- **No user services** — emits system services (`/etc/systemd/system/`); user services (`~/.config/systemd/user/`) have the same format but different install paths and no network access by default
- **No timer companion** — for cron-replacement use cases, the matching `.timer` unit is left as an exercise; `systemd-cron` handles the translation
- **No drop-in overrides** — generates the full unit file; drop-ins (`.d/` directories) let you extend a unit without modifying the original, which is useful for distribution-managed services
- **Security directives may conflict with specific services** — `MemoryDenyWriteExecute` breaks JIT compilers (Node.js V8, JVM JIT). Toggle off for services that use JIT compilation.
