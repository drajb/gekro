---
title: "SSH Config Generator"
category: "infra"
job: "Build ~/.ssh/config host blocks from a form — ProxyJump, IdentityFile, forwarding"
description: "Generate ~/.ssh/config entries for any number of SSH hosts. Set host alias, HostName, User, IdentityFile, ProxyJump, agent forwarding, keepalives, and more — with inline comments explaining each directive. No memorizing syntax."
aiSummary: "A form-driven ~/.ssh/config file generator supporting multiple hosts with per-host settings for HostName, User, Port, IdentityFile, IdentitiesOnly, ForwardAgent, LocalForward, ProxyJump, ServerAliveInterval, ServerAliveCountMax, StrictHostKeyChecking, and LogLevel. Outputs annotated config with inline comments explaining each directive."
personalUse: "I have a Pi 5 cluster, a VPS, and a Mac mini — all with different keys, ports, and jump hosts. Without a good SSH config, every connection command is a paragraph. This keeps my config readable."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "🔐"
---

## What It Does

This tool generates a complete `~/.ssh/config` file from a form. Fill in one or more host entries — alias, hostname, user, key path, ProxyJump, keepalives — and it produces a ready-to-paste config block with inline comments on every non-obvious directive.

The output is the exact file SSH reads when you type `ssh alias`. No flags, no long commands. Just `ssh pi5` and you're in.

## How to Use It

1. **Fill in the first host entry.** The alias is the short name you'll type (`pi5`, `prod`, `vps`). HostName is the actual IP or domain. User defaults to `ubuntu`.

2. **Add your identity file.** If you use a non-default key (anything other than `~/.ssh/id_rsa`), set the IdentityFile path. Enable IdentitiesOnly if the server rejects other keys offered by your agent.

3. **Configure a ProxyJump if needed.** If this host sits behind a bastion server, pick the bastion from the dropdown (it must be defined as another host entry above) or type a custom jump address. This replaces the `-J` flag in every connection command.

4. **Enable keepalives.** ServerAliveInterval keeps idle connections alive — critical for Pi clusters on a home network where the router drops idle sessions. Default: 60s interval, 3 retries.

5. **Add more hosts.** Click "+ Add host" to add a second entry. Each host is collapsible — click the header to expand or collapse it.

