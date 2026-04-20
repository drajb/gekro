---
title: "JWT Decoder"
category: "dev"
job: "Decode JWT header, payload, and signature — fully client-side, never transmitted"
description: "Paste any JSON Web Token and instantly decode the header, payload, and signature. All decoding uses native browser APIs — no server contact, no libraries. Expiry and issue time are shown as human-readable dates with a live countdown. Algorithm and type are highlighted from the header."
aiSummary: "Client-side JWT decoder using native atob() and base64url normalization. Decodes header, payload, and signature without transmitting the token. Shows iat/exp/nbf as human-readable dates, validates structural integrity, and highlights common claims."
personalUse: "I decode JWTs dozens of times a week when debugging auth middleware. Having a local decoder means I never accidentally paste a production token into jwt.io."
status: "active"
publishedAt: "2026-04-20"
icon: "🔑"
license: "MIT"
---

## How this works

A JWT consists of three base64url-encoded segments separated by dots: `header.payload.signature`.

**Decoding process**

1. Split on `.` — any token with more or fewer than two dots is structurally invalid.
2. Normalise base64url to standard base64: replace `-` with `+` and `_` with `/`, then pad with `=` to the next multiple of 4.
3. Decode with `atob()` — a native browser function available in all modern browsers.
4. Parse the resulting string as JSON.

**Signature**

The signature is the third segment and is not JSON. It is displayed as raw base64url. The tool **does not verify the signature** — verification requires the secret key or public key, which would need to be supplied by you. Structural decoding is independent of signature validity.

**Claims**

| Claim | Meaning |
|-------|---------|
| `iss` | Issuer — who created the token |
| `sub` | Subject — who the token represents |
| `aud` | Audience — who the token is for |
| `exp` | Expiry — Unix timestamp; shown as local date + countdown |
| `nbf` | Not Before — token is invalid before this time |
| `iat` | Issued At — when the token was created |
| `jti` | JWT ID — unique identifier for this token |

## Security note

Never paste tokens from production systems into third-party web tools. This decoder runs entirely in your browser — the token is never sent anywhere — but the best practice is still to use a local tool. If you are pasting a token here, verify that the URL bar shows `gekro.com` and not a lookalike domain.

## Limitations

- **No signature verification** — supply your own key and use a proper JWT library if you need cryptographic validation.
- **Encrypted JWTs (JWE)** — JWE tokens have 5 segments and use a different structure. This tool decodes JWS (signed) tokens only.
