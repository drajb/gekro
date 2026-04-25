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

## What It Does

The Password & Passphrase Generator creates cryptographically random passwords and human-readable passphrases using `window.crypto.getRandomValues()` — the same entropy source used by password managers and `openssl rand`. Password mode lets you configure character sets, length (8–128 characters), and symbol exclusion lists. Passphrase mode generates xkcd-style word sequences from the EFF Short Wordlist. Both modes display entropy in bits and an estimated crack time.

Nothing is stored or transmitted. The generated password exists only in your browser until you copy it and close the tab.

## How to Use It

**Password mode:**
1. Select character sets: uppercase, lowercase, digits, symbols (or any combination).
2. Set the **length** using the slider (8–128 characters).
3. Optionally enter characters to **exclude** (e.g., `0O1lI` for ambiguous characters that are easy to misread).
4. Click **Generate** or use the shortcut. The password appears with its entropy in bits.
5. Click **Copy** to copy immediately.

**Passphrase mode:**
1. Select the **number of words** (3–8). More words = more entropy, slightly longer to type.
2. Choose a **separator** (space, hyphen, dot, underscore, or none).
3. Click **Generate**. The passphrase appears with its entropy.
4. Click **Copy**.

## The Math / How It Works

**Entropy formula:** `entropy_bits = log2(pool_size ^ length)`

For passwords, `pool_size` is the number of distinct characters in your selected character sets:
- Lowercase only: 26 chars
- Lowercase + uppercase: 52 chars
- + digits: 62 chars
- + symbols: ~94 chars

A 16-character password with all character sets: `log2(94^16) ≈ 105 bits`. Considered extremely strong.

**Passphrase entropy:** `log2(1296^words)` — drawing from the EFF Short Wordlist of 1,296 words.

| Words | Entropy |
|-------|---------|
| 4 | ~41 bits |
| 5 | ~52 bits |
| 6 | ~62 bits |
| 7 | ~72 bits |
| 8 | ~83 bits |

**Why `crypto.getRandomValues()` matters:** `Math.random()` uses a deterministic pseudo-random number generator (PRNG) seeded at page load. With enough output, its state can be reconstructed — meaning an attacker who observes multiple values from `Math.random()` could predict future values. `crypto.getRandomValues()` draws from the OS entropy pool (hardware event timing, interrupt jitter), which is not deterministically reconstructible. Password generation requires this level of randomness; `Math.random()` is explicitly not appropriate.

**Rejection sampling for unbiased output:** drawing random characters naively using `random_byte % pool_size` introduces modulo bias — characters whose index falls below `256 % pool_size` appear slightly more often. The generator uses rejection sampling: generate more bytes than needed, discard those that would create bias, use the rest. This ensures every character in the pool is exactly equally likely.

## Why Password Security Matters More Than People Admit

The password security advice most people have internalized is wrong. "Use a mix of uppercase, lowercase, numbers, and symbols in 8 characters" is far weaker than "use 20 random characters." The complexity rules exist because they were easier to teach than entropy math, not because they reflect good security.

**Length beats complexity.** An 8-character password with all character types has `log2(94^8) ≈ 52 bits` of entropy. A 16-character lowercase-only password has `log2(26^16) ≈ 75 bits`. The longer password is vastly harder to crack despite using only 26 characters. Every additional character multiplies the search space by `pool_size`. Every additional character type adds a relatively small linear expansion to the pool — you get more from length.

**The case for passphrases:** a 6-word passphrase (`piano seven coral table dust hinge`) has ~62 bits of entropy and is memorable, typeable, and unambiguous to read aloud. A random 10-character password (`j#4Kp!mQzR`) has ~65 bits of entropy but is nearly impossible to remember or type without errors. For any password you need to type regularly — a laptop login password, a password manager master password — a passphrase is strictly better than a complex random string at comparable entropy.

**Why you should never generate passwords server-side:** if a server generates your password, the server's randomness, logging behavior, and code are all attack surfaces. A server that logs "generated password for user X" to a log file has just created a plaintext password in a log. Client-side generation in a local browser tool removes the server from the equation entirely. The generated password never touches a network.

**Password managers are the right infrastructure.** The correct workflow is: generate here → paste into your password manager (1Password, Bitwarden, etc.) → let the manager fill it everywhere. You never need to remember the password, it's always available, and it's different for every service.

## Tips & Power Use

- **For master passwords** (password manager, encrypted disk, PGP key): use 6–7 word passphrases. These are your most important credentials and you'll type them often. Passphrase entropy at 7 words (~72 bits) is strong enough for offline attack resistance; the memorability advantage of passphrases over random strings is significant.
- **For service account API keys and database passwords**: use password mode at 32+ characters, all character sets. You'll paste them, not type them, so memorability is irrelevant — maximize entropy.
- **Exclude ambiguous characters** (`0O1lI`) for passwords you might ever need to type or read aloud. The entropy reduction is negligible (removes ~5 characters from a 94-character pool).
- **100 bits of entropy is the benchmark for offline attack resistance.** Modern GPU clusters crack bcrypt hashes at ~100k hashes/second. At 100 bits of entropy, cracking is computationally infeasible at any current hardware scale.
- **For online-only credentials** (accounts with rate limiting), 50–60 bits of entropy is sufficient — the attack surface is rate-limited to thousands of attempts, not billions.
- **Re-generate if you've had the tab open for a while** — not because the entropy degrades, but because the generated value has been visible in the browser for that time. Minimize exposure time between generation and storage in a password manager.

## Entropy calculation

Entropy (bits) = `log2(pool_size ^ length)`. For passwords, pool size is the number of distinct characters in the selected sets. For passphrases, pool size is 1,296 (EFF wordlist size).

A 100-bit entropy password is considered extremely strong for offline attack resistance. For online-only systems, 50+ bits is sufficient.

## Limitations

- **Passphrase entropy** — actual entropy assumes the attacker knows you used this tool and the exact wordlist. Against an attacker who doesn't know the wordlist, effective entropy is higher.
- **Storage** — generated passwords are displayed only. They are not stored anywhere. Copy them immediately and save to a password manager.
