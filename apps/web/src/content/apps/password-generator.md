---
title: "Password & Passphrase Generator"
category: "dev"
job: "Generate cryptographically random passwords and human-readable passphrases"
description: "Generate secure passwords or xkcd-style passphrases using window.crypto.getRandomValues — the same entropy source used by password managers. Choose character sets, length, symbols, and exclusion lists. Passphrase mode uses the EFF word list for natural language output. Nothing is stored or transmitted."
aiSummary: "Client-side password generator using window.crypto.getRandomValues for unbiased randomness. Offers character-set-configurable password mode (8–128 chars) and passphrase mode with EFF wordlist (3–8 words). Shows entropy in bits and estimated crack time."
personalUse: "I generate service-account passwords and passphrase-style API keys here. The entropy display tells me exactly how strong the output is before committing it to 1Password."
status: "active"
publishedAt: "2026-04-20"
icon: "🔐"
license: "MIT"
---

## How this works

All randomness comes from `window.crypto.getRandomValues()`, a cryptographically secure pseudo-random number generator (CSPRNG) built into every modern browser. This is the same source used by password managers and `openssl rand`.

**Password mode** builds a character pool from the selected sets (uppercase, lowercase, digits, symbols) and draws from it using the rejection-sampling method — drawing more random bytes than needed and discarding those that would introduce modular bias. This ensures every character in the pool is equally likely.

**Passphrase mode** uses the EFF Short Wordlist (1,296 words). Drawing N words from a 1,296-word list gives `log2(1296^N)` bits of entropy:

| Words | Entropy | Example |
|-------|---------|---------|
| 4 | ~41 bits | `table coral seven dust` |
| 5 | ~52 bits | `piano seven coral table dust` |
| 6 | ~62 bits | strong enough for most use cases |

## Entropy calculation

Entropy (bits) = `log2(pool_size ^ length)`. For passwords, pool size is the number of distinct characters in the selected sets. For passphrases, pool size is 1,296 (EFF wordlist size).

A 100-bit entropy password is considered extremely strong for offline attack resistance. For online-only systems, 50+ bits is sufficient.

## Limitations

- **Passphrase entropy** — actual entropy assumes the attacker knows you used this tool and the exact wordlist. Against an attacker who doesn't know the wordlist, effective entropy is higher.
- **Storage** — generated passwords are displayed only. They are not stored anywhere. Copy them immediately and save to a password manager.
