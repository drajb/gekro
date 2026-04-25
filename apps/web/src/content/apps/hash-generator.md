---
title: "Hash Generator"
category: "dev"
job: "Generate MD5, SHA-1, SHA-256, SHA-512, and HMAC hashes from text or files"
description: "Hash any text or file with MD5, SHA-1, SHA-256, SHA-384, or SHA-512. Add an HMAC secret for message authentication codes. Live computation, hex and base64 output, file drop support. Uses native Web Crypto API — nothing leaves your browser."
aiSummary: "A client-side cryptographic hash generator using the Web Crypto API for SHA-family algorithms and a pure-JS MD5 implementation. Supports text and file inputs, HMAC signing, and hex/base64 output encoding. Nothing is uploaded or sent anywhere."
personalUse: "Verifying file checksums, generating API signing keys, checking if a string matches a stored hash. I need this constantly and always forget which openssl flag does what."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "#️⃣"
---

## What It Does

Paste text or drop a file and this tool immediately computes its cryptographic hash across five algorithms simultaneously: MD5, SHA-1, SHA-256, SHA-384, and SHA-512. Toggle HMAC mode and add a secret key to generate message authentication codes instead of plain hashes. Output can be formatted as hex (the default, readable format) or base64 (compact, header-friendly).

Every computation runs locally in your browser using the native Web Crypto API. No data is transmitted anywhere.

## How to Use It

**Text mode** — type or paste any text into the input area. Hashes update instantly on every keystroke. Character count is shown so you can verify you have the expected input.

**File mode** — switch to the File tab, then either drag and drop a file onto the drop zone or click "Choose file." The tool reads the file as a raw byte stream and hashes it directly — the same way `sha256sum` on Linux works. File name and size are shown for confirmation.

**HMAC mode** — check "Enable HMAC" and enter a secret key. Instead of hashing just your input, the tool computes an HMAC (Hash-based Message Authentication Code): a keyed hash that proves both the content and knowledge of the secret. Useful for API signing and webhook verification.

**Encoding** — switch between Hex and Base64 output. Hex is the conventional format for checksums and debugging. Base64 is preferred in HTTP headers, JSON payloads, and anywhere where binary-safe encoding matters.

## SHA vs MD5 vs HMAC — Which to Use When

| Algorithm | Output | Use this for | Avoid for |
|-----------|--------|--------------|-----------|
| **SHA-256** | 256 bits / 64 hex chars | General-purpose hashing, file integrity, API signing | Nothing — this is the safe default |
| **SHA-512** | 512 bits / 128 hex chars | Maximum security, long-term archival signatures | Bandwidth-constrained contexts |
| **SHA-384** | 384 bits / 96 hex chars | TLS certificates, FIPS-compliant systems | Cases where SHA-256 is sufficient |
| **SHA-1** | 160 bits / 40 hex chars | Legacy systems only, git object IDs | Any new security work — deprecated |
| **MD5** | 128 bits / 32 hex chars | Non-security checksums, file deduplication | Anything with security implications |
| **HMAC-SHA256** | 256 bits | API request signing, webhook verification | One-way hashing (HMAC requires a shared secret) |

The rule of thumb: default to SHA-256 for everything. Use SHA-512 when you need extra margin. Use MD5 only for checksums where collisions don't matter (e.g., comparing two files you control). Never use MD5 or SHA-1 for passwords, signatures, or certificates.

## Why Developers Need This

**File integrity verification** — download a binary, compute its SHA-256, and compare against the publisher's posted checksum. This is how you know the file wasn't tampered with in transit.

**API authentication** — most APIs (GitHub webhooks, Stripe, AWS) authenticate requests by computing an HMAC-SHA256 of the request body with a shared secret and checking that the signature matches. This tool lets you verify or debug those signatures manually.

**Password verification concepts** — passwords are never stored as plaintext; they're stored as salted hashes. Hashing a known value here helps you understand the transformation, test a hash function before implementing it, or verify a test vector matches a library's output.

**Data deduplication** — hash file contents, not filenames. Two files with identical SHA-256 hashes are identical in content, regardless of name or metadata.

**Debug and audit** — quickly verify that two data sources produce the same serialized output by hashing both and comparing. Saves hours of diff hunting.

## Understanding HMAC

A plain hash is deterministic and public: anyone can hash `"hello"` and get the same SHA-256. This is useful for integrity checking but useless for authentication — an attacker can compute the same hash.

HMAC (Hash-based Message Authentication Code) fixes this by mixing a secret key into the computation at both the start and end of the hash (the two-pass inner/outer structure from RFC 2104). The result: only someone who knows the secret key can produce or verify the MAC.

The key insight: HMAC-SHA256 is not just `SHA256(key + message)`. Naive concatenation is vulnerable to length-extension attacks. The HMAC construction is specifically designed to prevent this class of attack, which is why you should always use a proper HMAC library or this tool rather than rolling your own.

Common HMAC use cases:
- **Webhook signatures** (GitHub, Stripe, Shopify all use HMAC-SHA256)
- **JWT HS256 tokens** (the signature is an HMAC-SHA256 of the header.payload)
- **Cookie signing** (Flask's session cookies, for example)
- **API request signing** (AWS Signature Version 4)

## Web Crypto API — Why This Matters for Security

SHA-family hashing in this tool uses the browser's native `crypto.subtle.digest()` API — a W3C-standardized interface to the same underlying cryptographic primitives used by TLS and OS-level crypto libraries. The browser implementation is:

- **Native code** — no JavaScript implementation overhead; uses the OS or hardware crypto accelerator
- **Not reproducible in JS without care** — the Web Crypto API enforces secure contexts (HTTPS or localhost only)
- **Side-channel resistant** — the spec mandates implementations avoid timing attacks

MD5 is the one exception: it uses a pure-JS implementation because `crypto.subtle` dropped MD5 support as part of deprecating the algorithm from the Web Crypto standard. The JS implementation is correct but slower on large files.

## Limitations & Security Notes

- **MD5 is broken for security** — MD5 collisions are computationally trivial. Two different files can produce the same MD5 hash. Do not use it for any security-sensitive purpose.
- **SHA-1 is deprecated** — NIST deprecated SHA-1 in 2011. Google demonstrated a collision in 2017 (SHAttered attack). Use SHA-256 or above.
- **HMAC requires secret management** — the secret key must be kept confidential and shared out-of-band. Entering a secret key here is safe (nothing is transmitted), but the key itself is your responsibility.
- **Hashing is not encryption** — hashes are one-way. You cannot recover the original input from a hash. If you need to reverse a short string hash, an attacker with a dictionary can too.
- **File size** — very large files (multiple GB) may cause the browser tab to use significant memory during hashing. The computation is still correct, just slow.
