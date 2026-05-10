import { CFG } from "../config/game-config.js";
import { SKINS } from "../config/skins.js";
import { Grid } from "../core/grid.js";
import { dist, hslHex, rnd } from "../core/utils.js";
import { Bot } from "../entities/bot.js";
import { Food } from "../entities/food.js";
import { Snake } from "../entities/snake.js";
import { createPlayerCommand, getPlayerViewState, serializeFood, serializeSnake } from "../network/protocol.js";
import { EffectsSystem } from "../systems/effects-system.js";

function findSkinById(skinId) {
  return SKINS.find((skin) => skin.id === skinId) || SKINS[0];
}

const SPAWN_PROTECTION_TICKS = 45;

function getSnakeRadiusValue(snake) {
  return snake?.radius ?? CFG.SR;
}

export class ServerSimulation {
  constructor() {
    this.foodsGrid = new Grid(80);
    this.segmentsGrid = new Grid(40);
    this.effects = new EffectsSystem({
      layerFX: null,
      textures: null,
      spawnFood: (x, y, options) => this.spawnFood(x, y, options),
    });
    this.foods = [];
    this.stars = [];
    this.bots = [];
    this.players = new Map();
    this.state = "running";
    this.runId = 0;
    this.nextEntityId = 1;
    this.initWorld();
  }

  createEntityId(prefix) {
    const id = `${prefix}:${this.nextEntityId}`;
    this.nextEntityId += 1;
    return id;
  }

  initWorld() {
    this.runId += 1;
    for (const food of this.foods) food.remove();
    for (const star of this.stars) star.remove();
    for (const bot of this.bots) bot.destroy();
    this.foods = [];
    this.stars = [];
    this.bots = [];
    this.effects.clear();

    for (let i = 0; i < CFG.BOT_N; i++) {
      const bot = new Bot({
        renderContext: null,
        spawnFood: (x, y, options) => this.spawnFood(x, y, options),
      });
      bot.netId = this.createEntityId("bot");
      this.bots.push(bot);
    }

    this.refill();
  }

  getBlockingSnakes(excludeSnake = null) {
    const snakes = [
      ...[...this.players.values()].map((player) => player.snake),
      ...this.bots,
    ];
    return snakes.filter((snake) => snake && !snake.dead && snake !== excludeSnake);
  }

  evaluateSpawnCandidate(x, y, excludeSnake = null) {
    const boundaryClearance = CFG.WR - Math.hypot(x, y);
    let minDist = boundaryClearance;

    for (const snake of this.getBlockingSnakes(excludeSnake)) {
      minDist = Math.min(minDist, dist(x, y, snake.head.x, snake.head.y));
      for (let i = 0; i < snake.segs.length; i += 2) {
        minDist = Math.min(minDist, dist(x, y, snake.segs[i].x, snake.segs[i].y));
      }
    }

    return minDist;
  }

  findSafeSpawnPosition(excludeSnake = null) {
    let best = { x: 0, y: 0, score: -Infinity };
    const targetClearance = CFG.SR * 24;

    for (let i = 0; i < 140; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = rnd(180, CFG.WR - 260);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const score = this.evaluateSpawnCandidate(x, y, excludeSnake);

      if (score > best.score) best = { x, y, score };
      if (score >= targetClearance) return { x, y };
    }

    return { x: best.x, y: best.y };
  }

  addPlayer(id, { name, skinId }) {
    const spawn = this.findSafeSpawnPosition();
    const snake = new Snake({
      x: spawn.x,
      y: spawn.y,
      len: 22,
      skin: findSkinById(skinId),
      name: name || `P-${id.slice(0, 4)}`,
      isPlayer: true,
      showNameTag: true,
      renderContext: null,
      spawnFood: (x, y, options) => this.spawnFood(x, y, options),
    });

    this.players.set(id, {
      id,
      name: snake.name,
      skinId: snake.skin.id,
      snake,
      input: createPlayerCommand(),
      score: 0,
      kills: 0,
      boostE: 100,
      boostDT: 0,
      prevBoost: false,
      respawnTicks: 0,
      spawnProtectionTicks: SPAWN_PROTECTION_TICKS,
    });
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    if (player.snake) player.snake.destroy();
    this.players.delete(id);
  }

