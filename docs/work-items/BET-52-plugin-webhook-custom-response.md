---
issue: BET-52
source_type: feature
components: [plugin-sdk, server]
tags: [plugins, webhooks, discord]
files_changed:
  - packages/plugins/sdk/src/define-plugin.ts
  - packages/plugins/sdk/src/protocol.ts
  - packages/plugins/sdk/src/worker-rpc-host.ts
  - packages/plugins/sdk/src/index.ts
  - server/src/routes/plugins.ts
date_completed: 2026-04-11
---

## Problem

The plugin webhook system (`onWebhook`) returned `void` — the host always responded
with `{ deliveryId, status: "success" }`. This prevented plugins from returning custom
HTTP responses, which is required for Discord interaction callbacks (buttons, slash
commands) that need specific JSON response bodies (PONG, UPDATE_MESSAGE, etc.).

## Solution

Added a `PluginWebhookResponse` type that plugins can optionally return from
`onWebhook`. When a response object is returned, the host uses its status/headers/body
for the HTTP response instead of the default. Fully backward compatible — existing
plugins that return void get unchanged behavior.

## Changes Made

1. **`define-plugin.ts`** — Added `PluginWebhookResponse` interface and changed
   `onWebhook` return type to `Promise<void | PluginWebhookResponse>`
2. **`protocol.ts`** — Updated `HostToWorkerMethods.handleWebhook` result type to
   `void | PluginWebhookResponse`
3. **`worker-rpc-host.ts`** — Updated `handleWebhook` to return the result from
   `onWebhook` instead of discarding it
4. **`index.ts`** — Exported `PluginWebhookResponse` type
5. **`plugins.ts`** (server route) — After `workerManager.call("handleWebhook")`,
   checks if a response object was returned and uses its status/headers/body for the
   HTTP response

## Verification

- Existing plugins returning void continue to get `{ deliveryId, status: "success" }`
- Plugins returning `{ status: 200, body: { type: 1 } }` get that as the HTTP response
- Custom headers from the response are set on the HTTP response
