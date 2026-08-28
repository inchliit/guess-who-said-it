---
artifact_contract: "ce-handoff/v1"
created_at: "2026-08-28T14:33:32Z"
title: "CDL Ice Breakers Project Handoff"
summary: "Continuation handoff for the CDL Ice Breakers React, Express, and Socket.IO mini-game app deployed on Render."
keywords: ["cdl-ice-breakers", "icebreaker-game", "react", "vite", "express", "socket-io", "render", "github", "4-pics-1-word", "logo-quiz", "guess-who-said-it"]
cwd: "D:/Users/JOW/Documents/New project/guess-who-said-it"
resume_focus: "Continue development, redeploy, or replicate CDL Ice Breakers from the GitHub repository with the latest 4 Pics word-pool cleanup."
repository: "inchliit/guess-who-said-it"
repo_root_sha: "ffff0e82dbbe4e525b5bc06019e949eb922d33ea"
branch: "main"
head: "90a664cca91794da7865be16197557fd65981135"
worktree_path: "D:/Users/JOW/Documents/New project/guess-who-said-it"
---

# CDL Ice Breakers Handoff

This document is the detailed export for continuing the CDL Ice Breakers project from another Codex account, another GitHub account, or a fresh machine.

Intended repository location:

```text
CDL_ICE_BREAKERS_HANDOFF.md
```

The app is a live multiplayer icebreaker game. A host creates a room, members join with a room code or invite link, and everyone plays one of three game modes:

- **4 Pics 1 Word**: 10 timed image puzzles, 45 seconds per question, typed answer, +1 point for each correct player.
- **Which Logo Is Correct**: 10 logo recognition questions, 3 choices per question, +1 point for each correct player.
- **Guess Who Said It**: anonymous free-response answers, group guesses who wrote each answer, points for correct guesses and for fooling the room.

The most recent user request before this export was:

- Remove `active`, `catch`, and `task` from the 4 Pics 1 Word game.
- Replace them with other entries.
- Export everything into a detailed Markdown file so another account can continue and replicate the project.

If this file exists in the GitHub repository, treat the repository's current `main` branch as the authoritative state.

## Current Project Locations

Repository:

```text
https://github.com/inchliit/guess-who-said-it
```

Live Render app:

```text
https://guess-who-said-it.onrender.com
```

Original Render dashboard page:

```text
https://dashboard.render.com/web/srv-d93p3s4vikkc73apdfqg
```

The Render dashboard link requires access to the original logged-in Render account. A different account can still redeploy the app by importing the GitHub repository or pushing the code to a new repository.

Original local working copy on the capture machine:

```text
D:/Users/JOW/Documents/New project/guess-who-said-it
```

Original user-provided 4 Pics source folder observed on the capture machine:

```text
D:/Users/JOW/Downloads/ICE BREAKER_4PICS1WORD
```

The user initially referenced `D:/Users/JOW/Downloads/ICE BREAKER/_4PICS1WORD`, but the available extracted folder was `D:/Users/JOW/Downloads/ICE BREAKER_4PICS1WORD`, with a matching zip at `D:/Users/JOW/Downloads/ICE BREAKER_4PICS1WORD.zip`.

## Tech Stack

- React 18
- TypeScript
- Vite 7
- Express 4
- Socket.IO 4
- Node.js 22 on Render
- In-memory game rooms on the Node server

There is no database, no authentication provider, and no `.env` requirement for the current version.

## Important Repository Files

```text
package.json                 npm scripts and dependencies
package-lock.json            locked dependency graph
render.yaml                  Render web service blueprint
vite.config.ts               Vite dev server and Socket.IO proxy
tsconfig.json                TypeScript settings
index.html                   Vite HTML entry
src/main.tsx                 React root
src/App.tsx                  Full client UI and Socket.IO client flow
src/styles.css               App styling
server/index.js              Express server, Socket.IO server, room state, game logic, question pools
public/4pics1word/*.jpg      4 Pics 1 Word question and reveal images
README.md                    Short setup and deployment notes
CDL_ICE_BREAKERS_HANDOFF.md  This detailed continuation export
```

## NPM Scripts

From `package.json`:

```json
{
  "dev": "concurrently -n CLIENT,SERVER -c cyan,magenta \"vite --host 0.0.0.0\" \"node --watch server/index.js\"",
  "build": "vite build",
  "start": "node server/index.js",
  "check": "tsc --noEmit"
}
```

