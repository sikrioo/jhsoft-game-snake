# jhsoft-game-snake

Single-player and online-ready snake game prototype built with `PIXI.js` and Node.js.

## Features

- Local play mode
- Online prototype mode over WebSocket
- Skin selection and nickname input
- Leaderboard, minimap, boost, particles, and death food drops

## Run

Install dependencies:

```bash
npm install
```

Start server:

```bash
npm run dev
```

Open in browser:

- Local mode: `http://localhost:3000/`
- Online mode: `http://localhost:3000/?mode=online`

## Structure

- `prototype/`: client, rendering, gameplay modules
- `server/`: HTTP + WebSocket server
- `package.json`: scripts and dependencies