  respawnPlayer(player) {
    if (player.snake) player.snake.destroy();
    const spawn = this.findSafeSpawnPosition(player.snake);
    player.snake = new Snake({
      x: spawn.x,
      y: spawn.y,
      len: 22,
      skin: findSkinById(player.skinId),
      name: player.name,
      isPlayer: true,
      showNameTag: true,
      renderContext: null,
      spawnFood: (x, y, options) => this.spawnFood(x, y, options),
    });
    player.boostE = 100;
    player.boostDT = 0;
    player.prevBoost = false;
    player.respawnTicks = 0;
    player.spawnProtectionTicks = SPAWN_PROTECTION_TICKS;
    player.input = createPlayerCommand();
  }

  setPlayerInput(id, input) {
    const player = this.players.get(id);
    if (!player) return;
    player.input = createPlayerCommand(input);
  }

  spawnFood(x, y, options = {}) {
    const maxFood = options.ignoreSoftCap ? CFG.FOOD_HARD_MAX : CFG.FOOD_MAX;
    if (this.foods.length >= maxFood) return null;
    const food = new Food({
      x,
      y,
      type: "normal",
      layerFood: null,
      textures: null,
      value: options.value,
      radius: options.radius,
      color: options.color,
    });
    food.netId = this.createEntityId("food");
    this.foods.push(food);
    return food;
  }