Use these commands:

```bash
npm install
npm run dev
```

Open the local dev app at:

```text
http://localhost:5173
```

For a production-style local run:

```bash
npm run build
npm start
```

Open:

```text
http://localhost:3000
```

The production server serves the built React app from `dist` and the Socket.IO backend from the same Node process.

## Replicate From Another GitHub Account

There are three workable paths.

### Option A: Fork

Use this when the other account should keep a visible relationship to the original repo.

1. Open `https://github.com/inchliit/guess-who-said-it`.
2. Fork it into the new GitHub account.
3. In Render, create a new Web Service from the fork.
4. Use the Render settings in the Render section below.

### Option B: Transfer Ownership

Use this when the project should move permanently to the other GitHub account or organization.

1. In GitHub, open the repository settings for `inchliit/guess-who-said-it`.
2. Use GitHub's repository transfer flow.
3. After transfer, reconnect Render to the new repository owner if Render loses repository access.
4. Trigger a manual deploy.

### Option C: Clone And Push To A New Repository

Use this when the other account should have a separate copy with no fork relationship.

```bash
git clone https://github.com/inchliit/guess-who-said-it.git
cd guess-who-said-it
git remote set-url origin https://github.com/NEW_ACCOUNT/NEW_REPO.git
git push -u origin main
```

Then create a new Render Web Service from `NEW_ACCOUNT/NEW_REPO`.

## Render Deployment Settings

The repo contains `render.yaml`:

```yaml
services:
  - type: web
    name: guess-who-said-it
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /healthz
    envVars:
      - key: NODE_VERSION
        value: 22
```

Manual Render setup should match:

```text
Service type: Web Service
Runtime: Node
Plan: Free is enough for testing
Build command: npm install && npm run build
Start command: npm start
Health check path: /healthz
Environment variable: NODE_VERSION=22
Branch: main
Root directory: leave blank if deploying the repository root
Auto deploy: enabled, unless the owner wants manual deploys only
```

The current live app is:

```text
https://guess-who-said-it.onrender.com
```

Render free services can sleep after inactivity. The first page load after sleep may take longer than later page loads.

## Runtime Behavior

The server keeps all rooms in memory:

- Rooms are stored in `rooms`, a `Map` in `server/index.js`.
- Socket-to-room identity is stored in `socketIndex`, another `Map`.
- Rooms expire after `ROOM_TTL_MS`, currently 2 hours.
- If Render restarts or redeploys, active rooms disappear because there is no database.
- This is acceptable for short icebreaker sessions.

Current constants in `server/index.js`:

```js
const MAX_PLAYERS = 24;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const FOUR_PICS_ROUND_COUNT = 10;
const WORD_QUESTION_DURATION_MS = 45 * 1000;
```

Player limit:

```text
24 players per room maximum
```

Minimum players before start:

```text
Guess Who Said It: 2 connected players
Which Logo Is Correct: 1 connected player
4 Pics 1 Word: 1 connected player
```

## User Flow

### Host Flow

1. Host opens the app.
2. Host chooses a game mode.
3. Host clicks create room.
4. Server returns a room code and a host token.
5. Client stores the host token in `sessionStorage` with key pattern `gwsi:host-token:ROOMCODE`.
6. Host shares the room code or invite link.
7. Host starts the game once enough players have joined.
8. Host can reveal or go to the next question depending on the phase.
9. Host can reset the room back to lobby.

### Member Flow

1. Member opens the app.
2. Member enters name and room code, or opens an invite URL with `?room=CODE`.
3. Client stores the player name locally and reuses a stored player id for reconnects.
4. Member answers based on the game mode.
5. Scores update live for everyone through Socket.IO room state broadcasts.

## Socket.IO Event Contract

Server file:

```text
server/index.js
```

Client file:

```text
src/App.tsx
```

The server emits:

```text
room:state
```

The client calls these events:

