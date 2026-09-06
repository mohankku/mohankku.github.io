---
layout: post
title: "Local-First AI Chat on a Static Site: Browser-Direct Ollama, Tool Loops, and a Loopback Search Proxy"
author: Mohan Kumar
tags: [agents, local-ai, ollama, tool-calling, privacy, jekyll]
---

A chat page on a static GitHub Pages site that talks to a local Ollama model sounds contradictory: there is no server to hold API keys, run tool loops, or keep secrets. I built exactly that for this site's [/chat](/chat) page, and the constraints shaped every decision. Here is what worked, what bit, and the architecture that fell out.

## The core trick: the browser calls Ollama directly

Ollama listens on `127.0.0.1:11434`, so a page can `POST /api/chat` straight from JavaScript — streaming NDJSON tokens included. No backend, nothing leaves the machine. The catch is CORS: Ollama's default origin allowlist covers `localhost` (any port, so local Jekyll preview works with zero config) but rejects `https://mohankku.github.io`. The fix is one environment variable plus a restart:

```
launchctl setenv OLLAMA_ORIGINS "https://mohankku.github.io"
brew services restart ollama
```

For persistence across reboots, the variable belongs in the `EnvironmentVariables` dict of the Homebrew LaunchAgent plist instead of `launchctl setenv`. Since Ollama only binds loopback, allowing the origin is safe: only browsers on that laptop can reach it, and anyone else opening the page just gets "Unreachable" — their browser tries *their own* localhost.

## Not all local models tool-call equally

I gave the model a `web_search` tool for live prices and products. Devstral 24B emits native `tool_calls` with IDs; Qwen2.5-coder 14B instead emitted the call as JSON *inside the message text*. The page handles both: native calls first, then a best-effort parse of `{"name": "web_search", ...}` from content. The loop is standard — decision call (`stream: false`), execute searches, feed back `role: "tool"` messages, up to 3 rounds, then a final streamed answer with tools detached. If your small model "ignores" tools, check whether it is actually calling them in prose before blaming the harness.

## The key problem, and the loopback proxy

A search API key cannot live in a public static site — every visitor downloads the JS. Browser `localStorage` works per-browser but means re-entering keys and trusting every tab. So the key moved into a ~200-line stdlib-only Python proxy on the laptop:

- Binds `127.0.0.1` only — off the LAN and internet entirely.
- Origin allowlist (deployed site + local previews); everything else gets 403, verified with hostile-origin probes.
- 30-searches/minute rate limit so a rogue tab cannot burn the monthly quota.
- The Tavily key sits in a mode-600 file the proxy reads; clients never see it.
- `Access-Control-Allow-Private-Network: true` on preflights, which Chrome requires for public-pages-to-loopback calls.

The proxy also runs scheduled price watches (re-check every 6 hours, min-price extraction from snippets, drop/target-hit badges in the page). Snippet-derived prices are approximate — a stray "$18 accessory" once won "lowest price" — so the UI says so honestly.

## Debugging notes

- Ollama once wedged itself: models loaded, every request returned `{"done": false}` empties. A service restart fixed it; treat empty `done: false` finals as "restart the server."
- Devstral is text-only (400 on `images`), so photo questions route to a small companion vision model (gemma3:4b) for that turn only.
- Test the markdown renderer in isolation: extracting the pure functions and running assertions in JavaScriptCore caught a real bug (text after a closing code fence was silently dropped) before any browser was involved.

Total new infrastructure: one LaunchAgent, one 600-permission config file, zero cloud dependencies. The page degrades gracefully at every step — no Ollama, no proxy, no key — with errors that say exactly which piece to start.
