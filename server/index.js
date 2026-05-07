import crypto from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { decodeMessage, encodeMessage, MESSAGE_TYPES, NET_CFG } from "../prototype/src/network/protocol.js";
import { ServerSimulation } from "../prototype/src/simulation/server-simulation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const prototypeDir = path.join(rootDir, "prototype");
const simulation = new ServerSimulation();
const sockets = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendSnapshot(playerId) {
  const socket = sockets.get(playerId);
  if (!socket || socket.readyState !== socket.OPEN) return;
  socket.send(encodeMessage(MESSAGE_TYPES.SNAPSHOT, simulation.getSnapshotFor(playerId)));
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, "http://localhost");
  const filePath = reqUrl.pathname === "/"
    ? path.join(prototypeDir, "snake-game.v0.8.html")
    : path.join(prototypeDir, reqUrl.pathname.slice(1));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const fileStat = await stat(filePath);
  if (fileStat.isDirectory()) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket) => {
  const playerId = crypto.randomUUID();
  sockets.set(playerId, socket);

  socket.on("message", (raw) => {
    const message = decodeMessage(raw);

    if (message.type === MESSAGE_TYPES.JOIN) {
      simulation.addPlayer(playerId, {
        name: message.name,
        skinId: message.skinId,
      });
      sendSnapshot(playerId);
      return;
    }

    if (message.type === MESSAGE_TYPES.INPUT) {
      simulation.setPlayerInput(playerId, {
        targetAngle: message.targetAngle,
        boosting: message.boosting,
      });
    }
  });

  socket.on("close", () => {
    simulation.removePlayer(playerId);
    sockets.delete(playerId);
  });
});

server.on("upgrade", (req, socket, head) => {
  const reqUrl = new URL(req.url, "http://localhost");
  if (reqUrl.pathname !== NET_CFG.WS_PATH) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

setInterval(() => {
  simulation.tick();
  for (const playerId of sockets.keys()) sendSnapshot(playerId);
}, 1000 / NET_CFG.TICK_RATE);

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Local mode:  http://localhost:${port}/`);
  console.log(`Online mode: http://localhost:${port}/?mode=online`);
});