| Event | Sender | Purpose |
| --- | --- | --- |
| `host:create` | Host | Create a room with `gameType` and `roundCount`. Returns `roomCode` and `hostToken`. |
| `host:resume` | Host | Reconnect as host using `roomCode` and `hostToken`. |
| `player:join` | Player | Join lobby with `roomCode`, `name`, and optional saved `playerId`. |
| `host:start` | Host | Start the selected game mode. Resets scores and chooses questions/prompts. |
| `host:reveal` | Host | Reveal current Guess Who answer, logo answer, or word answer. |
| `host:next` | Host | Advance through reveal states and rounds. |
| `host:reset` | Host | Return room to lobby and clear active game state. |
| `player:word-answer` | Player | Submit a typed 4 Pics 1 Word answer. |
| `player:quiz-answer` | Player | Submit a Which Logo Is Correct option id. |
| `player:submit` | Player | Submit an anonymous Guess Who answer. |
| `player:vote` | Player | Vote who wrote the current Guess Who answer. |

The public `room:state` includes:

```text
roomCode
gameType
phase
roundIndex
roundCount
prompt
players
meId
isHost
activePlayerIds
submissionProgress
voteProgress
quizProgress
wordProgress
logoQuestion
wordQuestion
currentAnswer
reveal
quizReveal
wordReveal
mySubmitted
myVote
myQuizAnswer
myWordAnswer
eligibleToVote
eligibleToAnswer
eligibleToWordAnswer
questionEndsAt
questionDurationMs
serverTime
```

## Game Modes

### 4 Pics 1 Word

This is the default first game option in the UI.

Server behavior:

- `host:create` sets `roundCount` to `Math.min(10, fourPicsQuestions.length)`.
- `host:start` shuffles the question pool and picks 10 questions.
- Each round starts in phase `word`.
- Server sets `questionEndsAt = Date.now() + questionDurationMs`.
- A timer calls `revealWordQuestion(room)` after 45 seconds.
- If all active players answer early, the server reveals immediately.
- Answers are normalized with uppercase and non-alphanumeric characters removed before comparison.
- Correct answer gives +1 point.
- Incorrect answer gives 0 points.
- Missing answer is shown as `No answer` in the reveal.

Current timer:

```text
45 seconds per question
```

Current scoring:

```text
+1 for correct typed answer
0 for incorrect or missing answer
```

Current 4 Pics question pool:

| Order In Source | ID | Answer | Question Image | Reveal Image |
| ---: | --- | --- | --- | --- |
| 1 | `gift` | `GIFT` | `public/4pics1word/5.jpg` | `public/4pics1word/6.jpg` |
| 2 | `think` | `THINK` | `public/4pics1word/7.jpg` | `public/4pics1word/8.jpg` |
| 3 | `event` | `EVENT` | `public/4pics1word/9.jpg` | `public/4pics1word/10.jpg` |
| 4 | `rich` | `RICH` | `public/4pics1word/11.jpg` | `public/4pics1word/12.jpg` |
| 5 | `light` | `LIGHT` | `public/4pics1word/16.jpg` | `public/4pics1word/17.jpg` |
| 6 | `crime` | `CRIME` | `public/4pics1word/20.jpg` | `public/4pics1word/21.jpg` |
| 7 | `summer` | `SUMMER` | `public/4pics1word/23.jpg` | `public/4pics1word/24.jpg` |
| 8 | `launch` | `LAUNCH` | `public/4pics1word/27.jpg` | `public/4pics1word/28.jpg` |
| 9 | `expand` | `EXPAND` | `public/4pics1word/29.jpg` | `public/4pics1word/30.jpg` |
| 10 | `focus` | `FOCUS` | `public/4pics1word/32.jpg` | `public/4pics1word/33.jpg` |
| 11 | `share` | `SHARE` | `public/4pics1word/34.jpg` | `public/4pics1word/35.jpg` |
| 12 | `build` | `BUILD` | `public/4pics1word/36.jpg` | `public/4pics1word/37.jpg` |

Removed from the 4 Pics pool:

| Removed ID | Removed Answer | Removed Question Image | Removed Reveal Image |
| --- | --- | --- | --- |
| `task` | `TASK` | `public/4pics1word/14.jpg` | `public/4pics1word/15.jpg` |
| `catch` | `CATCH` | `public/4pics1word/18.jpg` | `public/4pics1word/19.jpg` |
| `active` | `ACTIVE` | `public/4pics1word/25.jpg` | `public/4pics1word/26.jpg` |

Replacement images `32.jpg` through `37.jpg` were generated locally as project-owned replacement composites. The original user-provided zip had extra screen images such as intro, mechanics, level, winner, and thank-you graphics, but not enough additional playable question/reveal pairs to replace all three removed entries directly.

