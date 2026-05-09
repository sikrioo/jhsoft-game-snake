import { CFG } from "../config/game-config.js";
import { dist, hslHex } from "../core/utils.js";
import { SKINS } from "../config/skins.js";
import { Bot } from "../entities/bot.js";
import { Gate } from "../entities/gate.js";
import { LocalSimulation } from "./local-simulation.js";

const TICK_RATE = 60;
const WAVE_TICKS = CFG.SURVIVAL_WAVE_SEC * TICK_RATE;
const TOTAL_TICKS = CFG.SURVIVAL_TOTAL_SEC * TICK_RATE;
const GATE_WARNING_TICKS = Math.round(CFG.SURVIVAL_GATE_WARNING_SEC * TICK_RATE);
const CENTER_WARNING_TICKS = Math.round(CFG.SURVIVAL_CENTER_WARNING_SEC * TICK_RATE);
const SURVIVAL_WORLD_RADIUS = CFG.WR * 0.5;
const SPAWN_PROTECTION_TICKS = 84;
const PLAYER_ZOMBIE_HIT_COOLDOWN_TICKS = 24;
const PLAYER_ZOMBIE_HIT_SHRINK = 2;
const SURVIVAL_FOOD_TARGET = Math.max(96, Math.floor((CFG.FOOD_N / 4) * 0.8));
const SURVIVAL_STAR_TARGET = Math.max(3, Math.floor(CFG.STAR_N / 4));
const ZOMBIE_SKIN = SKINS.find((skin) => skin.id === "zombie") || SKINS[0];
const INTRO_ZOMBIE_TYPES = ["basic", "fast", "long", "elite"];

const GATE_DEFS = [
  { id: "north", x: 0, y: -1, kind: "warn", label: "NORTH GATE OPENED" },
  { id: "south", x: 0, y: 1, kind: "warn", label: "SOUTH GATE OPENED" },
  { id: "east", x: 1, y: 0, kind: "warn", label: "EAST GATE OPENED" },
  { id: "west", x: -1, y: 0, kind: "warn", label: "WEST GATE OPENED" },
  { id: "center", x: 0, y: 0, kind: "danger", isCenter: true, label: "CENTER RIFT OPENED" },
];

const WAVE_GATES = [
  ["north", "south", "east", "west"],
  ["north", "south", "east", "west", "center"],
  ["north", "south", "east", "west", "center"],
  ["north", "south", "east", "west", "center"],
  ["north", "south", "east", "west", "center"],
];

