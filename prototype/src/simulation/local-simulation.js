import { CFG } from "../config/game-config.js";
import { Grid } from "../core/grid.js";
import { dist, hslHex } from "../core/utils.js";
import { Bot } from "../entities/bot.js";
import { Food } from "../entities/food.js";
import { Snake } from "../entities/snake.js";
import { createPlayerCommand } from "../network/protocol.js";
import { EffectsSystem } from "../systems/effects-system.js";

const START_SPAWN_PROTECTION_TICKS = 45;

export class LocalSimulation {
  constructor({ renderContext, selectedSkinRef, playerNameRef, events = {} }) {
    this.renderContext = renderContext;
    this.selectedSkinRef = selectedSkinRef;
    this.playerNameRef = playerNameRef;
    this.events = {
      onFlash: () => {},
      onSpeedBuff: () => {},
      onKillFeed: () => {},
      ...events,
    };

    this.foodsGrid = new Grid(80);
    this.segmentsGrid = new Grid(40);
    this.effects = new EffectsSystem({
      layerFX: this.renderContext.layers.fx,
      textures: this.renderContext.textures,
      spawnFood: (x, y, options) => this.spawnFood(x, y, options),
    });

    this.runId = 0;
    this.state = "start";
    this.player = null;
    this.bots = [];
    this.foods = [];
    this.stars = [];
    this.score = 0;
    this.kills = 0;
    this.boostE = 100;
    this.boostDT = 0;
    this.prevBoost = false;
    this.deathTimer = 0;
    this.frameId = 0;
  }

  startNewRun() {
    this.runId += 1;
    if (this.player) this.player.destroy();
    for (const bot of this.bots) bot.destroy();
    for (const food of this.foods) food.remove();
    for (const star of this.stars) star.remove();

    this.effects.clear();
    this.foods = [];
    this.stars = [];
    this.bots = [];
    this.score = 0;
    this.kills = 0;
    this.boostE = 100;
    this.boostDT = 0;
    this.prevBoost = false;
    this.deathTimer = 0;
    this.frameId = 0;
    this.player = new Snake({
      x: 0,
      y: 0,
      len: 22,
      skin: this.selectedSkinRef(),
      name: this.playerNameRef?.() || "PLAYER",
      isPlayer: true,
      showNameTag: true,
      renderContext: this.renderContext,
      spawnFood: (x, y, options) => this.spawnFood(x, y, options),
    });
    this.player.spawnProtectionTicks = START_SPAWN_PROTECTION_TICKS;

    for (let i = 0; i < CFG.BOT_N; i++) {
      const bot = new Bot({
        renderContext: this.renderContext,
        spawnFood: (x, y, options) => this.spawnFood(x, y, options),
      });
      bot.spawnProtectionTicks = START_SPAWN_PROTECTION_TICKS;
      this.bots.push(bot);
    }

    this.refill();
    this.state = "playing";
  }

  spawnFood(x, y, options = {}) {
    const maxFood = options.ignoreSoftCap ? CFG.FOOD_HARD_MAX : CFG.FOOD_MAX;
    if (this.foods.length >= maxFood) return null;
    this.foods.push(new Food({
      x,
      y,
      type: "normal",
      layerFood: this.renderContext.layers.food,
      textures: this.renderContext.textures,
      value: options.value,
      radius: options.radius,
      color: options.color,
    }));
    return this.foods[this.foods.length - 1];
  }

