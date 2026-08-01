---
title: "WebSocket / SSE Live Tester"
category: "dev"
job: "Connect to any WebSocket or Server-Sent Events endpoint from your browser, see frames stream live, measure latency, send messages, validate JSON inline."
description: "Free browser-based tester for WebSocket (ws:// / wss://) and Server-Sent Events (http:// / https://) endpoints. Connect, watch frames live with timestamps and byte counts, JSON pretty-print with token colors, send text / JSON / binary (hex) messages on WebSocket connections, measure first-frame latency, median frame gap, and max stall. Export the full session log as JSON. Auto-reconnect on close with optional 5-second delay. WebSocket subprotocols supported. No accounts, no proxy - the browser connects directly to your endpoint."
aiSummary: "Client-side WebSocket / SSE inspector. Detects scheme (ws/wss → WebSocket, http/https → EventSource) and connects directly from the browser. Renders a frame log with timestamps, direction (sent / received / meta / error), byte counts, and JSON pretty-printing with token colors. Stats panel tracks frames, bytes, first-frame latency, median frame gap, max gap. WebSocket-only send panel supports text, JSON (validated), and binary (hex-encoded). Honest about browser constraints: cannot set Authorization headers on WebSocket / SSE handshakes (auth via URL params, cookies, or Sec-WebSocket-Protocol subprotocol only); CORS rejections are server-side policy not bugs; WebSocket ping/pong frames are managed by the browser and not exposed to JS so latency is measured handshake → onopen and onmessage → onmessage instead. Preset endpoints: Postman echo, echo.websocket.events, Wikimedia recent-changes SSE stream. Frame log capped at 1000 entries to avoid memory issues on chatty streams. Export full session as JSON. No persistent state - reload disconnects."
personalUse: "I needed to test an MCP-over-SSE server during dev and every WebSocket tool I found was either a Chrome extension I didn't want to install, a paid SaaS, or a CLI tool that didn't give me a visual frame log. Built one that respects both."
status: "active"
publishedAt: "2026-05-23"
icon: "📡"
license: "MIT"
---

## What It Does

Paste a `ws://`, `wss://`, `http://`, or `https://` URL. Hit Connect. Watch frames stream live in the log on the left, with stats on the right.

- **WebSocket** (`ws://` or `wss://`) - bidirectional. Send text, JSON, or binary; receive in real time
- **Server-Sent Events** (`http://` or `https://`) - one-way stream from server to browser. Receive only
- **Live frame log** - timestamps to the millisecond, direction badges (SENT / RECV / META / ERR), byte counts
- **JSON auto-pretty-print** - any received payload that parses as JSON gets indented and token-colored automatically
- **Stats panel** - frames in/out, bytes in/out, first-frame latency, median frame gap, max stall
- **Send messages** (WebSocket only) - As text / As JSON (validates before sending) / As bytes (paste hex like `DE AD BE EF`)
- **WebSocket subprotocols** - comma-separated, e.g. `graphql-transport-ws, mqtt, ocpp1.6`
- **Auth-via-URL helper** - quick way to append a token query param without editing the URL manually
- **Auto-reconnect** - optional, 5-second delay
- **Filter the log** - show / hide sent, received, meta separately
- **Export** - download the full session as JSON

## When To Use It

- Verifying an MCP server's SSE transport handshake
- Debugging a GraphQL subscription (`graphql-transport-ws`)
- Testing an internal real-time API before wiring up a client
- Watching a public event stream live (Wikimedia recent changes is a good demo)
- Reproducing a "sometimes the connection drops" bug with first-frame and max-gap stats
- Proving to your backend team that yes, the server is closing the socket with code 1006

## Browser security model - what you should know

WebSocket and EventSource in browsers are deliberately less flexible than `curl` or a Node client:

**You cannot set Authorization headers on the handshake.** `new WebSocket(url, protocols)` and `new EventSource(url, { withCredentials })` don't accept a headers option. The browser controls the handshake. Workarounds: pass auth as a URL query param, send a cookie (same-origin only), or use the `Sec-WebSocket-Protocol` subprotocol for tokens. The Advanced panel surfaces the URL-param helper.

**CORS is the server's call.** If the target server doesn't accept connections from `gekro.com`, that's correct security on the server's part. The error appears in the log with context. To test those endpoints you need a tool that bypasses browser CORS (Node, curl, a desktop client).

**WebSocket errors are intentionally vague.** When `ws.onerror` fires the browser deliberately tells you nothing beyond "error" to prevent cross-origin information leaks. Check DevTools Network tab for the actual HTTP-level handshake response.

**WebSocket ping/pong frames are not exposed to JS.** The browser handles them internally to keep the connection alive. We measure latency as connect-to-open and frame-to-frame gaps instead.

**Mixed-content blocks.** A page served over `https://` cannot open a `ws://` connection. Use `wss://`.

## What's NOT Included

- **Bypassing CORS** - that would defeat the security model. Use a desktop tool if you need to hit a server that won't accept your origin
- **Custom request headers** - browser security, see above
- **HTTP/2 push or QUIC streaming** - not exposed to JS; SSE and WebSocket are the available APIs
- **Persistent state** - reload disconnects and clears the log, intentional
- **Auto-discovery / endpoint scanning** - this is a tester, not a scanner

## Related Tools

- [Streaming Response Player](/apps/streaming-response-player/) - replay a saved SSE log instead of connecting live
- [MCP Server Tester](/apps/mcp-server-tester/) - validate MCP tool schemas
- [JSON Formatter](/apps/json-formatter/) - clean up payload bodies you copied out of the frame log
