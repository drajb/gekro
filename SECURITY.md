# Security Policy

## This is a personal project, provided as-is

gekro.com is the personal website, blog, and engineering lab of **Rohit Burani**.
Everything here - the writing, the apps, the news feed, the code - is Rohit's own
personal work, built and maintained by Rohit alone.

It is offered **strictly as-is, with no warranty of any kind.** Use it at your own
risk. Rohit is not liable for any loss, damage, or consequence of any kind arising
from the use of this site or its apps - including, but not limited to, lost data,
incorrect output, or anything that catches fire on your end. Nothing here is
professional financial, medical, legal, or engineering advice. If something
matters, verify it yourself.

By using this site or its apps, you accept this as-is, at-your-own-risk basis.

---

## Overview

gekro.com is a static website hosted on Cloudflare Pages. It has **no backend
server, no database, and no user accounts.** The interactive tools under `/apps`
run entirely in your browser. This design removes whole classes of vulnerabilities
(SQL injection, server-side RCE, auth bypass, session hijacking) because none of
that infrastructure exists.

---

## Reporting a Vulnerability

If you believe you have found a security vulnerability, please report it privately.
**Do not open a public GitHub issue for security problems.**

There is no security email address. Report through either:

- The in-app channel on the relevant app page, or
- The contact form at https://gekro.com/contact

Please include:

1. A clear description of the issue and its potential impact.
2. Step-by-step instructions to reproduce it.
3. The affected URL(s) or app(s).
4. Your browser and OS version, if relevant.
5. A proof-of-concept (screenshot, short video, or code) where possible.

**What to expect:** this is a personal project maintained by one person in his
spare time. Reports are read and taken seriously, but there are **no guaranteed
response times and no paid bug bounty.** Well-researched reports are genuinely
appreciated.

---

## Security Model

### The site
- **Static only.** Pages are pre-rendered at build time and served as static files
  from Cloudflare's CDN. There is no application server to compromise.
- **HTTPS everywhere**, enforced by Cloudflare.
- **No accounts, no logins, no passwords.** Credentials are never requested or stored.
- **No personal data collected by the site itself.** There is no database and no
  storage of submitted data on Rohit's own infrastructure.

### The apps (`/apps`)
- **Client-side by design.** Every calculator and tool runs in your browser. The
  files, text, images, and PDFs you load are processed locally and are **never
  uploaded to gekro.com or any third-party server.**
- **No persistent storage of your data.** Apps do not save your inputs; reloading
  the page clears everything. (A few apps cache a downloaded open-source helper
  library in your browser for performance - that is library code, not your data.)
- **Sandboxed code execution.** The HTML Viewer app, which renders user-pasted
  HTML/JS, runs that code inside an iframe sandboxed with
  `sandbox="allow-scripts allow-modals allow-forms allow-popups"` and
  **deliberately without `allow-same-origin`.** This forces a null origin so pasted
  scripts cannot read gekro.com cookies, localStorage, or the parent DOM.
- **Provided as-is.** The apps are free utilities offered without warranty (see the
  disclaimer on every app page). They are not certified for handling regulated,
  classified, or safety-critical data - use your own judgement for sensitive material.

### Third-party services
The site loads a small, fixed set of third-party resources, each governed by its
own security and privacy policy:
- **Cloudflare** (hosting, CDN, TLS, bot protection).
- **Google Analytics 4 / Google Tag Manager** and **Cloudflare Web Analytics** for
  aggregate, non-identifying traffic measurement.
- **Beehiiv** (newsletter embed) and **Giscus** (blog comments), only on pages that
  use them.
- **jsDelivr / Hugging Face CDN** for on-demand, lazy-loaded open-source libraries
  used by a few apps (e.g. PDF and embedding-model code).

---

## Scope

### In scope
- Cross-site scripting (XSS) or HTML injection on gekro.com or any app.
- Sandbox escapes in the HTML Viewer app.
- Content injection that could mislead readers (e.g. spoofed citations or links).
- Vulnerabilities in Rohit's own application code in this repository.
- Exposure of any secret or credential accidentally committed to the repo.

### Out of scope
- Vulnerabilities in third-party services (Cloudflare, Google, Beehiiv, Giscus,
  jsDelivr) - report those to the respective vendor.
- The intended client-side behavior of apps (e.g. "the app runs JavaScript I paste
  into it" - that is the documented purpose of the HTML Viewer, contained by the
  sandbox).
- Missing security headers that do not lead to a demonstrable exploit.
- Denial of service, volumetric, or brute-force attacks.
- Automated scanner output without a working proof of concept.
- Social engineering, physical attacks, or attacks requiring a compromised
  device/browser.
- Reports about the absence of a bug bounty.

---

## Supported Versions

gekro.com is continuously deployed. Only the **currently live version** at
https://gekro.com is supported and patched. There are no versioned releases or
long-term support branches.

| Version            | Supported |
| ------------------ | --------- |
| Live (gekro.com)   | ✅        |
| Older git history  | ❌        |

---

## Safe Harbor

Rohit will not pursue legal action against researchers who:

1. Make a good-faith effort to avoid privacy violations, data destruction, and
   service disruption.
2. Only interact with their own data or test data, never another user's.
3. Do not exploit a finding beyond the minimum needed to demonstrate it.
4. Give a reasonable opportunity to remediate before any public disclosure.

Acting in line with this policy is considered authorized conduct.

---

## Responsible Disclosure

Please allow a reasonable window before publicly disclosing a vulnerability - ideally
until a fix is deployed. Coordination and credit are welcome.

---

*This is Rohit Burani's personal work. Provided as-is, at your own risk.*
*Last updated: 2026-06-02*
