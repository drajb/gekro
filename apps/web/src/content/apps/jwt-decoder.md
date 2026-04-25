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

## What It Does

The JWT Decoder takes a JSON Web Token and instantly decodes all three parts: the header (algorithm, token type), the payload (claims, expiry, subject, issuer), and the signature segment. Timestamp claims (`iat`, `exp`, `nbf`) are shown as human-readable dates with a live expiry countdown. Everything runs in the browser using native APIs — the token is never transmitted anywhere.

It's the fastest way to inspect a JWT when debugging auth middleware, checking token expiry, or verifying the claims your backend is encoding without setting up a full auth test harness.

## How to Use It

1. Paste any JWT into the input field. A valid JWT looks like three base64url strings separated by dots: `xxxxx.yyyyy.zzzzz`.
2. The decoder splits on dots and decodes each segment immediately.
3. The **header** panel shows the algorithm (`alg`) and token type (`typ`).
4. The **payload** panel shows all claims, with `iat`, `exp`, and `nbf` converted to human-readable datetime strings.
5. The **expiry countdown** shows time remaining (or time since expiry) in real time.
6. The **signature** panel shows the raw base64url signature string — not verified, just displayed.

## The Math / How It Works

A JWT consists of three base64url-encoded segments separated by dots: `header.payload.signature`.

**Decoding process:**
1. Split on `.` — any token with more or fewer than two dots is structurally invalid.
2. Normalize base64url to standard base64: replace `-` with `+` and `_` with `/`, then pad with `=` to the next multiple of 4.
3. Decode with `atob()` — a native browser function available in all modern browsers, no library needed.
4. Parse the resulting string as JSON for the header and payload segments.

**Why base64url instead of standard base64?** Standard base64 uses `+` and `/` as characters, which have special meaning in URLs (`+` = space, `/` = path separator). JWTs are frequently embedded in URLs (query strings, `Authorization` headers). Base64url substitutes `-` for `+` and `_` for `/`, making the token URL-safe without percent-encoding.

**JWT claims reference:**

| Claim | Meaning |
|-------|---------|
| `iss` | Issuer — who created the token (e.g., `https://auth.example.com`) |
| `sub` | Subject — who the token represents (usually a user ID) |
| `aud` | Audience — intended recipient(s) of the token |
| `exp` | Expiry — Unix timestamp; shown as local date + countdown |
| `nbf` | Not Before — token is invalid before this time |
| `iat` | Issued At — when the token was created |
| `jti` | JWT ID — unique identifier for this specific token |

**Signature segment:** the third part of the JWT is the signature — an HMAC or RSA/ECDSA signature over the first two segments. This tool displays the raw base64url value but **does not verify the signature**. Verification requires the server's secret key (HMAC) or public key (RSA/ECDSA), which you would supply yourself. Decoding and verification are independent operations.

## Why JWT Debugging Requires a Local Tool

JWT debugging comes up constantly in auth middleware development: a request is failing with 401, the token claims look right in the code that generates them, but something downstream is rejecting it. The fastest diagnosis path is to grab the raw token from the Authorization header and decode it to check what's actually being sent.

**The exp claim is the most common culprit.** Tokens with 15-minute expiry windows fail in production systems where clocks between services drift more than expected, or where a cached token isn't refreshed in time. The live expiry countdown here shows exactly how much time a specific token has left — or how long ago it expired.

**The signature MUST be verified server-side.** This tool only decodes the payload — it does not verify that the signature is valid. A JWT with a manipulated payload but a broken signature is structurally decodable here but will (correctly) fail verification on any properly implemented server. Never trust a decoded JWT payload client-side without server-side signature verification. The payload is base64-encoded, not encrypted or signed from the client's perspective — anyone with the token can read the claims.

**JWTs are not secret by default.** They're signed, not encrypted. Unless you're using JWE (JSON Web Encryption, 5 segments), anyone who intercepts the token can read all the claims in the payload. This is why JWTs should not contain sensitive information like SSNs, full credit card numbers, or passwords — only identifiers and non-sensitive metadata.

**Auth debugging workflow:** when an API call returns 401 and the client is sending a Bearer token, copy the token from the `Authorization` header (visible in browser DevTools > Network > request headers), paste it here, and immediately see: is the token expired? Does the `aud` claim match what the server expects? Does the `sub` match the expected user? This answers 80% of JWT auth debugging questions without touching server logs.

## Tips & Power Use

- **Check `exp` before filing a bug report.** If the token is expired, that's the issue — not a server bug. The expiry countdown makes this unambiguous.
- **Compare `iat` and `exp` to verify token lifetime.** If `exp - iat` = 900 seconds (15 minutes) and you expected 24 hours, the token generation code has a configuration error.
- **The `aud` claim mismatch** is the second most common 401 cause after expiry. If your server expects `aud: api.example.com` and the token contains `aud: auth.example.com`, the server will correctly reject it. Decoding reveals this immediately.
- **JWE tokens have 5 segments** — header, encrypted key, IV, ciphertext, tag — and the payload is encrypted, not just base64-encoded. This tool only handles JWS (signed) tokens. If you paste a JWE and get a parse error, that's why.
- **Use the [Unix Timestamp Converter](/apps/unix-timestamp-converter/)** if you want to decode a specific `exp` value you're looking at in code before it exists as a full token.
- **Never paste production tokens into jwt.io or any third-party service.** This decoder runs entirely in your browser — the token is never sent anywhere. Verify you're on `gekro.com` before pasting sensitive tokens.

## Security note

Never paste tokens from production systems into third-party web tools. This decoder runs entirely in your browser — the token is never sent anywhere — but the best practice is still to use a local tool. If you are pasting a token here, verify that the URL bar shows `gekro.com` and not a lookalike domain.

## Limitations

- **No signature verification** — supply your own key and use a proper JWT library if you need cryptographic validation.
- **Encrypted JWTs (JWE)** — JWE tokens have 5 segments and use a different structure. This tool decodes JWS (signed) tokens only.
