---
title: "Nginx Config Generator"
category: "infra"
job: "Generate nginx server blocks for static sites, reverse proxies, and PHP — with SSL"
description: "Build production-ready nginx server blocks from a form. Supports static file serving, reverse proxy with WebSocket, PHP-FPM, and redirect configs. Generates SSL configuration with Let's Encrypt paths and security headers. No memorizing directives."
aiSummary: "A form-driven nginx server block generator supporting static sites, reverse proxy (with WebSocket), PHP-FPM, and HTTP redirect configurations. Outputs annotated nginx config with SSL support, gzip, proxy headers, and correct try_files patterns."
personalUse: "Every time I set up a new service on the Pi cluster I go blank on the exact proxy_pass and proxy_set_header syntax. This has my standard configuration one click away."
status: "active"
publishedAt: "2026-04-24"
lastVerified: "2026-04-24"
companionPostSlug: ""
license: "MIT"
icon: "🌐"
---

## What It Does

This tool generates complete nginx `server {}` blocks from a form. Pick a configuration type — static site, reverse proxy, PHP-FPM, or redirect — fill in your domain and paths, toggle SSL, and it produces a commented, copy-paste-ready config.

The output is what goes in `/etc/nginx/sites-available/yourdomain.com`. Symlink it to `sites-enabled`, test with `nginx -t`, reload, and you're serving.

## The Four Configuration Types

**Static site** — Serve files from a directory on disk. Use this for Astro/Next.js builds, documentation sites, or any frontend where the build step produces HTML/CSS/JS files. Includes gzip compression and cache headers for versioned assets.

**Reverse proxy** — Forward requests to a local backend process. Use this for Node.js APIs, Python FastAPI apps, Go services, or anything that binds to a local port (`http://127.0.0.1:3000`). Includes the standard header set (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto) and an optional WebSocket upgrade block.

**PHP-FPM** — Serve PHP applications (WordPress, Laravel, custom PHP) via FastCGI. Nginx handles static files directly; `.php` requests are passed to the PHP-FPM process via Unix socket. More efficient than Apache's mod_php because nginx is event-driven and doesn't fork per request.

**Redirect** — 301 or 302 all traffic from one domain/URL to another. Common use cases: `www` → non-www (or vice versa), old domain → new domain, HTTP → HTTPS (though the SSL toggle handles that automatically with a dedicated block).

### When to use each

| Scenario | Config type |
|---|---|
| Deploying an Astro site | Static site |
| Running a Node.js/FastAPI/Go service | Reverse proxy |
| Self-hosting WordPress | PHP-FPM |
| Migrating `old.com` to `new.com` | Redirect |
| Any service with `ws://` connections | Reverse proxy + WebSocket toggle |

## Every Directive Explained

**`server_name`** — The domain(s) this block responds to. Nginx matches the `Host` header against this. List multiple names separated by spaces: `example.com www.example.com`. Use `_` as a catch-all default server.

**`listen`** — The port and protocol. `listen 80` accepts HTTP. `listen 443 ssl` accepts HTTPS. When the SSL toggle is on and HTTP→HTTPS redirect is checked, the tool emits two blocks: a `listen 80` block that 301-redirects to HTTPS, and a `listen 443 ssl` block for the actual content.

**`ssl_certificate` / `ssl_certificate_key`** — Paths to your TLS certificate chain and private key. Let's Encrypt stores these at `/etc/letsencrypt/live/yourdomain.com/fullchain.pem` and `privkey.pem`. Update the domain in the path after running Certbot.

**`ssl_protocols`** — The generated config restricts to `TLSv1.2 TLSv1.3`, dropping the broken TLS 1.0 and 1.1. Most modern clients support TLS 1.2+. If you need to support very old browsers, add `TLSv1.0 TLSv1.1` — but don't.

**`root`** — The filesystem path nginx serves files from. For static sites and PHP-FPM, nginx looks here for requested files before falling back to `try_files` rules.

**`index`** — The filename(s) nginx serves when a directory is requested. `index.html index.htm` is the standard for static sites. PHP sites add `index.php`.

