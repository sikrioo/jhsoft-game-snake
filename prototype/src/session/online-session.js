import { CFG } from "../config/game-config.js";
import { lerp } from "../core/utils.js";
import { BrowserInputController } from "../input/browser-input.js";
import { ClientReplicaWorld } from "../network/client-replica-world.js";
import { createPlayerCommand, decodeMessage, encodeMessage, MESSAGE_TYPES, NET_CFG, SESSION_MODES } from "../network/protocol.js";
import { drawBackground } from "../render/background.js";
import { drawHeads } from "../render/snake-heads.js";
import { EffectsSystem } from "../systems/effects-system.js";

export class OnlineSession {
  constructor({ scene, textures, ui, selectedSkinRef, playerNameRef }) {
    this.mode = SESSION_MODES.ONLINE;
    this.scene = scene;
    this.textures = textures;
    this.ui = ui;
    this.selectedSkinRef = selectedSkinRef;
    this.playerNameRef = playerNameRef;
    this.effects = new EffectsSystem({
      layerFX: this.scene.layers.fx,
      textures: this.textures,
      spawnFood: () => {},
    });
    this.replicaWorld = new ClientReplicaWorld(
      { layers: this.scene.layers, textures: this.textures },
      {
        onSnakeDeath: (snake) => {
          if (snake.id === this.selfId) return;
          this.effects.spawnDeathFragments(snake);
          this.effects.collisionBurst(snake.head.x, snake.head.y, 0xfff1c2);
        },
      }
    );
    this.input = new BrowserInputController({
      onPointerMove: (x, y) => this.ui.moveCursor(x, y),
    });
    this.socket = null;
    this.snapshot = null;
    this.selfId = null;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.bgDirty = true;
    this.lbTimer = 0;
    this.joined = false;

    this.scene.setResizeHandler(() => {
      this.applyCamera();
      this.markBGDirty();
    });
    this.scene.app.ticker.add(() => this.tick());
  }

  attach() {
    this.input.attach();
    this.ui.moveCursor(innerWidth / 2, innerHeight / 2);
    this.ui.focusNameInput();
    this.ui.dom.startBtn.addEventListener("click", () => this.start());
    this.ui.dom.retryBtn.addEventListener("click", () => this.start());
  }

  start() {
    this.ui.hideStartScreen();
    this.ui.hideDeathScreen();
    this.ui.clearKillFeed();
    this.ui.resetTransientUI();
    this.snapshot = null;
    this.selfId = null;
    this.joined = false;
    this.connect();
  }

  connect() {
    if (this.socket && this.socket.readyState <= 1) return;
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    this.socket = new WebSocket(`${protocol}://${location.host}${NET_CFG.WS_PATH}`);

    this.socket.addEventListener("open", () => {
      this.socket.send(encodeMessage(MESSAGE_TYPES.JOIN, {
        name: this.playerNameRef?.() || `PLAYER-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        skinId: this.selectedSkinRef().id,
      }));
    });

    this.socket.addEventListener("message", (event) => {
      const message = decodeMessage(event.data);
      if (message.type === MESSAGE_TYPES.SNAPSHOT) {
        this.selfId = message.selfId;
        this.snapshot = message;
        this.replicaWorld.applySnapshot(message);
        this.joined = true;
      }
      if (message.type === MESSAGE_TYPES.ERROR) {
        console.error(message.message);
      }
    });
  }

  markBGDirty() {
    this.bgDirty = true;
  }

  applyCamera() {
    const { width, height } = this.scene.size;
    this.scene.world.position.set(width / 2 - this.cam.x * this.cam.zoom, height / 2 - this.cam.y * this.cam.zoom);
    this.scene.world.scale.set(this.cam.zoom);
  }

  getSelfSnake() {
    if (!this.snapshot || !this.selfId) return null;
    return this.replicaWorld.snakes.get(this.selfId) || null;
  }

  buildCommand() {
    const selfSnake = this.getSelfSnake();
    if (!selfSnake) return createPlayerCommand();
    const input = this.input.getState();
    const { width, height } = this.scene.size;
    return createPlayerCommand({
      targetAngle: Math.atan2(
        (input.pointerY - height / 2) / this.cam.zoom + this.cam.y - selfSnake.head.y,
        (input.pointerX - width / 2) / this.cam.zoom + this.cam.x - selfSnake.head.x
      ),
      boosting: input.boostHeld || input.boostToggle,
    });
  }

  sendInput() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.joined) return;
    this.socket.send(encodeMessage(MESSAGE_TYPES.INPUT, this.buildCommand()));
  }

  updateCamera() {
    const selfSnake = this.getSelfSnake();
    if (!selfSnake) return;
    const targetZoom = selfSnake.boosting || selfSnake.speedBuff > 0 ? CFG.CAM_ZOOM_BST : CFG.CAM_ZOOM_NORM;
    const prevX = this.cam.x;
    const prevY = this.cam.y;
    const prevZoom = this.cam.zoom;
    this.cam.x = lerp(this.cam.x, selfSnake.head.x, CFG.CAM_LERP);
    this.cam.y = lerp(this.cam.y, selfSnake.head.y, CFG.CAM_LERP);
    this.cam.zoom = lerp(this.cam.zoom, targetZoom, CFG.CAM_ZOOM_LERP);

    if (Math.abs(this.cam.x - prevX) > 0.5 || Math.abs(this.cam.y - prevY) > 0.5 || Math.abs(this.cam.zoom - prevZoom) > 0.005) {
      this.markBGDirty();
    }

    this.applyCamera();
  }

  renderWorld() {
    if (!this.snapshot) return;
    if (this.bgDirty) {
      drawBackground(this.scene.layers.background, CFG, this.cam, this.scene.size);
      this.bgDirty = false;
    }
    this.replicaWorld.tick(this.selfId);
    this.effects.tick();
    const snakes = this.replicaWorld.getSnakeList();
    for (const snake of snakes) if (!snake.dead) snake.body.update();
    drawHeads(this.scene.layers.heads, snakes, CFG.SR);
  }

  renderUI() {
    if (!this.snapshot) return;
    const selfSnake = this.getSelfSnake();
    this.ui.setMotionBlur((selfSnake?.boosting || selfSnake?.speedBuff > 0) ?? false);
    this.ui.updateHUD({
      player: selfSnake,
      score: this.snapshot.self.score,
      boostE: this.snapshot.self.boostE,
      boostDuration: CFG.SBUFF_DUR,
    });

    this.lbTimer += this.scene.app.ticker.deltaMS;
    if (this.lbTimer > 500) {
      this.ui.dom.lbr.innerHTML = this.snapshot.leaderboard.map((entry, index) => (
        `<div class="lr${entry.id === this.selfId ? " me" : ""}"><span class="lrk">#${index + 1}</span><span class="lrn">${entry.name}</span><span class="lrs">${entry.len}</span></div>`
      )).join("");
      this.lbTimer = 0;
    }

    this.ui.drawMinimap({
      cfg: CFG,
      foods: this.replicaWorld.getFoodList(),
      stars: this.replicaWorld.getStarList(),
      bots: this.replicaWorld.getSnakeList().filter((snake) => snake.id !== this.selfId),
      player: selfSnake,
      cam: this.cam,
      viewport: this.scene.size,
    });
  }

  tick() {
    if (!this.joined && !this.socket) return;
    this.sendInput();
    this.updateCamera();
    this.renderWorld();
    this.renderUI();
  }
}