6. **Copy or export.** Use the toolbar buttons to copy the config to clipboard or download it as `config` (no extension — that's the correct filename).

7. **Save it.** Paste into `~/.ssh/config` and run:
   ```
   chmod 600 ~/.ssh/config
   ```

### Example: Connecting to a Pi behind a VPS bastion

```
Host vps
    HostName 203.0.113.10
    User deploy
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host pi5
    HostName 192.168.1.101
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump vps
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

With this config: `ssh pi5` connects to your VPS first, then jumps to the Pi — all in one command, with the right key, without typing any IPs or flags.

## Every Directive Explained

| Directive | What it does |
|---|---|
| `Host` | The alias you type. SSH matches this against the destination you pass on the command line. Wildcards work: `Host *.internal` |
| `HostName` | The actual IP address or FQDN SSH connects to. Can differ from the alias — the alias is just a label. |
| `User` | Username to log in as. Without this you'd need `ssh ubuntu@192.168.1.100`. |
| `Port` | Non-default port. Omitted from output when it's the default 22. |
| `IdentityFile` | Path to your private key. SSH tries this key before anything else. Supports `~` expansion. |
| `IdentitiesOnly` | Tells SSH to only offer the `IdentityFile` key — never offer agent keys or other default keys. Useful when servers limit auth attempts and you don't want agent keys wasting them. |
| `ForwardAgent` | Passes your local SSH agent through to the remote host. Lets you SSH onward (to another host) from the remote without copying your private key there. Disable on untrusted servers. |
| `LocalForward` | Creates a local port tunnel: traffic to `local_port` on your machine is forwarded to `remote:port` through the SSH connection. Classic use: `5432 localhost:5432` to access a remote database as if it were local. |
| `ProxyJump` | Route this connection through one or more jump hosts. SSH handles the hop chain transparently — no need for nested SSH commands. |
| `ServerAliveInterval` | Interval (seconds) between keepalive packets sent to the server. Prevents idle connections from being dropped by firewalls or NAT devices. |
| `ServerAliveCountMax` | Number of unanswered keepalives before SSH gives up and disconnects. Total patience = Interval × CountMax. |
| `StrictHostKeyChecking` | `yes` = reject unknown hosts. `no` = accept any key (risky). `accept-new` = trust new hosts but reject changed keys (best for dynamic infra). Default leaves it up to SSH's own policy. |
| `LogLevel` | Verbosity of SSH output. `QUIET` suppresses banners. `VERBOSE`/`DEBUG` are useful when diagnosing connection failures. |

## Why Infra Engineers Need This

SSH configs look simple until they're not. Typing `ssh ubuntu@192.168.1.101 -i ~/.ssh/id_ed25519 -J deploy@203.0.113.10 -L 5432:localhost:5432` once is annoying. Typing it fifty times a day is a failure mode.

The `~/.ssh/config` file solves this by letting you name hosts and pre-set every option. The problem: the syntax is not memorable unless you write it daily, and the non-obvious directives — `IdentitiesOnly`, `ForwardAgent`, `ProxyJump` — are easy to misconfigure in ways that silently degrade security or cause confusing auth failures.

The most common infra SSH mistakes I see:
- **No IdentitiesOnly with IdentityFile.** Agent offers all keys; server with `MaxAuthTries 3` rejects the connection before it tries the right key.
- **ForwardAgent everywhere.** Appropriate for a trusted bastion you control. Not appropriate for `ssh prod` on a shared server where a compromised user can hijack your agent.
- **No keepalives.** Home routers drop idle TCP sessions after 60–120 seconds. Your SSH session silently hangs. `ServerAliveInterval 60` eliminates this.
- **Manual ProxyJump flags.** `-J user@bastion` works but means you're typing it every time. A config entry makes it automatic.

## SSH Config for a Pi Cluster

My Pi cluster has three nodes — `pi5-1`, `pi5-2`, `pi5-3` — on a `192.168.2.x` subnet, accessible only through a VPS jump host. Here's the config pattern:

```
# Jump host (internet-facing VPS)
Host bastion
    HostName 203.0.113.10
    User deploy
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3

# Pi cluster nodes (local subnet, only reachable via bastion)
Host pi5-1
    HostName 192.168.2.101
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump bastion
    ForwardAgent yes
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host pi5-2
    HostName 192.168.2.102
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump bastion
    ForwardAgent yes
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host pi5-3
    HostName 192.168.2.103
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump bastion
    ForwardAgent yes
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

With this config: `ssh pi5-2` connects through the bastion to node 2 with the right key, agent forwarding enabled for onward hops, and keepalives on. The bastion itself is `ssh bastion`. No flags, no IPs.

`ForwardAgent yes` on the Pi nodes is safe here because I control the bastion — there's no untrusted user who could hijack the forwarded agent.

## Security Best Practices

**IdentitiesOnly — always use it with IdentityFile.** Without it, SSH may offer every key your agent holds before trying the one you specified. Servers with `MaxAuthTries` limits will close the connection before reaching your key. `IdentitiesOnly yes` forces SSH to only try the key you've declared.

**ForwardAgent — scope it carefully.** Agent forwarding is powerful and risky. An attacker with root on the remote host can use your forwarded agent to connect to other hosts as you. Enable it only on hosts you fully control (your own bastion, your own cluster nodes). Never enable it on `ssh prod-db` for a third-party service.

**StrictHostKeyChecking — use accept-new for dynamic infra.** The default behavior prompts on first connection. `accept-new` automates the trust decision for new hosts but maintains protection against host key changes (which could indicate a MITM or a reprovisioned server). Use it on home lab and dynamic cloud infra. Use `yes` when connecting to high-stakes servers where any key change should be a hard stop.

**File permissions — chmod 600 is not optional.** SSH refuses to read `~/.ssh/config` if it's world-readable. The error message is opaque (`Bad owner or permissions on ~/.ssh/config`). Set permissions immediately after creating or editing the file:
```
chmod 600 ~/.ssh/config
chmod 700 ~/.ssh/
```

**Separate keys per host (or at least per role).** Using one key for everything means a key compromise exposes all hosts. Using `id_ed25519_pi_cluster` for the cluster and `id_ed25519_vps` for your VPS limits blast radius. Ed25519 keys are short, fast, and more secure than RSA-2048.

## Limitations

- **Wildcards in Host** — the tool generates explicit host blocks only. SSH supports `Host *.internal` wildcard blocks for applying settings to groups of hosts — write those manually.
- **Match blocks** — SSH config supports `Match` conditional blocks (match by user, address, OS, etc.). The tool doesn't generate these.
- **Include directives** — splitting configs across multiple files with `Include ~/.ssh/conf.d/*` is a valid pattern for large configs. Not generated here.
- **SOCKS proxy** — `DynamicForward` (SOCKS5 proxy) is not included. Add `DynamicForward 1080` manually for browser proxying through an SSH tunnel.
- **Multiple ProxyJump hops** — the ProxyJump field supports `user@host1,user@host2` chains, but the form only picks a single host. Edit the output manually for multi-hop chains.