  spawnStar() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * (CFG.WR * 0.9 - 100);
    this.stars.push(new Food({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      type: "star",
      layerFood: this.renderContext.layers.food,
      textures: this.renderContext.textures,
    }));
  }

  refill() {
    while (this.foods.length < CFG.FOOD_N) this.spawnFood();
    while (this.stars.length < CFG.STAR_N) this.spawnStar();
  }

  removeFood(list, index) {
    list[index].remove();
    list.splice(index, 1);
  }

  spawnDeathFoodTrail(snake) {
    const dropCount = Math.max(8, Math.min(140, Math.round(snake.len * 0.85)));
    for (let i = 0; i < dropCount; i++) {
      const t = i / Math.max(1, dropCount - 1);
      const segIndex = Math.floor(t * (snake.segs.length - 1));
      const seg = snake.segs[segIndex];
      this.spawnFood(seg.x + (Math.random() * 12 - 6), seg.y + (Math.random() * 12 - 6), { ignoreSoftCap: true });
    }
  }

  isHeadOnCollision(snake, killer) {
    return Boolean(killer?.head && dist(snake.head.x, snake.head.y, killer.head.x, killer.head.y) < CFG.SR * 2.8);
  }

  attractNearbyFoodsToPlayer() {
    if (!this.player || this.player.dead) return;
    const px = this.player.head.x;
    const py = this.player.head.y;
    const radius = CFG.FOOD_ATTRACT_RADIUS;
    const nearbyFoods = this.foodsGrid.near(px, py, radius);

    for (const food of nearbyFoods) {
      if (!food || food.type !== "normal") continue;
      const dx = px - food.x;
      const dy = py - food.y;
      const d = Math.hypot(dx, dy);
      if (d <= 1 || d > radius) continue;
      const pullT = 1 - d / radius;
      const step = 0.45 + pullT * CFG.FOOD_ATTRACT_PULL;
      food.x += (dx / d) * step;
      food.y += (dy / d) * step;
    }
  }

  eatFoods() {
    if (!this.player || this.player.dead) return;

    const px = this.player.head.x;
    const py = this.player.head.y;
    const pr = CFG.SR;

    this.attractNearbyFoodsToPlayer();

    for (let i = this.foods.length - 1; i >= 0; i--) {
      const food = this.foods[i];
      if (dist(px, py, food.x, food.y) < pr + food.r) {
        this.player.grow(food.val);
        this.score += food.val;
        if (Math.random() < 0.32) this.effects.burst(food.x, food.y, food.color, 5, 2, 16, 2.5);
        this.removeFood(this.foods, i);
      }
    }

    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      if (dist(px, py, star.x, star.y) < pr + star.r + 2) {
        this.player.grow(star.val);
        this.score += star.val;
        this.player.speedBuff = CFG.SBUFF_DUR;
        this.effects.starBurst(star.x, star.y);
        this.events.onFlash("rgba(255,208,96,0.16)");
        this.events.onSpeedBuff();
        this.events.onKillFeed("YOU", "SPEED BOOST", "sk");
        this.removeFood(this.stars, i);
      }
    }
  }

  die(snake, killer) {
    if (snake.dead) return;

    const headOn = this.isHeadOnCollision(snake, killer);
    snake.dead = true;
    snake.boosting = false;
    if (snake.body?.setVisible) snake.body.setVisible(false);
    this.effects.spawnDeathFragments(snake);
    this.effects.burst(snake.head.x, snake.head.y, hslHex(snake.skin.hue, 100, 62), 24, 5.5, 15, 5.5);
    if (headOn) {
      const midX = (snake.head.x + killer.head.x) / 2;
      const midY = (snake.head.y + killer.head.y) / 2;
      this.effects.collisionBurst(midX, midY, hslHex(snake.skin.hue, 100, 68));
      this.effects.collisionBurst(snake.head.x, snake.head.y, 0xfff1c2);
      this.effects.collisionBurst(killer.head.x, killer.head.y, 0xfff1c2);
      this.events.onFlash("rgba(255,241,194,0.18)");
    }
    this.spawnDeathFoodTrail(snake);

    if (snake === this.player) {
      this.state = "dying";
      this.deathTimer = 95;
      this.events.onFlash("rgba(255,60,90,0.22)");
      this.events.onKillFeed(killer?.name || "WALL", "YOU", "normal");
      return;
    }

    const killedByPlayer = killer === this.player;
    if (killedByPlayer) this.kills++;
    this.events.onKillFeed(killedByPlayer ? "YOU" : (killer?.name || "WALL"), snake.name, killedByPlayer ? "pk" : "normal");

    const runId = this.runId;
    setTimeout(() => {
      if (runId !== this.runId) return;
      const index = this.bots.indexOf(snake);
      if (index === -1) return;
      snake.destroy();
      const bot = new Bot({
        renderContext: this.renderContext,
        spawnFood: (x, y, options) => this.spawnFood(x, y, options),
      });
      bot.spawnProtectionTicks = START_SPAWN_PROTECTION_TICKS;
      this.bots[index] = bot;
    }, 4000);
  }

  checkCollisions() {
    const all = [this.player, ...this.bots];
    for (const snake of all) {
      if (!snake || snake.dead) continue;
      const nearbySegments = this.segmentsGrid.near(snake.head.x, snake.head.y, CFG.SR * 5);
      for (const { seg, own } of nearbySegments) {
        if (own === snake) continue;
        if (snake.spawnProtectionTicks > 0 || own?.spawnProtectionTicks > 0) continue;
        if (dist(snake.head.x, snake.head.y, seg.x, seg.y) < CFG.SR * 2) {
          this.die(snake, own);
          break;
        }
      }
    }

    for (const bot of this.bots) {
      if (bot.dead) continue;
      for (let i = this.stars.length - 1; i >= 0; i--) {
        const star = this.stars[i];
        if (dist(bot.head.x, bot.head.y, star.x, star.y) < CFG.SR + star.r + 2) {
          bot.grow(star.val);
          bot.speedBuff = CFG.SBUFF_DUR;
          this.removeFood(this.stars, i);
          break;
        }
      }
    }
  }

  rebuildGrids() {
    this.foodsGrid.clear();
    this.segmentsGrid.clear();
    for (const food of this.foods) this.foodsGrid.add(food.x, food.y, food);
    for (const star of this.stars) this.foodsGrid.add(star.x, star.y, star);
    for (const snake of [this.player, ...this.bots]) {
      if (!snake || snake.dead) continue;
      for (const seg of snake.segs) this.segmentsGrid.add(seg.x, seg.y, { seg, own: snake });
    }
  }

  updatePlayer(command = createPlayerCommand()) {
    if (this.state !== "playing" || !this.player || this.player.dead) return;

    this.player.steer(command.targetAngle, 0.1);
    const wantBoost = command.boosting && this.boostE > 0 && this.player.len > CFG.MIN_LEN && this.player.speedBuff === 0;
    this.player.boosting = wantBoost;
    if (wantBoost && !this.prevBoost) this.events.onFlash();
    if (!wantBoost && this.prevBoost) this.player.flushCompactDropCarry();
    this.prevBoost = wantBoost;

    if (wantBoost) {
      this.boostDT++;
      if (this.boostDT >= CFG.BST_DRAIN_F) {
        this.player.shrink(1, { compactDrops: true });
        this.boostE = Math.max(0, this.boostE - CFG.BST_E_DRAIN);
        this.boostDT = 0;
      }
    } else {
      this.boostE = Math.min(100, this.boostE + CFG.BST_E_REGEN);
    }

    if (this.player.spawnProtectionTicks > 0) this.player.spawnProtectionTicks--;
    this.player.move();
    this.eatFoods();
    if (Math.hypot(this.player.head.x, this.player.head.y) > CFG.WR) this.die(this.player, { name: "WALL" });

    if ((wantBoost || this.player.speedBuff > 0) && Math.random() < 0.24) {
      const segIndex = Math.min(3, this.player.segs.length - 1);
      this.effects.spark(
        this.player.segs[segIndex].x,
        this.player.segs[segIndex].y,
        this.player.angle,
        this.player.speedBuff > 0 ? 0xffd060 : hslHex(this.player.skin.hue, 100, 78)
      );
    }
  }

  updateBots() {
    for (const bot of this.bots) {
      if (bot.spawnProtectionTicks > 0) bot.spawnProtectionTicks--;
      bot.update({ foodsGrid: this.foodsGrid, stars: this.stars, player: this.player });
      if (!bot.dead && Math.hypot(bot.head.x, bot.head.y) > CFG.WR) this.die(bot, { name: "WALL" });
    }
  }

  updateConsumables() {
    for (const food of this.foods) food.tick(this.frameId);
    for (const star of this.stars) star.tick(this.frameId);
    this.refill();
    if (this.state === "playing") this.checkCollisions();
  }

  updateDeathState() {
    if (this.state !== "dying") return;
    this.deathTimer--;
    if (this.deathTimer <= 0) this.state = "dead";
  }

  tick(playerCommand) {
    if (this.state !== "playing" && this.state !== "dying") return;
    this.frameId += 1;
    this.rebuildGrids();
    this.updatePlayer(playerCommand);
    this.updateBots();
    this.updateConsumables();
    this.effects.tick();
    this.updateDeathState();
  }
}