**`try_files`** — The resolution chain for each request. `$uri $uri/ =404` tries the exact file, then as a directory (looking for an index file), then returns 404. SPAs typically use `$uri $uri/ /index.html` to let the JavaScript router handle 404s — change the last argument in the output to match.

**`proxy_pass`** — The upstream URL nginx forwards requests to. Local processes use `http://127.0.0.1:PORT`. Use `http://` not `https://` for local connections — there's no TLS overhead benefit on loopback, and it adds complexity.

**`proxy_set_header Host $host`** — Passes the original `Host` header to the backend. Without this, the backend sees nginx's internal upstream address instead of the domain the client requested — breaks virtual hosting and CORS.

**`proxy_set_header X-Real-IP`** — Passes the client's IP address to the backend. Without this, your backend logs show `127.0.0.1` for every request instead of the real client IP.

**`proxy_set_header X-Forwarded-For`** — The standard header for chains of proxies. Appends the client IP to any existing forwarding chain. Use this instead of X-Real-IP if your backend needs to trust the full chain.

**`proxy_set_header X-Forwarded-Proto $scheme`** — Tells the backend whether the original request was HTTP or HTTPS. Needed for apps that generate redirect URLs — without it, an HTTPS app might generate `http://` links.

**WebSocket headers (Upgrade + Connection)** — WebSocket requires an HTTP upgrade handshake. `proxy_set_header Upgrade $http_upgrade` and `proxy_set_header Connection "upgrade"` pass the upgrade request through nginx to the backend. Also requires `proxy_http_version 1.1` — HTTP/1.0 doesn't support keepalive connections needed for WebSocket.

**`fastcgi_pass`** — For PHP-FPM, this points to the PHP process. Unix sockets (`unix:/var/run/php/php8.2-fpm.sock`) are faster than TCP (`127.0.0.1:9000`) because they bypass the network stack entirely. Find your socket path with `grep listen /etc/php/*/fpm/pool.d/www.conf`.

**`gzip on`** — Compresses text responses before sending. Reduces transfer size significantly for HTML, CSS, JS, and JSON. `gzip_vary on` adds a `Vary: Accept-Encoding` header so CDNs cache both compressed and uncompressed versions correctly.

**Cache-Control headers for static assets** — `expires 1y; add_header Cache-Control "public, immutable"` tells browsers to cache versioned assets for a year without revalidating. Only safe if your assets have content-hashed filenames (Astro/Vite/webpack do this by default). The `access_log off` line suppresses logging for these cached requests — they'd drown your logs.

**`return 301 $target`** — The correct way to implement redirects in nginx. `return` is evaluated before any file system access and is faster than a `rewrite` rule. `$request_uri` in the target preserves the path and query string.

## Why Infra Engineers Need This

Nginx's config format is not difficult, but it is dense with footguns. The correct reverse proxy block requires at least 6 directives to work properly — get one wrong and you're debugging CORS errors, logging `127.0.0.1` for every request, or wondering why WebSocket disconnects after 60 seconds.

The errors I keep seeing on Pi cluster deploys:

- **Missing proxy headers.** Backends see `127.0.0.1` as the client IP. Apps generating links produce `http://` when the client is on `https://`.
- **Wrong `try_files` for SPAs.** `$uri $uri/ =404` returns 404 on deep links that the JS router should handle. The fix is the last argument: `/index.html` instead of `=404`.
- **Forgetting the HTTP→HTTPS redirect block.** SSL is enabled, but `http://` still works — search engines index both. A separate `listen 80` redirect block fixes this.
- **`proxy_http_version` missing for WebSocket.** WebSocket upgrade fails silently. The error in the browser console says "WebSocket connection failed" with no useful detail. The fix is one line: `proxy_http_version 1.1`.
- **PHP path traversal.** A naive FastCGI config processes `image.png/index.php` as PHP. `try_files $uri =404;` before `fastcgi_pass` blocks this.

## Setting Up SSL with Let's Encrypt