const BOT_PROFILES = {
  basic: {
    type: "basic",
    moveScale: 1.04,
    boostScale: 1.03,
    turnRate: 0.084,
    thinkMin: 7,
    thinkMax: 14,
    chaseRange: 1400,
    chaseBoostRange: 300,
    foodRange: 140,
    starChance: 0.01,
    aggressionBias: 0.18,
    randomBoostChance: 0.08,
    minBoostLen: CFG.MIN_LEN + 6,
    targetPlayerBias: 2.3,
    interceptFactor: 1.8,
    prioritizePlayer: true,
    suppressBoostDrops: true,
    allyAvoidRange: 90,
    allyAvoidWeight: 1.3,
    chaseJitter: 0.2,
  },
  fast: {
    type: "fast",
    moveScale: 1.26,
    boostScale: 1.18,
    turnRate: 0.102,
    thinkMin: 6,
    thinkMax: 12,
    chaseRange: 1650,
    chaseBoostRange: 360,
    foodRange: 120,
    starChance: 0.005,
    aggressionBias: 0.08,
    randomBoostChance: 0.15,
    minBoostLen: CFG.MIN_LEN + 5,
    targetPlayerBias: 2.5,
    interceptFactor: 2.4,
    prioritizePlayer: true,
    suppressBoostDrops: true,
    allyAvoidRange: 96,
    allyAvoidWeight: 1.5,
    chaseJitter: 0.24,
  },
  long: {
    type: "long",
    moveScale: 0.98,
    boostScale: 1.04,
    turnRate: 0.07,
    thinkMin: 7,
    thinkMax: 14,
    chaseRange: 1550,
    chaseBoostRange: 300,
    foodRange: 120,
    starChance: 0,
    aggressionBias: 0.16,
    randomBoostChance: 0.07,
    minBoostLen: CFG.MIN_LEN + 12,
    targetPlayerBias: 2.4,
    interceptFactor: 2.6,
    prioritizePlayer: true,
    suppressBoostDrops: true,
    allyAvoidRange: 120,
    allyAvoidWeight: 1.8,
    chaseJitter: 0.16,
  },
  elite: {
    type: "elite",
    moveScale: 1.32,
    boostScale: 1.24,
    turnRate: 0.108,
    thinkMin: 5,
    thinkMax: 10,
    chaseRange: 1900,
    chaseBoostRange: 420,
    foodRange: 100,
    starChance: 0,
    aggressionBias: 0.02,
    randomBoostChance: 0.18,
    minBoostLen: CFG.MIN_LEN + 8,
    targetPlayerBias: 2.8,
    interceptFactor: 2.8,
    prioritizePlayer: true,
    suppressBoostDrops: true,
    allyAvoidRange: 110,
    allyAvoidWeight: 1.7,
    chaseJitter: 0.2,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rollInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function getSnakeRadiusValue(snake) {
  return snake?.radius ?? CFG.SR;
}

function formatGatePosition(def) {
  const radius = SURVIVAL_WORLD_RADIUS * 0.86;
  if (def.isCenter) return { x: 0, y: 0 };
  return { x: def.x * radius, y: def.y * radius };
}

export class SurvivalSimulation extends LocalSimulation {
  constructor(options) {
    super(options);
    this.events = {
      onFlash: () => {},
      onSpeedBuff: () => {},
      onKillFeed: () => {},
      onBanner: () => {},
      onShake: () => {},
      onImpact: () => {},
      ...this.events,
    };
    this.gates = [];
    this.elapsedTicks = 0;
    this.wave = 1;
    this.result = null;
    this.centerIntroShown = false;
    this.pendingIntroZombieTypes = [...INTRO_ZOMBIE_TYPES];
    this.playerHitCooldownTicks = 0;
  }

  destroyGates() {
    for (const gate of this.gates) gate.entity?.destroy();
    this.gates = [];
  }

  createGates() {
    this.destroyGates();
    this.gates = GATE_DEFS.map((def, index) => {
      const pos = formatGatePosition(def);
      return {
        ...def,
        ...pos,
        index,
        active: false,
        state: "idle",
        countdownTicks: 999999,
        spawnFlashTicks: 0,
        warmupTicks: 0,
        wasWarning: false,
        entity: new Gate({
          id: def.id,
          x: pos.x,
          y: pos.y,
          isCenter: Boolean(def.isCenter),
          renderContext: this.renderContext,
        }),
      };
    });
  }

  startNewRun() {
    super.startNewRun();
    for (const bot of this.bots) bot.destroy();
    this.bots = [];
    this.destroyGates();
    this.createGates();
    this.elapsedTicks = 0;
    this.wave = 1;
    this.result = null;
    this.centerIntroShown = false;
    this.pendingIntroZombieTypes = [...INTRO_ZOMBIE_TYPES];
    this.events.onBanner("WAVE 1 START · NORTH GATE OPENED", "warn", 2200);
    this.applyWaveConfig(1, false);
    this.spawnIntroZombieSet();
  }

  getSpawnIntervalTicks() {
    return Math.round(Math.max(1.35, 2.4 - (this.wave - 1) * 0.18) * TICK_RATE);
  }

  getWaveBotCap() {
    return [12, 20, 30, 42, 56][this.wave - 1] ?? 56;
  }

  getGateSpawnBurst() {
    return [5, 7, 9, 11, 13][this.wave - 1] ?? 13;
  }

  getLivingBotCount() {
    return this.bots.filter((bot) => !bot.dead).length;
  }

  getWaveTimeLeftTicks() {
    return WAVE_TICKS - (this.elapsedTicks % WAVE_TICKS || 0);
  }

  getWorldRadius() {
    return SURVIVAL_WORLD_RADIUS;
  }

  getTotalTimeLeftTicks() {
    return Math.max(0, TOTAL_TICKS - this.elapsedTicks);
  }

  refill() {
    while (this.foods.length < SURVIVAL_FOOD_TARGET) this.spawnFood();
    while (this.stars.length < SURVIVAL_STAR_TARGET) this.spawnStar();
  }

  spawnDeathFoodTrail(snake) {
    if (snake.skin?.id === "zombie") {
      const dropCount = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < dropCount; i++) {
        const segIndex = Math.floor((i / Math.max(1, dropCount - 1)) * (snake.segs.length - 1));
        const seg = snake.segs[segIndex];
        this.spawnFood(seg.x + (Math.random() * 10 - 5), seg.y + (Math.random() * 10 - 5), {
          ignoreSoftCap: true,
          value: 1,
          radius: 2.9,
        });
      }
      return;
    }
    super.spawnDeathFoodTrail(snake);
  }

  applyWaveConfig(wave, announce = true) {
    this.wave = wave;
    const activeIds = new Set(WAVE_GATES[wave - 1]);
    const interval = this.getSpawnIntervalTicks();
    const activeList = this.gates.filter((gate) => activeIds.has(gate.id));

    for (const gate of this.gates) {
      gate.active = activeIds.has(gate.id);
      if (!gate.active) {
        gate.state = "idle";
        continue;
      }

      if (gate.id === "center" && !this.centerIntroShown) {
        gate.warmupTicks = CENTER_WARNING_TICKS;
        gate.countdownTicks = interval;
        gate.state = "warning";
        this.centerIntroShown = true;
        this.events.onBanner("WARNING · CENTER RIFT CHARGING", "danger", 2200);
        this.events.onFlash("rgba(255,60,90,0.18)");
        this.events.onShake(18, 0.85);
        continue;
      }

      gate.countdownTicks = interval + Math.round((interval / Math.max(1, activeList.length)) * gate.index);
      gate.spawnFlashTicks = 0;
      gate.wasWarning = false;
      gate.state = "idle";
    }

    if (announce && wave > 1) {
      const newestGate = WAVE_GATES[wave - 1][WAVE_GATES[wave - 1].length - 1];
      const label = GATE_DEFS.find((gate) => gate.id === newestGate)?.label || "GATE OPENED";
      this.events.onBanner(`WAVE ${wave} START · ${label}`, newestGate === "center" ? "danger" : "warn", 2400);
    }
  }

  buildBotSpec(type, intro = false) {
    const ranges = intro
      ? {
          basic: [20, 24],
          fast: [18, 22],
          long: [34, 42],
          elite: [28, 34],
        }
      : {
          basic: [20, 31],
          fast: [18, 27],
          long: [54, 69],
          elite: [68, 68],
        };
    const [minLen, maxLen] = ranges[type] || ranges.basic;
    return {
      profile: BOT_PROFILES[type] || BOT_PROFILES.basic,
      len: rollInt(minLen, maxLen),
    };
  }

  pickBotSpec() {
    if (this.pendingIntroZombieTypes.length > 0) {
      return this.buildBotSpec(this.pendingIntroZombieTypes.shift(), true);
    }
    if (this.wave >= 5 && Math.random() < 0.22) return this.buildBotSpec("elite");
    if (this.wave >= 3 && Math.random() < 0.35) return this.buildBotSpec("long");
    if (this.wave >= 2 && Math.random() < 0.4) return this.buildBotSpec("fast");
    return this.buildBotSpec("basic");
  }

  spawnIntroZombieSet() {
    for (const gate of this.gates) {
      if (!gate.active || gate.isCenter) continue;
      if (this.pendingIntroZombieTypes.length <= 0) break;
      this.spawnGateBot(gate, 0, 1);
    }
  }

  spawnGateBot(gate, slotIndex = 0, totalSlots = 1) {
    if (this.getLivingBotCount() >= this.getWaveBotCap()) return false;
    if (this.player && !this.player.dead) {
      const safeDistance = SURVIVAL_WORLD_RADIUS * 0.22;
      const playerDist = Math.hypot(this.player.head.x - gate.x, this.player.head.y - gate.y);
      if (playerDist < safeDistance) return false;
    }

    const spec = this.pickBotSpec();
    const towardX = gate.id === "center" ? (this.player?.head.x ?? 0) - gate.x : -gate.x;
    const towardY = gate.id === "center" ? (this.player?.head.y ?? 0) - gate.y : -gate.y;
    const baseAngle = Math.atan2(towardY, towardX);
    const spreadT = totalSlots <= 1 ? 0 : slotIndex / (totalSlots - 1) - 0.5;
    const fanAngle = spreadT * (gate.isCenter ? 0.9 : 0.55);
    const angle = baseAngle + fanAngle;
    const spawnOffset = (gate.isCenter ? 26 : 36) + Math.abs(spreadT) * 10;
    const lateralAngle = angle + Math.PI / 2;
    const lateralSpread = spreadT * (gate.isCenter ? 150 : 120);
    const x = gate.x + Math.cos(angle) * spawnOffset + Math.cos(lateralAngle) * lateralSpread;
    const y = gate.y + Math.sin(angle) * spawnOffset + Math.sin(lateralAngle) * lateralSpread;

    const bot = new Bot({
      x,
      y,
      len: spec.len,
      angle,
      skin: ZOMBIE_SKIN,
      profile: spec.profile,
      renderContext: this.renderContext,
      spawnFood: (fx, fy, options) => this.spawnFood(fx, fy, options),
    });
    bot.spawnProtectionTicks = SPAWN_PROTECTION_TICKS;
    this.bots.push(bot);

    if (gate.isCenter) {
      this.events.onFlash("rgba(255,60,90,0.15)");
      this.events.onShake(10, 0.6);
    }

    return true;
  }

  spawnGateBurst(gate) {
    let spawned = 0;
    const burst = this.getGateSpawnBurst();
    for (let i = 0; i < burst; i++) {
      if (!this.spawnGateBot(gate, i, burst)) break;
      spawned++;
    }
    return spawned;
  }

  updateGates() {
    const warningTicks = GATE_WARNING_TICKS;
    for (const gate of this.gates) {
      if (!gate.active) {
        gate.entity?.update(gate);
        continue;
      }

      if (gate.spawnFlashTicks > 0) {
        gate.spawnFlashTicks--;
        gate.state = "spawn";
        gate.entity?.update(gate);
        continue;
      }

      if (gate.warmupTicks > 0) {
        gate.warmupTicks--;
        gate.state = "warning";
        gate.entity?.update(gate);
        continue;
      }

      gate.countdownTicks--;
      const isWarning = gate.countdownTicks <= warningTicks;
      gate.state = isWarning ? "warning" : "idle";

      if (isWarning && !gate.wasWarning && gate.isCenter) {
        this.events.onBanner("CENTER RIFT UNSTABLE", "danger", 1100);
      }
      gate.wasWarning = isWarning;

      if (gate.countdownTicks <= 0) {
        if (this.spawnGateBurst(gate) > 0) {
          gate.spawnFlashTicks = 12;
          gate.countdownTicks = this.getSpawnIntervalTicks();
          gate.state = "spawn";
        } else {
          gate.countdownTicks = 24;
        }
      }

      gate.entity?.update(gate);
    }
  }

  die(snake, killer) {
    if (snake === this.player) {
      super.die(snake, killer);
      this.result = {
        type: "gameover",
        survivedTicks: this.elapsedTicks,
        wave: this.wave,
      };
      return;
    }

    if (snake.dead) return;
    const headOn = this.isHeadOnCollision(snake, killer);
    const impactTicks = headOn ? 5 : 3;
    const impactPower = headOn ? 0.4 : 0.22;
    snake.dead = true;
    snake.boosting = false;
    snake.cleanupTicks = 22;
    if (snake.body?.setVisible) snake.body.setVisible(false);
    const isZombie = snake.skin?.id === "zombie";
    if (isZombie) {
      this.effects.spawnDeathFragments(snake, {
        foodDropChance: 0,
        strideMultiplier: 2,
        speedMin: 4.2,
        speedMax: 10.4,
        drag: 0.908,
        lifeMin: 12,
        lifeMax: 20,
        scaleMin: 0.92,
        scaleMax: 1.35,
        spinMin: -0.18,
        spinMax: 0.18,
        tintSat: 78,
        tintLight: 52,
      });
      this.effects.zombieCollisionBurst(snake.head.x, snake.head.y, hslHex(snake.skin.hue, 100, 62));
      this.events.onShake(headOn ? 10 : 6, headOn ? 0.42 : 0.26);
      this.events.onFlash(headOn ? "rgba(255,242,198,0.16)" : "rgba(167,255,93,0.09)");
    } else {
      this.effects.spawnDeathFragments(snake, {
        foodDropChance: 0.7,
      });
      this.effects.burst(snake.head.x, snake.head.y, hslHex(snake.skin.hue, 100, 62), 18, 5, 12, 4.2);
    }
    this.events.onImpact(impactTicks);
    if (!isZombie) this.events.onShake(impactTicks + 1, impactPower);
    if (headOn && killer?.head) {
      const midX = (snake.head.x + killer.head.x) / 2;
      const midY = (snake.head.y + killer.head.y) / 2;
      if (isZombie) {
        this.effects.zombieCollisionBurst(midX, midY, hslHex(snake.skin.hue, 100, 68));
        this.effects.shardBurst(killer.head.x, killer.head.y, 0xfff1c2, 5, 6.8, 10, 4.2);
      } else {
        this.effects.collisionBurst(midX, midY, hslHex(snake.skin.hue, 100, 68));
        this.effects.collisionBurst(snake.head.x, snake.head.y, 0xd9ff9b);
        this.effects.collisionBurst(killer.head.x, killer.head.y, 0xd9ff9b);
      }
    }
    this.spawnDeathFoodTrail(snake);

    const killedByPlayer = killer === this.player;
    if (killedByPlayer) this.kills++;
    this.events.onKillFeed(killedByPlayer ? "YOU" : (killer?.name || "RIFT"), snake.name, killedByPlayer ? "pk" : "normal");
  }

  damagePlayerByZombie(zombie, impactSeg = null) {
    const hitPoint = impactSeg || this.player.segs[Math.min(2, this.player.segs.length - 1)] || this.player.head;
    if (!this.player || this.player.dead) {
      if (zombie && !zombie.dead) this.die(zombie, this.player);
      return;
    }

    if (zombie && !zombie.dead) this.die(zombie, this.player);
    if (this.playerHitCooldownTicks > 0) {
      this.player.hitFlashTicks = Math.max(this.player.hitFlashTicks ?? 0, 6);
      this.effects.burst(hitPoint.x, hitPoint.y, 0xff6a6a, 3, 1.8, 7, 1.9);
      return;
    }

    this.player.hitFlashTicks = 10;

    if (this.player.len <= CFG.MIN_LEN + PLAYER_ZOMBIE_HIT_SHRINK - 1) {
      this.die(this.player, zombie);
      return;
    }

    const lostSegments = this.player.segs.slice(-PLAYER_ZOMBIE_HIT_SHRINK);
    this.player.shrink(PLAYER_ZOMBIE_HIT_SHRINK, { skipDrop: true });
    this.boostE = Math.max(0, this.boostE - 10);
    this.playerHitCooldownTicks = PLAYER_ZOMBIE_HIT_COOLDOWN_TICKS;
    this.events.onFlash("rgba(255,88,88,0.18)");
    this.events.onShake(7, 0.32);
    this.events.onImpact(3);

    this.effects.burst(hitPoint.x, hitPoint.y, 0xfff1c2, 5, 2.4, 8, 2.4);
    this.effects.burst(hitPoint.x, hitPoint.y, 0xff6a6a, 4, 2.1, 9, 2.1);

    for (const seg of lostSegments) {
      this.effects.burst(seg.x, seg.y, 0xff8c7a, 2, 2.8, 10, 2.6);
    }
  }

  checkCollisions() {
    const all = [this.player, ...this.bots];
    for (const snake of all) {
      if (!snake || snake.dead) continue;
      if (snake.spawnProtectionTicks > 0) continue;
    const nearbySegments = this.segmentsGrid.near(
      snake.head.x,
      snake.head.y,
      Math.max(CFG.SR * 5, getSnakeRadiusValue(snake) * 5)
    );
      for (const { seg, own } of nearbySegments) {
        if (own === snake) continue;
        if (own?.spawnProtectionTicks > 0) continue;
        const playerHitsZombieBody = snake === this.player && own?.skin?.id === "zombie";
        if (playerHitsZombieBody) {
          const hitRadius = getSnakeRadiusValue(snake) + getSnakeRadiusValue(own);
          if (dist(snake.head.x, snake.head.y, seg.x, seg.y) < hitRadius) {
            this.die(this.player, own);
            break;
          }
          continue;
        }

        const zombieHitsPlayerBody = own === this.player && snake.skin?.id === "zombie";
        if (zombieHitsPlayerBody) {
          const hitRadius = getSnakeRadiusValue(snake) + getSnakeRadiusValue(own);
          if (dist(snake.head.x, snake.head.y, seg.x, seg.y) < hitRadius) {
            this.damagePlayerByZombie(snake, seg);
            break;
          }
          continue;
        }
        if (snake.skin?.id === "zombie" && own?.skin?.id === "zombie") continue;
        const hitRadius = getSnakeRadiusValue(snake) + getSnakeRadiusValue(own);
        if (dist(snake.head.x, snake.head.y, seg.x, seg.y) < hitRadius) {
          this.die(snake, own);
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

  updateBots() {
    if (this.playerHitCooldownTicks > 0) this.playerHitCooldownTicks--;
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i];
      if (bot.dead) {
        bot.cleanupTicks = (bot.cleanupTicks ?? 0) - 1;
        if (bot.cleanupTicks <= 0) {
          bot.destroy();
          this.bots.splice(i, 1);
        }
        continue;
      }

      if (bot.spawnProtectionTicks > 0) bot.spawnProtectionTicks--;
      bot.update({
        foodsGrid: this.foodsGrid,
        stars: this.stars,
        player: this.player,
        bots: this.bots,
        worldRadius: SURVIVAL_WORLD_RADIUS,
      });
      if (!bot.dead && Math.hypot(bot.head.x, bot.head.y) > SURVIVAL_WORLD_RADIUS - getSnakeRadiusValue(bot)) this.die(bot, { name: "WALL" });
    }
  }

  updateSurvivalClock() {
    if (this.state !== "playing") return;
    this.elapsedTicks++;
    const nextWave = clamp(Math.floor(this.elapsedTicks / WAVE_TICKS) + 1, 1, 5);
    if (nextWave !== this.wave && this.elapsedTicks < TOTAL_TICKS) this.applyWaveConfig(nextWave, true);

    if (this.elapsedTicks >= TOTAL_TICKS) {
      this.state = "complete";
      this.result = {
        type: "complete",
        survivedTicks: TOTAL_TICKS,
        wave: 5,
      };
      this.events.onBanner("SURVIVAL COMPLETE · ALL WAVES CLEARED", "warn", 2800);
    }
  }

  tick(playerCommand) {
    if (this.state === "dead" || this.state === "complete") return;
    super.tick(playerCommand);
    if (this.state === "playing") {
      this.updateSurvivalClock();
      this.updateGates();
    } else {
      for (const gate of this.gates) gate.entity?.update(gate);
    }
  }
}
