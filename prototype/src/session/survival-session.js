import { CFG } from "../config/game-config.js";
import { lerp } from "../core/utils.js";
import { BrowserInputController } from "../input/browser-input.js";
import { createPlayerCommand, NET_CFG, SESSION_MODES } from "../network/protocol.js";
import { drawBackground } from "../render/background.js";
import { SurvivalSimulation } from "../simulation/survival-simulation.js";

function formatTicks(ticks) {
  const totalSeconds = Math.max(0, Math.ceil(ticks / 60));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export class SurvivalSession {
  constructor({ scene, textures, ui, selectedSkinRef, playerNameRef }) {
    this.mode = SESSION_MODES.SURVIVAL;
    this.scene = scene;
    this.textures = textures;
    this.ui = ui;
    this.selectedSkinRef = selectedSkinRef;
    this.playerNameRef = playerNameRef;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.bgDirty = true;
    this.lbTimer = 0;
    this.fixedStepMs = 1000 / NET_CFG.TICK_RATE;
    this.accumulatorMs = 0;
    this.resultShown = false;
    this.shakeTicks = 0;
    this.shakePower = 0;
    this.hitstopMs = 0;

    this.simulation = new SurvivalSimulation({
      renderContext: { layers: this.scene.layers, textures: this.textures },
      selectedSkinRef: this.selectedSkinRef,
      playerNameRef: this.playerNameRef,
      events: {
        onFlash: (color) => this.ui.flash(color),
        onSpeedBuff: () => this.ui.showSpeedBuff(),
        onKillFeed: (killer, victim, type) => this.ui.addKillFeed(killer, victim, type),
        onBanner: (text, variant, duration) => this.ui.showAlertBanner(text, variant, duration),
        onShake: (ticks, power) => {
          this.shakeTicks = Math.max(this.shakeTicks, ticks);
          this.shakePower = Math.max(this.shakePower, power);
        },
        onImpact: (ticks) => {
          this.hitstopMs = Math.max(this.hitstopMs, ticks * this.fixedStepMs);
        },
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
    this.ui.dom.retryBtn.addEventListener("click", () => this.retry());
  }

  start() {
    this.input.reset?.();
    this.ui.hideStartScreen();
    this.ui.hideDeathScreen();
    this.ui.clearKillFeed();
    this.ui.resetTransientUI();
    this.ui.showSurvivalHUD();
    if (this.ui.dom.retryBtn) this.ui.dom.retryBtn.textContent = "RETRY";
    this.simulation.startNewRun();
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.accumulatorMs = 0;
    this.resultShown = false;
    this.shakeTicks = 0;
    this.shakePower = 0;
    this.hitstopMs = 0;
    this.applyCamera();
    this.markBGDirty();
  }

  retry() {
    this.start();
  }

  markBGDirty() {
    this.bgDirty = true;
  }

  applyCamera(shakeX = 0, shakeY = 0) {
    const { width, height } = this.scene.size;
    this.scene.world.position.set(
      width / 2 - this.cam.x * this.cam.zoom + shakeX,
      height / 2 - this.cam.y * this.cam.zoom + shakeY
    );
    this.scene.world.scale.set(this.cam.zoom);
  }

  buildPlayerCommand() {
    const player = this.simulation.player;
    if (!player || player.dead) return createPlayerCommand();

    const input = this.input.getState();
    const { width, height } = this.scene.size;
    return createPlayerCommand({
      targetAngle: Math.atan2(
        (input.pointerY - height / 2) / this.cam.zoom + this.cam.y - player.head.y,
        (input.pointerX - width / 2) / this.cam.zoom + this.cam.x - player.head.x
      ),
      boosting: input.boostHeld || input.boostToggle,
    });
  }

  updateCamera() {
    const player = this.simulation.player;
    if (!player) return;

    const targetZoom = this.simulation.state === "dying"
      ? 0.88
      : player.boosting || player.speedBuff > 0
        ? CFG.CAM_ZOOM_BST
        : CFG.CAM_ZOOM_NORM;
    const prevX = this.cam.x;
    const prevY = this.cam.y;
    const prevZoom = this.cam.zoom;
    this.cam.x = lerp(this.cam.x, player.head.x, CFG.CAM_LERP);
    this.cam.y = lerp(this.cam.y, player.head.y, CFG.CAM_LERP);
    this.cam.zoom = lerp(this.cam.zoom, targetZoom, this.simulation.state === "dying" ? 0.032 : CFG.CAM_ZOOM_LERP);

    if (Math.abs(this.cam.x - prevX) > 0.5 || Math.abs(this.cam.y - prevY) > 0.5 || Math.abs(this.cam.zoom - prevZoom) > 0.005) {
      this.markBGDirty();
    }

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTicks > 0) {
      shakeX = (Math.random() * 2 - 1) * this.shakePower * 8;
      shakeY = (Math.random() * 2 - 1) * this.shakePower * 8;
      this.shakeTicks--;
      this.shakePower *= 0.92;
    }

    this.applyCamera(shakeX, shakeY);
  }

  renderWorld() {
    if (this.bgDirty) {
      drawBackground(this.scene.layers.background, CFG, this.cam, this.scene.size);
      this.bgDirty = false;
    }

    const all = [this.simulation.player, ...this.simulation.bots].filter(Boolean);
    for (const snake of all) if (!snake.dead) snake.body.update();
  }

  renderUI() {
    const player = this.simulation.player;
    this.ui.setMotionBlur((player?.boosting || player?.speedBuff > 0) ?? false);
    this.ui.updateHUD({
      player,
      score: this.simulation.score,
      boostE: this.simulation.boostE,
      boostDuration: CFG.SBUFF_DUR,
    });

    this.ui.updateSurvivalHUD({
      totalTime: formatTicks(this.simulation.getTotalTimeLeftTicks()),
      waveLabel: `WAVE ${this.simulation.wave}`,
      waveTime: formatTicks(this.simulation.getWaveTimeLeftTicks()),
      botCount: this.simulation.getLivingBotCount(),
    });

    this.lbTimer += this.scene.app.ticker.deltaMS;
    if (this.lbTimer > 500) {
      this.ui.updateLeaderboard(player, this.simulation.bots);
      this.lbTimer = 0;
    }

    this.ui.drawMinimap({
      cfg: CFG,
      foods: this.simulation.foods,
      stars: this.simulation.stars,
      bots: this.simulation.bots,
      player,
      cam: this.cam,
      viewport: this.scene.size,
    });

    if (!this.resultShown && this.simulation.result) {
      if (this.simulation.result.type === "complete") {
        this.resultShown = true;
        this.ui.hideSurvivalHUD();
        this.ui.showResultScreen({
          title: "CLEARED",
          subtitle: "SURVIVAL COMPLETE · ALL WAVES CLEARED",
          stats: [
            { value: "10:00", label: "SURVIVED" },
            { value: "5", label: "WAVE" },
            { value: `${this.simulation.kills}`, label: "KILLS" },
          ],
        });
        if (this.ui.dom.retryBtn) this.ui.dom.retryBtn.textContent = "PLAY AGAIN";
      } else if (this.simulation.result.type === "gameover" && this.simulation.state === "dead") {
        this.resultShown = true;
        this.ui.hideSurvivalHUD();
        this.ui.showResultScreen({
          title: "GAME OVER",
          subtitle: "The swarm overwhelmed your route",
          stats: [
            { value: formatTicks(this.simulation.result.survivedTicks), label: "SURVIVED" },
            { value: `${this.simulation.result.wave}`, label: "WAVE" },
            { value: `${this.simulation.kills}`, label: "KILLS" },
          ],
        });
        if (this.ui.dom.retryBtn) this.ui.dom.retryBtn.textContent = "RETRY";
      }
    }
  }

  tick(deltaMS) {
    if (this.hitstopMs > 0) {
      this.hitstopMs = Math.max(0, this.hitstopMs - deltaMS);
      this.updateCamera();
      this.renderWorld();
      this.renderUI();
      return;
    }

    this.accumulatorMs += deltaMS;

    while (this.accumulatorMs >= this.fixedStepMs) {
      const command = this.buildPlayerCommand();
      this.simulation.tick(command);
      this.accumulatorMs -= this.fixedStepMs;
    }

    this.updateCamera();
    this.renderWorld();
    this.renderUI();
  }
}
