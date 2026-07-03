# Guess Who Said It

A live icebreaker game for small groups. The host creates a room, players join with a code, answer short prompts, then guess who wrote each anonymous answer.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production Build

```bash
npm run build
npm start
```

The production server uses `PORT` from the environment and serves the built React app plus Socket.IO from one Node process.

## Render

Deploy this folder as a Render Web Service.

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/healthz`

Rooms are stored in memory, which is ideal for short live sessions. If the service restarts, active rooms reset.
