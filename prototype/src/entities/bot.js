import { CFG } from "../config/game-config.js";
import { SKINS } from "../config/skins.js";
import { dist, rnd, rndI } from "../core/utils.js";
import { Snake } from "./snake.js";

const DEFAULT_PROFILE = {
  type: "basic",
  moveScale: 1,
  boostScale: 1,
  turnRate: 0.07,
  thinkMin: 12,
  thinkMax: 28,
  starChance: 0.28,
  chaseRange: 380,
  chaseBoostRange: 180,
  foodRange: 300,
  aggressionBias: 0.58,
  wander: 0.6,
  randomBoostChance: 0.08,
  minBoostLen: CFG.MIN_LEN + 8,
  targetPlayerBias: 1,
  interceptFactor: 0,
  prioritizePlayer: false,
  suppressBoostDrops: false,
  allyAvoidRange: 0,
  allyAvoidWeight: 0,
  chaseJitter: 0,
  wallMarginRatio: 0.06,
};

export class Bot extends Snake {
  constructor({ renderContext, spawnFood, x, y, len, skin, name, angle, profile = {} }) {
    const initialLen = len ?? rndI(18, 52);
    const spawnAngle = angle ?? Math.random() * Math.PI * 2;
    const gap = CFG.SR * 2 + CFG.SEG_GAP;
    const minDistance = Math.min(CFG.WR * 0.72, Math.max(540, initialLen * gap + 260));
    const distance = rnd(minDistance, CFG.WR * 0.75);
    const px = x ?? Math.cos(spawnAngle) * distance;
    const py = y ?? Math.sin(spawnAngle) * distance;
    super({
      x: px,
      y: py,
      len: initialLen,
      skin: skin ?? SKINS[rndI(0, SKINS.length)],
      name: name ?? CFG.BOT_NAMES[rndI(0, CFG.BOT_NAMES.length)],
      isPlayer: false,
      renderContext,
      spawnFood,
      angle: spawnAngle,
    });
    this.profile = { ...DEFAULT_PROFILE, ...profile };
    this.ta = this.angle;
    this.thinkT = 0;
    this.pers = Math.random();
    this.botType = this.profile.type;
  }

  get effSpeed() {
    if (this.boosting) return CFG.BST_SPD * this.profile.boostScale;
    if (this.speedBuff > 0) return CFG.SBUFF_SPD * this.profile.moveScale;
    return CFG.SPD * this.profile.moveScale;
  }

  think(context) {
    if (--this.thinkT > 0) return;
    this.thinkT = rndI(this.profile.thinkMin, this.profile.thinkMax + 1);

    const { x, y } = this.head;
    const { foodsGrid, stars, player, bots = [], worldRadius = CFG.WR } = context;
    let avoidVX = 0;
    let avoidVY = 0;
    let avoidCount = 0;

    if (this.profile.allyAvoidRange > 0) {
      const avoidRange = this.profile.allyAvoidRange;
      const avoidRangeSq = avoidRange * avoidRange;
      for (const ally of bots) {
        if (!ally || ally === this || ally.dead) continue;
        const dx = x - ally.head.x;
        const dy = y - ally.head.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= 1 || dSq > avoidRangeSq) continue;
        const d = Math.sqrt(dSq);
        const strength = (1 - d / avoidRange) * this.profile.allyAvoidWeight;
        avoidVX += (dx / d) * strength;
        avoidVY += (dy / d) * strength;
        avoidCount++;
      }
    }

    const wallMargin = Math.max(120, worldRadius * this.profile.wallMarginRatio);
    if (Math.hypot(x, y) > worldRadius - wallMargin) {
      this.ta = Math.atan2(-y, -x);
      this.boosting = false;
      return;
    }

    const playerClose = Boolean(
      player && !player.dead && dist(x, y, player.head.x, player.head.y) < this.profile.chaseBoostRange
    );

    if (!playerClose && stars.length && Math.random() < this.profile.starChance) {
      let best = null;
      let bestDist = 1e9;
      for (const star of stars) {
        const d = dist(x, y, star.x, star.y);
        if (d < bestDist) {
          bestDist = d;
          best = star;
        }
      }
      if (best && bestDist < this.profile.chaseRange) {
        this.ta = Math.atan2(best.y - y, best.x - x);
        return;
      }
    }

    if (player && !player.dead && (this.profile.prioritizePlayer || this.pers > this.profile.aggressionBias)) {
      const d = dist(x, y, player.head.x, player.head.y);
      const chaseRange = this.profile.chaseRange * this.profile.targetPlayerBias;
      if (d < chaseRange) {
        const leadSeg = player.segs?.[1] || player.head;
        const vx = player.head.x - leadSeg.x;
        const vy = player.head.y - leadSeg.y;
        const interceptScale = Math.min(this.profile.interceptFactor, d / 200);
        const targetX = player.head.x + vx * interceptScale;
        const targetY = player.head.y + vy * interceptScale;
        const avoidStrength = Math.min(1, Math.hypot(avoidVX, avoidVY));
        const avoidAngle = avoidCount > 0 ? Math.atan2(avoidVY, avoidVX) : 0;
        const blendedAvoidX = Math.cos(avoidAngle) * avoidStrength * 60;
        const blendedAvoidY = Math.sin(avoidAngle) * avoidStrength * 60;
        const jitter = this.profile.chaseJitter > 0 ? rnd(-this.profile.chaseJitter, this.profile.chaseJitter) : 0;
        this.ta = Math.atan2(targetY - y + blendedAvoidY, targetX - x + blendedAvoidX) + jitter;
        this.boosting = d < this.profile.chaseBoostRange && this.len > this.profile.minBoostLen;
        return;
      }
    }

    const nearbyFood = foodsGrid.near(x, y, this.profile.foodRange);
    let bestFood = null;
    let bestFoodDist = 1e9;
    for (const food of nearbyFood) {
      const d = dist(x, y, food.x, food.y);
      if (d < bestFoodDist) {
        bestFoodDist = d;
        bestFood = food;
      }
    }

    const avoidStrength = Math.min(1, Math.hypot(avoidVX, avoidVY));
    const avoidAngle = avoidCount > 0 ? Math.atan2(avoidVY, avoidVX) : 0;
    const blendedAvoidX = Math.cos(avoidAngle) * avoidStrength * 60;
    const blendedAvoidY = Math.sin(avoidAngle) * avoidStrength * 60;

    if (bestFood) this.ta = Math.atan2(bestFood.y - y + blendedAvoidY, bestFood.x - x + blendedAvoidX);
    else if (avoidCount > 0) this.ta = avoidAngle;
    else this.ta += rnd(-this.profile.wander, this.profile.wander);

    this.boosting = this.len > this.profile.minBoostLen && Math.random() < this.profile.randomBoostChance;
  }

  update(context) {
    if (this.dead) return;
    this.think(context);
    this.steer(this.ta, this.profile.turnRate + this.pers * 0.04);
    if (this.boosting) {
      if (this.profile.suppressBoostDrops) {
        this.compactDropCarry = 0;
      } else {
        this.shrink(1, { compactDrops: true });
      }
    } else if (!this.profile.suppressBoostDrops) {
      this.flushCompactDropCarry();
    }
    this.move();
  }
}
