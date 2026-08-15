# Project brief: real-life social deduction game app

This is context, not a rulebook. Understand the goal and the decisions already made, then use your own engineering judgment on how to build it. Where something isn't specified, make a reasonable call and explain your reasoning — don't stop and ask for every small detail, and don't force a rigid structure onto problems that need flexibility.

## Concept

A room-based multiplayer game inspired by Among Us, played in real life:

- Players physically complete real-world tasks (not in-app tasks) and prove it with a photo.
- One or more players are secretly the "imposter." They eliminate other players by self-reporting a kill.
- Discussion and voting happen inside the app.
- Deliberately no GPS, location tracking, or proximity detection. This keeps the app buildable by one person and avoids problems (indoor GPS accuracy, battery drain, privacy) that aren't worth solving for this game.

## Platforms and build order

1. Web app first — this is the full product. Get it working end to end before starting on mobile.
2. Android app after the web app works. Native, in Kotlin.
3. No iOS in this phase.

## Tech stack and why

- **Frontend + backend: Next.js**, used full-stack (pages, API routes, and a custom server for real-time features, all in one codebase).
- **Database: PostgreSQL.**
- **Real-time: WebSockets**, attached to a custom Next.js server (not the default serverless API routes).
- **Important deployment constraint:** this only works correctly if deployed as a persistent Node process — for example on an EC2 instance with Nginx, or Render/Railway. Do not deploy to Vercel's default serverless setup; WebSocket connections won't stay open there. Use your judgment on hosting specifics, but keep this constraint in mind.
- **Photo storage: S3** (or equivalent object storage).
- **Android app: Kotlin**, native, built after the web version is stable. Talks to the same backend.
- No user accounts or login system needed for the MVP — a nickname plus a room code is enough, similar to Kahoot or Jackbox. Build real auth later only if the product actually needs it.

## Core game loop

1. **Lobby** — host creates a room, gets a room code, shares it. Others join with a nickname. Host picks a task pack and starts the game. The server randomly assigns imposter role(s) and gives each player a random subset of tasks from the chosen pack.
2. **Task phase** — players see their task list. Completing a task means uploading a photo; it's marked done immediately.
3. **Kill or report** — the imposter picks a target and taps "kill." This is self-reported, not verified by the system — the same honor-system logic as physical party games like Mafia or Werewolf.
4. **Meeting and vote** — a kill report or a timer triggers a meeting. Active players join a shared discussion/vote screen in real time. Players can also flag a specific task photo as suspicious here. Voting ejects the most-voted player.
5. **Win check** — after each vote and kill: if the crew has completed all tasks, crew wins. If imposters equal or outnumber remaining crew, imposters win. Otherwise, loop back to the task phase.

## Decisions already made — build on these, don't relitigate them

- **No dedicated moderator role.** Task photos are auto-approved on upload. Instead of a review queue, any player can flag a photo as suspicious, and flagged photos get resolved during the next meeting/vote — reusing the same social mechanic the game already has. This was a deliberate choice: a full-time reviewer takes that person out of gameplay, which doesn't work for a small-group party game.
- **"Task packs," not maps.** A pack is a named, themed list of 10–15 tasks (e.g. "Office pack," "Hostel pack"). The platform owner creates and edits these through a simple admin form on the website: pack name plus a list of task descriptions. No spatial layout, no floor plans, no coordinates.

## Where you have real freedom

Everything not pinned down above is yours to design well — room/session data model, how reconnects and disconnects are handled, UI/UX for the task and meeting screens, error handling, exact API shape, component structure, how the admin panel is built, and how much of the Kotlin app reuses backend contracts versus needing its own logic. Use good judgment, follow solid engineering practice, and flag anything where you see a real tradeoff worth discussing — but don't wait for permission on implementation details that are clearly your call.
