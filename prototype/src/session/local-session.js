import { CFG } from "../config/game-config.js";
import { lerp } from "../core/utils.js";
import { BrowserInputController } from "../input/browser-input.js";
import { createPlayerCommand, NET_CFG, serializeSimulationSnapshot, SESSION_MODES } from "../network/protocol.js";
import { drawBackground } from "../render/background.js";
import { drawHeads } from "../render/snake-heads.js";
import { LocalSimulation } from "../simulation/local-simulation.js";

export class LocalSession {
  constructor({ scene, textures, ui, selectedSkinRef, playerNameRef }) {
    this.mode = SESSION_MODES.LOCAL;
    this.scene = scene;
    this.textures = textures;
    this.ui = ui;
    this.selectedSkinRef = selectedSkinRef;
    this.playerNameRef = playerNameRef;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.bgDirty = true;
    this.lbTimer = 0;
    this.wasDeadShown = false;
    this.fixedStepMs = 1000 / NET_CFG.TICK_RATE;
    this.accumulatorMs = 0;

    this.simulation = new LocalSimulation({
      renderContext: { layers: this.scene.layers, textures: this.textures },
      selectedSkinRef: this.selectedSkinRef,
      playerNameRef: this.playerNameRef,
      events: {
        onFlash: (color) => this.ui.flash(color),
        onSpeedBuff: () => this.ui.showSpeedBuff(),
        onKillFeed: (killer, victim, type) => this.ui.addKillFeed(killer, victim, type),
      },
    });

    this.input = new BrowserInputController({
      onPointerMove: (x, y) => this.ui.moveCursor(x, y),
    });

    this.scene.setResizeHandler(() => {
      this.applyCamera();
      this.markBGDirty();
    });

    this.scene.app.ticker.add(() => this.tick(this.scene.app.ticker.deltaMS));
  }

  attach() {
    this.input.attach();
    this.ui.moveCursor(innerWidth / 2, innerHeight / 2);
    this.ui.focusNameInput();
    this.ui.dom.startBtn.addEventListener("click", () => this.start());
    this.ui.dom.retryBtn.addEventListener("click", () => this.retry());
  }

  start() {
    this.ui.hideStartScreen();
    this.ui.hideDeathScreen();
    this.simulation.startNewRun();
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.wasDeadShown = false;
    this.ui.resetTransientUI();
    this.ui.clearKillFeed();
    this.applyCamera();
    this.markBGDirty();
  }

  retry() {
    this.ui.hideDeathScreen();
    this.start();
  }

  markBGDirty() {
    this.bgDirty = true;
  }

  applyCamera() {
    const { width, height } = this.scene.size;
    this.scene.world.position.set(width / 2 - this.cam.x * this.cam.zoom, height / 2 - this.cam.y * this.cam.zoom);
    this.scene.world.scale.set(this.cam.zoom);
  }

  buildPlayerCommand(snapshot) {
    const player = snapshot.player;
    if (!player || player.dead) return createPlayerCommand();

    const input = this.input.getState();
    const { width, height } = this.scene.size;
    const targetAngle = Math.atan2(
      (input.pointerY - height / 2) / this.cam.zoom + this.cam.y - player.head.y,
      (input.pointerX - width / 2) / this.cam.zoom + this.cam.x - player.head.x
    );

    return createPlayerCommand({
      targetAngle,
      boosting: input.boostHeld || input.boostToggle,
    });
  }

  updateCamera(snapshot) {
    const player = snapshot.player;
    if (!player) return;

    const targetZoom = snapshot.state === "dying"
      ? 0.88
      : player.boosting || player.speedBuff > 0
        ? CFG.CAM_ZOOM_BST
        : CFG.CAM_ZOOM_NORM;
    const prevX = this.cam.x;
    const prevY = this.cam.y;
    const prevZoom = this.cam.zoom;
    this.cam.x = lerp(this.cam.x, player.head.x, CFG.CAM_LERP);
    this.cam.y = lerp(this.cam.y, player.head.y, CFG.CAM_LERP);
    this.cam.zoom = lerp(this.cam.zoom, targetZoom, snapshot.state === "dying" ? 0.032 : CFG.CAM_ZOOM_LERP);

    if (Math.abs(this.cam.x - prevX) > 0.5 || Math.abs(this.cam.y - prevY) > 0.5 || Math.abs(this.cam.zoom - prevZoom) > 0.005) {
      this.markBGDirty();
    }

    this.applyCamera();
  }

  renderWorld(snapshot) {
    if (this.bgDirty) {
      drawBackground(this.scene.layers.background, CFG, this.cam, this.scene.size);
      this.bgDirty = false;
    }

    const all = [snapshot.player, ...snapshot.bots].filter(Boolean);
    for (const snake of all) if (!snake.dead) snake.body.update();
    drawHeads(this.scene.layers.heads, all, CFG.SR);
  }

  renderUI(snapshot) {
    this.ui.setMotionBlur((snapshot.player?.boosting || snapshot.player?.speedBuff > 0) ?? false);
    this.ui.updateHUD({
      player: snapshot.player,
      score: snapshot.score,
      boostE: snapshot.boostE,
      boostDuration: CFG.SBUFF_DUR,
    });

    this.lbTimer += this.scene.app.ticker.deltaMS;
    if (this.lbTimer > 500) {
      this.ui.updateLeaderboard(snapshot.player, snapshot.bots);
      this.lbTimer = 0;
    }

    this.ui.drawMinimap({
      cfg: CFG,
      foods: snapshot.foods,
      stars: snapshot.stars,
      bots: snapshot.bots,
      player: snapshot.player,
      cam: this.cam,
      viewport: this.scene.size,
    });

    if (snapshot.state === "dead" && !this.wasDeadShown) {
      this.wasDeadShown = true;
      this.ui.showDeathScreen({
        player: snapshot.player,
        score: snapshot.score,
        kills: snapshot.kills,
      });
    }
  }

  tick(deltaMS) {
    this.accumulatorMs += deltaMS;

    while (this.accumulatorMs >= this.fixedStepMs) {
      const before = serializeSimulationSnapshot(this.simulation);
      const command = this.buildPlayerCommand(before);
      this.simulation.tick(command);
      this.accumulatorMs -= this.fixedStepMs;
    }

    const snapshot = serializeSimulationSnapshot(this.simulation);
    this.updateCamera(snapshot);
    this.renderWorld(snapshot);
    this.renderUI(snapshot);
  }
}