### Which Logo Is Correct

Server behavior:

- Uses `logoQuestions` in `server/index.js`.
- There are 10 questions.
- `host:create` sets `roundCount` to the number of logo questions.
- `host:start` shuffles all logo questions.
- Each question has 3 options.
- Correct option gives +1 point.
- No timer is currently used for this mode.
- If all active players answer, the server reveals immediately.

Current logo brands:

```text
Google
YouTube
Spotify
Target
McDonald's
Microsoft
Instagram
Amazon
Apple
Nike
```

The logo quiz visuals are rendered by the React app rather than stored as image files.

### Guess Who Said It

Server behavior:

- Uses `prompts` in `server/index.js`.
- Host can choose 3, 5, or 7 rounds in the UI.
- Minimum 2 connected players.
- Active connected players answer the prompt anonymously.
- The server shuffles answer order.
- Everyone except the answer author votes who said it.
- Correct voters receive +1 point.
- The author receives a bonus when nobody guesses correctly.

Current prompt pool:

```text
A tiny thing that always makes my day better
A useless skill I might secretly be proud of
My oddly specific comfort food
The weirdest thing in my desk or bag
A harmless hill I will defend
Something I believed as a kid
My personal theme song today would be
A small win I had recently
My most chaotic travel habit
A fictional place I would visit
A surprisingly strong opinion I have
The app I open when I need a break
```

## How To Edit The 4 Pics Question Pool

Edit:

```text
server/index.js
```

Find:

```js
const fourPicsQuestions = [
  // entries here
];
```

Each entry must look like:

```js
{
  id: "unique-lowercase-id",
  prompt: "What word connects these four pictures?",
  answer: "ANSWER",
  image: "/4pics1word/question-image.jpg",
  revealImage: "/4pics1word/reveal-image.jpg"
}
```

Add image files under:

```text
public/4pics1word
```

Rules:

- `image` is what players see while guessing. It should not reveal the answer text.
- `revealImage` is what players see after reveal. It can contain the answer text.
- Keep answers uppercase in `server/index.js`.
- Keep `id` values unique.
- Keep at least 10 entries if the game should always have 10 questions.
- If there are more than 10 entries, each room gets a shuffled sample of 10.
- If there are fewer than 10 entries, the game uses however many exist because of `Math.min(10, fourPicsQuestions.length)`.

After editing images or question entries, run:

```bash
node --check server/index.js
npm run check
npm run build
```

## How To Change The 4 Pics Timer

Edit:

```text
server/index.js
```

Find:

```js
const WORD_QUESTION_DURATION_MS = 45 * 1000;
```

Examples:

```js
const WORD_QUESTION_DURATION_MS = 20 * 1000;
const WORD_QUESTION_DURATION_MS = 60 * 1000;
```

The client receives the timer through `questionEndsAt`, `questionDurationMs`, and `serverTime` in `room:state`.

## How To Change Player Capacity

Edit:

```text
server/index.js
```

Find:

```js
const MAX_PLAYERS = 24;
```

The room join logic checks this only for new players. Existing players can reconnect using their saved player id.

## Local Verification Checklist

Run from the repo root:

```bash
node --check server/index.js
npm run check
npm run build
npm audit --audit-level=moderate
```

Known recent validation from the capture session:

```text
node --check server/index.js: passed
npm run check: passed
npm run build: passed
npm audit --audit-level=moderate: passed, 0 vulnerabilities
```

The 45-second timer had already been validated locally and on Render before this handoff. The word-pool cleanup was smoke-tested locally by creating a 4 Pics room through Socket.IO, answering each sampled question correctly, and verifying removed ids did not appear.

Observed local smoke result for the cleanup:

```json
{
  "ok": true,
  "rooms": ["MP8S"],
  "seen": ["build", "expand", "focus", "gift", "launch", "light", "rich", "share", "summer", "think"],
  "removedSeen": []
}
```

Because the 4 Pics game samples 10 out of 12 questions, one smoke run may not see every replacement. Repeat room creation if you need proof that all three replacements can appear.

## Render Verification Checklist

After pushing to GitHub, Render should auto-deploy if auto deploy is enabled.

Check health:

```bash
curl https://guess-who-said-it.onrender.com/healthz
```

Expected response:

```json
{"ok":true}
```

Check the new replacement assets:

