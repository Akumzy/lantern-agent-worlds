# Lantern Arcade — WebMCP Challenge Submission

- **Live app:** [lantern-agent-worlds.akumanewton.chatgpt.site](https://lantern-agent-worlds.akumanewton.chatgpt.site/)
- **Source:** [github.com/Akumzy/lantern-agent-worlds](https://github.com/Akumzy/lantern-agent-worlds)
- **License:** [MIT](./LICENSE)

## Project description

Lantern Arcade turns one learning goal into a complete playable browser game. A parent, teacher, or training lead describes the learner, the skill, and a world that would motivate them. A browser agent then uses Lantern’s WebMCP tools to create a versioned draft, program the game, validate its source, open a live playtest, inspect learning evidence, and request human review.

This is a better human-agent experience than asking an agent for lesson text or placing a chatbot beside a fixed course. The human supplies intent and judgment. The agent supplies rapid game design and implementation. The learner supplies actions. Lantern joins those actions to readable evidence of attempts, corrections, and mastery.

Lantern exposes eight WebMCP tools covering capability discovery, local draft continuity, idempotent creation, optimistic source updates, visible previews, per-game diagnostics, and review handoff. Agent-created games can use HTML/CSS/JavaScript, Canvas 2D, raw WebGL, GLSL shaders, render loops, physics, audio, and keyboard or touch controls. They run inside a no-same-origin, no-network sandbox and persist only in the user’s browser. A game reports learning through `lantern.evidence()` and mastery through `lantern.complete()`; the trusted host records the result and controls the celebration.

The result is a game canvas rather than a course template: the same system can create an equivalent-fractions bridge adventure for a child, a safety simulation for a warehouse team, or a customer-support role-playing game for company training.

## Suggested demo video (2:35)

### 0:00–0:20 — Problem and promise

Show the landing page and say: “Most AI learning products generate text. Lantern lets a browser agent program the game itself. You describe what someone should learn; the agent builds a world they can play.”

### 0:20–0:45 — Human handoff

Enter a concrete brief: “A harbour adventure for a 6-year-old learning addition within 20.” Copy the agent handoff. Point out that it includes the live URL, tool sequence, canvas limits, and learning-evidence contract.

### 0:45–1:35 — WebMCP creation loop

Show the browser agent calling capabilities, checking saved drafts, creating the draft, setting source, and opening the preview. Keep Lantern visible so the build thread, revision, connection status, and local save state update as the agent works.

### 1:35–2:05 — Play and evidence

Play one challenge. Show immediate game feedback, keyboard/touch support, fullscreen, and the evidence panel updating. Complete the mastery challenge and show host-controlled confetti.

### 2:05–2:25 — Continuity and safety

Refresh the page, resume the saved game, and open its dedicated URL. Briefly show diagnostics and explain the isolated, offline game frame and human review boundary.

### 2:25–2:35 — Close

Say: “Lantern combines human intent, agent creativity, and learner behavior. Code becomes play; play becomes evidence.”

## Final submission checklist

- [x] Publish the current validated build to the public Sites URL.
- [x] Create the public GitHub repository.
- [x] Confirm README, MIT license, source, assets, and setup instructions are present locally.
- [x] Push the validated source to GitHub and confirm GitHub detects the MIT license.
- [x] Smoke-test the public URL in a WebMCP-enabled browser with no console errors.
- [ ] Repeat the public test in a fresh browser profile before recording.
- [ ] Record the demo above with audible narration and publish it unlisted or public on YouTube.
- [ ] Add the live URL, repository URL, video URL, and project description to Devpost.
