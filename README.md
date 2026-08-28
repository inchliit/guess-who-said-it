# CDL Ice Breakers

A live icebreaker game for small groups. The host creates a room, players join with a code, then plays one of three modes:

- **4 Pics 1 Word**: a 10-question picture-word puzzle with a 45-second timer per question and +1 scoring for correct answers.
- **Which Logo Is Correct**: a 10-question visual logo quiz.
- **Guess Who Said It**: anonymous prompt answers, group guesses, and reveals.

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