The generated SSL config uses the paths Certbot writes by default. To get a certificate:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get a certificate (Certbot modifies nginx config automatically)
sudo certbot --nginx -d example.com -d www.example.com

# Or get a certificate only, manage nginx config yourself
sudo certbot certonly --standalone -d example.com -d www.example.com
```

Certbot auto-renews certificates via a systemd timer or cron job. Verify renewal works with:

```bash
sudo certbot renew --dry-run
```

The cert path in the generated config — `/etc/letsencrypt/live/example.com/` — is a symlink Certbot maintains. After renewal, Certbot updates the symlink; nginx reads the new cert on the next reload. No manual cert rotation needed.

If you're using the "get certificate only" approach (not `--nginx`), use the generated SSL block exactly as output — the `ssl_certificate`, `ssl_certificate_key`, `ssl_protocols`, and `ssl_ciphers` lines are all you need for a modern, secure TLS setup.

## A Pi Cluster Reverse Proxy Example

My Pi cluster runs nginx on the primary node (`pi5-1`) as the cluster edge. Three services — a Node.js API, a Grafana instance, and a static frontend — each get their own server block:

```nginx
# Static Astro frontend
server {
    listen 443 ssl;
    server_name cluster.internal;
    ssl_certificate /etc/letsencrypt/live/cluster.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cluster.internal/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /var/www/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
}

# Node.js API (port 4000, WebSocket enabled)
server {
    listen 443 ssl;
    server_name api.cluster.internal;
    ssl_certificate /etc/letsencrypt/live/cluster.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cluster.internal/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}

# Grafana (port 3000)
server {
    listen 443 ssl;
    server_name grafana.cluster.internal;
    ssl_certificate /etc/letsencrypt/live/cluster.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cluster.internal/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

All three share the same wildcard cert. Each service is one reverse proxy block. The frontend uses a SPA `try_files` fallback. The API has WebSocket enabled and a longer read timeout for streaming responses.

## Security Hardening Beyond the Basics

The generated config covers the fundamentals. For production hardening, add these directives to your `server {}` block:

**Hide nginx version:**
```nginx
server_tokens off;
```
The default nginx error pages and `Server` header expose the version number. Turn it off so attackers can't target known vulnerabilities by version.

**Security headers:**
```nginx
add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
add_header Referrer-Policy strict-origin-when-cross-origin;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
```
These prevent clickjacking, MIME-type sniffing, and unnecessary browser permission grants.

**HSTS (HTTPS-only enforcement):**
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```
Tells browsers to always use HTTPS for this domain for 1 year. Add this only after verifying your SSL setup is stable — it's difficult to undo.

**Rate limiting:**
```nginx
# In http {} block (nginx.conf):
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;

# In location {} block:
limit_req zone=api burst=10 nodelay;
```
Limits each IP to 30 requests/minute, with a burst allowance of 10. Effective against brute-force and scraping.

**Block access to sensitive paths:**
```nginx
location ~ /\.(git|env|htaccess) {
    deny all;
    return 404;
}
```
Prevents accidental exposure of `.git`, `.env`, or `.htaccess` files if they end up in your web root.

## Limitations

- **`upstream {}` blocks** — the tool generates inline `proxy_pass` to a single backend. Load balancing across multiple upstreams requires an `upstream {}` block in `http {}` context — write that manually.
- **`location` priority and regex** — the generated config uses a single `location /` block. Complex routing (multiple locations with regex, priority ordering) needs manual editing.
- **HTTP/2** — add `http2` to the `listen` directive (`listen 443 ssl http2`) for HTTP/2 support. Not included by default since it requires careful buffer tuning.
- **Certbot auto-configuration** — when using `certbot --nginx`, Certbot modifies your config in place. The generated output is a starting point; Certbot may add or modify lines during certificate issuance.
- **`nginx.conf` global settings** — the generator produces `server {}` blocks only. Global settings (worker_processes, error_log, gzip at http level, buffer sizes) go in `/etc/nginx/nginx.conf` and aren't generated here.