  spawnStar() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * (CFG.WR * 0.9 - 100);
    const star = new Food({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      type: "star",
      layerFood: null,
      textures: null,
    });
    star.netId = this.createEntityId("star");
    this.stars.push(star);
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
    const dropCount = Math.max(
      CFG.DEATH_FOOD_DROP_MIN,
      Math.min(CFG.DEATH_FOOD_DROP_MAX, Math.round(snake.len * CFG.DEATH_FOOD_DROP_FACTOR))
    );
    for (let i = 0; i < dropCount; i++) {
      const t = i / Math.max(1, dropCount - 1);
      const segIndex = Math.floor(t * (snake.segs.length - 1));
      const seg = snake.segs[segIndex];
      this.spawnFood(seg.x + (Math.random() * 12 - 6), seg.y + (Math.random() * 12 - 6), { ignoreSoftCap: true });
    }
  }

  isHeadOnCollision(snake, killerSnake) {
    const snakeRadius = getSnakeRadiusValue(snake);
    const killerRadius = getSnakeRadiusValue(killerSnake);
    return Boolean(
      killerSnake?.head &&
      dist(snake.head.x, snake.head.y, killerSnake.head.x, killerSnake.head.y) < (snakeRadius + killerRadius) * 1.4
    );
  }

  attractNearbyFoodsToSnake(snake) {
    if (!snake || snake.dead) return;
    const px = snake.head.x;
    const py = snake.head.y;
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

  getLivingPlayerStates() {
    return [...this.players.values()].filter((player) => player.snake && !player.snake.dead);
  }

  eatFoodsForPlayer(player) {
    const snake = player.snake;
    if (!snake || snake.dead) return;

    const px = snake.head.x;
    const py = snake.head.y;
    const pr = snake.radius ?? CFG.SR;

    this.attractNearbyFoodsToSnake(snake);

    for (let i = this.foods.length - 1; i >= 0; i--) {
      const food = this.foods[i];
      if (dist(px, py, food.x, food.y) < pr + food.r) {
        snake.grow(food.val);
        player.score += food.val;
        if (Math.random() < 0.32) this.effects.burst(food.x, food.y, food.color, 5, 2, 16, 2.5);
        this.removeFood(this.foods, i);
      }
    }

    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      if (dist(px, py, star.x, star.y) < pr + star.r + 2) {
        snake.grow(star.val);
        player.score += star.val;
        snake.speedBuff = CFG.SBUFF_DUR;
        this.effects.starBurst(star.x, star.y);
        this.removeFood(this.stars, i);
      }
    }
  }

  dieSnake(snake, killerSnake) {
    if (snake.dead) return;

    const headOn = this.isHeadOnCollision(snake, killerSnake);
    snake.dead = true;
    snake.boosting = false;
    if (snake.body?.setVisible) snake.body.setVisible(false);
    this.effects.spawnDeathFragments(snake);
    this.effects.burst(snake.head.x, snake.head.y, hslHex(snake.skin.hue, 100, 62), 24, 5.5, 15, 5.5);
    if (headOn) {
      const midX = (snake.head.x + killerSnake.head.x) / 2;
      const midY = (snake.head.y + killerSnake.head.y) / 2;
      this.effects.collisionBurst(midX, midY, hslHex(snake.skin.hue, 100, 68));
      this.effects.collisionBurst(snake.head.x, snake.head.y, 0xfff1c2);
      this.effects.collisionBurst(killerSnake.head.x, killerSnake.head.y, 0xfff1c2);
    }
    this.spawnDeathFoodTrail(snake);

    const player = [...this.players.values()].find((entry) => entry.snake === snake);
    const killerPlayer = [...this.players.values()].find((entry) => entry.snake === killerSnake);

    if (player) {
      player.respawnTicks = 60;
      player.boostDT = 0;
      player.prevBoost = false;
    }

    if (killerPlayer && killerPlayer !== player) killerPlayer.kills += 1;
  }

  rebuildGrids() {
    this.foodsGrid.clear();
    this.segmentsGrid.clear();

    for (const food of this.foods) this.foodsGrid.add(food.x, food.y, food);
    for (const star of this.stars) this.foodsGrid.add(star.x, star.y, star);

    for (const snake of [...this.players.values()].map((player) => player.snake).concat(this.bots)) {
      if (!snake || snake.dead) continue;
      for (const seg of snake.segs) this.segmentsGrid.add(seg.x, seg.y, { seg, own: snake });
    }
  }

  updatePlayers() {
    for (const player of this.players.values()) {
      const snake = player.snake;
      if (!snake) continue;

      if (snake.dead) {
        if (player.respawnTicks > 0) {
          player.respawnTicks--;
          if (player.respawnTicks <= 0) this.respawnPlayer(player);
        }
        continue;
      }

      if (player.spawnProtectionTicks > 0) player.spawnProtectionTicks--;

      snake.steer(player.input.targetAngle, 0.1);
      const wantBoost = player.input.boosting && player.boostE > 0 && snake.len > CFG.MIN_LEN && snake.speedBuff === 0;
      snake.boosting = wantBoost;
      if (!wantBoost && player.prevBoost) snake.flushCompactDropCarry();
      player.prevBoost = wantBoost;

      if (wantBoost) {
        player.boostDT++;
        if (player.boostDT >= CFG.BST_DRAIN_F) {
          snake.shrink(1, { compactDrops: true });
          player.boostE = Math.max(0, player.boostE - CFG.BST_E_DRAIN);
          player.boostDT = 0;
        }
      } else {
        player.boostE = Math.min(100, player.boostE + CFG.BST_E_REGEN);
      }

      snake.move();
      this.eatFoodsForPlayer(player);
      if (Math.hypot(snake.head.x, snake.head.y) > CFG.WR - getSnakeRadiusValue(snake)) this.dieSnake(snake, null);

      if ((wantBoost || snake.speedBuff > 0) && Math.random() < 0.24) {
        const segIndex = Math.min(3, snake.segs.length - 1);
        this.effects.spark(
          snake.segs[segIndex].x,
          snake.segs[segIndex].y,
          snake.angle,
          snake.speedBuff > 0 ? 0xffd060 : hslHex(snake.skin.hue, 100, 78)
        );
      }
    }
  }

  updateBots() {
    const livingPlayers = this.getLivingPlayerStates();

    for (const bot of this.bots) {
      const targetPlayer = livingPlayers.length === 0
        ? null
        : livingPlayers.reduce((best, current) => {
          if (!best) return current;
          const currentDist = dist(bot.head.x, bot.head.y, current.snake.head.x, current.snake.head.y);
          const bestDist = dist(bot.head.x, bot.head.y, best.snake.head.x, best.snake.head.y);
          return currentDist < bestDist ? current : best;
        }, null);

      bot.update({
        foodsGrid: this.foodsGrid,
        stars: this.stars,
        player: targetPlayer?.snake ?? null,
      });

      if (!bot.dead && Math.hypot(bot.head.x, bot.head.y) > CFG.WR - getSnakeRadiusValue(bot)) this.dieSnake(bot, null);
    }
  }

  updateConsumables() {
    for (const food of this.foods) food.tick();
    for (const star of this.stars) star.tick();
    this.refill();
  }

  checkCollisions() {
    const protectedSnakes = new Set(
      [...this.players.values()]
        .filter((player) => player.spawnProtectionTicks > 0)
        .map((player) => player.snake)
        .filter(Boolean)
    );
    const allSnakes = [...this.players.values()].map((player) => player.snake).concat(this.bots);
    for (const snake of allSnakes) {
      if (!snake || snake.dead) continue;
      if (protectedSnakes.has(snake)) continue;
      const nearbySegments = this.segmentsGrid.near(
        snake.head.x,
        snake.head.y,
        Math.max(CFG.SR * 5, getSnakeRadiusValue(snake) * 5)
      );
      for (const { seg, own } of nearbySegments) {
        if (own === snake) continue;
        if (protectedSnakes.has(own)) continue;
        const hitRadius = getSnakeRadiusValue(snake) + getSnakeRadiusValue(own);
        if (dist(snake.head.x, snake.head.y, seg.x, seg.y) < hitRadius) {
          this.dieSnake(snake, own);
          break;
        }
      }
    }

    for (const bot of this.bots) {
      if (bot.dead) continue;
      for (let i = this.stars.length - 1; i >= 0; i--) {
        const star = this.stars[i];
        if (dist(bot.head.x, bot.head.y, star.x, star.y) < getSnakeRadiusValue(bot) + star.r + 2) {
          bot.grow(star.val);
          bot.speedBuff = CFG.SBUFF_DUR;
          this.removeFood(this.stars, i);
          break;
        }
      }
    }
  }

  tick() {
    this.rebuildGrids();
    this.updatePlayers();
    this.updateBots();
    this.updateConsumables();
    this.checkCollisions();
    this.effects.tick();
  }

  getSnapshotFor(playerId) {
    const playerState = this.players.get(playerId);
    return {
      world: {
        radius: CFG.WR,
        state: this.state,
      },
      selfId: playerId,
      self: getPlayerViewState(playerState),
      snakes: [
        ...[...this.players.values()].map((entry) => serializeSnake(entry.snake, {
          id: entry.id,
          score: entry.score,
          kills: entry.kills,
          respawnTicks: entry.respawnTicks,
        })),
        ...this.bots.map((bot) => serializeSnake(bot, { id: bot.netId })),
      ],
      foods: this.foods.map((food) => serializeFood(food, { id: food.netId })),
      stars: this.stars.map((star) => serializeFood(star, { id: star.netId })),
      leaderboard: [...this.players.values()]
        .map((entry) => ({ id: entry.id, name: entry.name, len: entry.snake?.len ?? 0, score: entry.score }))
        .sort((a, b) => b.len - a.len)
        .slice(0, 8),
    };
  }
}