```bash
curl -I https://guess-who-said-it.onrender.com/4pics1word/32.jpg
curl -I https://guess-who-said-it.onrender.com/4pics1word/34.jpg
curl -I https://guess-who-said-it.onrender.com/4pics1word/36.jpg
```

Expected status:

```text
HTTP 200
```

Check removed assets after deploy:

```bash
curl -I https://guess-who-said-it.onrender.com/4pics1word/14.jpg
curl -I https://guess-who-said-it.onrender.com/4pics1word/18.jpg
curl -I https://guess-who-said-it.onrender.com/4pics1word/25.jpg
```

Expected status after a clean Render deploy:

```text
HTTP 404
```

If removed assets still return `200`, Render may still be serving the old deployment. Wait for the deploy to finish and retest.

## Known Commit History Before This Export

Recent commits before this handoff file was created:

```text
90a664c Set 4 Pics timer to 45 seconds
6541d6b Add 4 Pics 1 Word icebreaker mode
6c794ce Add logo quiz game mode
37089ff Rebrand app as CDL Ice Breakers
ffff0e8 Add Guess Who Said It icebreaker game
```

The handoff capture `head` in the frontmatter points to `90a664c...`, which was the current `HEAD` before committing the final export changes. The export commit should contain:

- This handoff file.
- Removal of `task`, `catch`, and `active`.
- Addition of `focus`, `share`, and `build`.
- Addition of replacement image pairs `32.jpg` through `37.jpg`.
- Deletion of old image pairs `14.jpg`, `15.jpg`, `18.jpg`, `19.jpg`, `25.jpg`, and `26.jpg`.

## Security And Ownership Notes

- Do not commit Render tokens, GitHub tokens, `.env` files, or account cookies.
- No such secrets are required by the app today.
- Host tokens are generated per room and kept in browser `sessionStorage`.
- Player ids are generated client-side/server-side for reconnect convenience and are not authentication credentials.
- The game content is intended for live sessions, not secure voting or high-stakes scoring.
- The original 4 Pics images came from a user-provided local folder. Confirm usage rights before public or commercial use.
- The logo game should be treated as an educational/trivia style quiz. Avoid using official logo files unless rights are confirmed.

## Common Troubleshooting

### App opens but rooms do not work locally

Make sure both Vite and the Express server are running:

```bash
npm run dev
```

The Vite dev server runs on port `5173`. Socket.IO calls proxy to Express on port `3000`.

### Port 3000 is already used

Stop the other process or set a different port for the server:

```bash
set PORT=3001
npm start
```

On PowerShell:

```powershell
$env:PORT = "3001"
npm start
```

If using Vite dev mode with a different backend port, update `vite.config.ts` proxy targets.

### Render deploy succeeds but game has old questions

Possible causes:

- Render has not finished the new deploy yet.
- Browser cache is showing an old client bundle.
- The server process has not restarted.
- Auto deploy is disabled.

Actions:

1. Trigger a manual deploy in Render.
2. Check `/healthz`.
3. Hard refresh the browser.
4. Check `/4pics1word/32.jpg` and removed asset URLs.
5. Create a new room because old in-memory rooms do not update mid-game.

### Active room disappeared

This is expected after deploy, restart, or free-tier sleep. Rooms are in memory only.

## Recommended Next Enhancements

These are not required to replicate the current app.

- Add a database or Redis if rooms must survive deploys and restarts.
- Add an admin/content JSON file for questions instead of editing `server/index.js`.
- Add a small server-side test file for game-state transitions.
- Add a browser smoke test for host/member flow.
- Add a CSV or JSON import for future 4 Pics questions.
- Add per-mode timers to the logo quiz if desired.

## Continuation Summary

To continue from another account:

1. Get access to `https://github.com/inchliit/guess-who-said-it`, or fork/clone it into the new account.
2. Install Node.js 22 or another modern Node version compatible with Vite 7.
3. Run `npm install`.
4. Run `npm run dev` for local development.
5. Run `npm run check` and `npm run build` before deploying.
6. Create or connect a Render Web Service with the settings in this file.
7. Verify `/healthz`, replacement image assets, and a live 4 Pics room.

Resume command for another Codex session:

```text
/ce-handoff resume "https://github.com/inchliit/guess-who-said-it/blob/main/CDL_ICE_BREAKERS_HANDOFF.md"
```
