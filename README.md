# Lantern Arcade

Lantern turns a learning goal into a playable browser game. A browser agent uses WebMCP tools exposed by the page to plan a game, write its complete HTML/CSS/JavaScript source, validate it, open a live playtest, inspect learning evidence, and request human review.

**Live app:** [lantern-agent-worlds.akumanewton.chatgpt.site](https://lantern-agent-worlds.akumanewton.chatgpt.site/)  
**License:** [MIT](./LICENSE)

## Why Lantern fits the WebMCP Challenge

Most learning software gives an agent a chat box beside fixed content. Lantern gives the agent a safe creative surface. The human supplies the learner, skill, and desired world; the agent programs the experience; the learner plays it; and Lantern turns meaningful actions into evidence a parent or teacher can review.

The browser page exposes eight WebMCP tools:

1. `get_game_canvas_capabilities`
2. `list_saved_game_drafts`
3. `resume_game_draft`
4. `create_game_draft`
5. `set_game_source`
6. `preview_game`
7. `get_game_runtime_diagnostics`
8. `request_game_review`

Agent-authored games can use DOM, Canvas 2D, raw WebGL, render loops, physics, audio, keyboard/touch input, and GLSL shaders. They report progress with `lantern.evidence()` and mastery with `lantern.complete()`. Mastery triggers host-controlled confetti.

## Safety and persistence

- Games run in an isolated iframe without same-origin access.
- A strict content security policy blocks network connections, external scripts, storage APIs, nested frames, and hidden navigation.
- Source validation rejects unsafe APIs, oversized payloads, dynamic evaluation, and obvious unbounded loops.
- Drafts, evidence, revisions, and per-game diagnostics remain in browser storage.
- Agents can request review but cannot publish autonomously.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server in a browser with WebMCP support.

## Verify

```bash
npm run check
```

This runs linting, regression tests, and the production build.

## Agent build sequence

Open Lantern and describe a learning game. Copy the handoff into a browser agent with WebMCP access. The intended tool sequence is capabilities → saved drafts → create/resume → set source → preview → diagnostics → review.

The four included games demonstrate different learning loops. Agent-created games receive dedicated `/games/local/:gameId` pages and remain available after refresh on the same device.

## Technology

Vinext, React, TypeScript, WebMCP, sandboxed `srcDoc` iframes, Canvas 2D/WebGL, and browser local storage.
