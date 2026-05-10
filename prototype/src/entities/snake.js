import { CFG } from "../config/game-config.js";
import { lerpA, rnd } from "../core/utils.js";
import { SnakeBody } from "./snake-body.js";

export function getSnakeSizeScale(length) {
  const excessLen = Math.max(0, length - CFG.MIN_LEN);
  return 1 + Math.min(0.58, Math.sqrt(excessLen) * 0.055);
}

export function getSnakeRadius(length) {
  return CFG.SR * getSnakeSizeScale(length);
}

export function enrichSkin(skin) {
  const enriched = { ...skin };
  if (enriched.id === "worm") {
    enriched.pattern = "worm";
  } else if (enriched.id === "rainbow") {
    enriched.pattern = "rainbow";
    enriched.mood = "smile";
  } else if (enriched.id === "zebra") {
    enriched.pattern = "zebra";
  } else if (enriched.id === "lava") {
    enriched.pattern = "lava";
    enriched.mood = "angry";
  } else if (enriched.id === "ghost") {
    enriched.pattern = "ghost";
    enriched.mood = "smile";
  } else if (enriched.id === "zombie") {
    enriched.pattern = "zombie";
    enriched.mood = "angry";
  } else if (enriched.id === "viper") {
    enriched.mood = "angry";
  } else if (enriched.id === "jade") {
    enriched.mood = "smile";
  } else if (enriched.id === "rage") {
    enriched.mood = "angry";
  }
  return enriched;
}

export class Snake {
  constructor({ x, y, len, skin, name = "", isPlayer = false, showNameTag, renderContext, spawnFood, angle }) {
    this.name = name;
    this.skin = enrichSkin(skin);
    this.isPlayer = isPlayer;
    this.showNameTag = showNameTag ?? !isPlayer;
    this.spawnFood = spawnFood;
    this.dead = false;
    this.speedBuff = 0;
    this.boosting = false;
    this.hitFlashTicks = 0;
    this.compactDropCarry = 0;
    this.angle = angle ?? rnd(0, Math.PI * 2);
    this.segs = [];

    const gap = CFG.SR * 2 + CFG.SEG_GAP;
    for (let i = 0; i < len; i++) {
      this.segs.push({ x: x - Math.cos(this.angle) * gap * i, y: y - Math.sin(this.angle) * gap * i });
    }

    this.body = renderContext ? new SnakeBody(this, renderContext) : { update() {}, destroy() {} };
  }

  get head() {
    return this.segs[0];
  }

  get len() {
    return this.segs.length;
  }

  get sizeScale() {
    return getSnakeSizeScale(this.len);
  }

  get radius() {
    return getSnakeRadius(this.len);
  }

  get effSpeed() {
    if (this.boosting) return CFG.BST_SPD;
    if (this.speedBuff > 0) return CFG.SBUFF_SPD;
    return CFG.SPD;
  }

  steer(targetAngle, rate) {
    this.angle = lerpA(this.angle, targetAngle, rate);
  }

  move() {
    this.segs.unshift({
      x: this.head.x + Math.cos(this.angle) * this.effSpeed,
      y: this.head.y + Math.sin(this.angle) * this.effSpeed,
    });
    this.segs.pop();
    if (this.speedBuff > 0) this.speedBuff--;
  }

  grow(n = 1) {
    const tail = this.segs[this.segs.length - 1];
    for (let i = 0; i < n; i++) this.segs.push({ ...tail });
  }

  flushCompactDropCarry() {
    if (this.compactDropCarry <= 0 || this.segs.length < 1) return;
    const tail = this.segs[this.segs.length - 1];
    const prevTail = this.segs[this.segs.length - 2] || tail;
    const dx = tail.x - prevTail.x;
    const dy = tail.y - prevTail.y;
    const len = Math.hypot(dx, dy) || 1;
    const backX = dx / len;
    const backY = dy / len;
    const dropDistance = CFG.SR * 2.2;
    this.spawnFood(
      tail.x + backX * dropDistance + rnd(-3, 3),
      tail.y + backY * dropDistance + rnd(-3, 3),
      { ignoreSoftCap: true, value: this.compactDropCarry, radius: 3.6 }
    );
    this.compactDropCarry = 0;
  }

  shrink(n = 1, options = {}) {
    for (let i = 0; i < n && this.segs.length > CFG.MIN_LEN; i++) {
      const tail = this.segs.pop();
      if (options.skipDrop) {
        this.compactDropCarry = 0;
        continue;
      }
      const prevTail = this.segs[this.segs.length - 1] || tail;
      const dx = tail.x - prevTail.x;
      const dy = tail.y - prevTail.y;
      const len = Math.hypot(dx, dy) || 1;
      const backX = dx / len;
      const backY = dy / len;
      const dropDistance = CFG.SR * 2.4;

      if (options.compactDrops) {
        this.compactDropCarry += 1;
        if (this.compactDropCarry >= 2) {
          this.spawnFood(
            tail.x + backX * dropDistance + rnd(-3, 3),
            tail.y + backY * dropDistance + rnd(-3, 3),
            { ignoreSoftCap: true, value: 2, radius: 4.1 }
          );
          this.compactDropCarry -= 2;
        }
        continue;
      }

      this.spawnFood(
        tail.x + backX * dropDistance + rnd(-4, 4),
        tail.y + backY * dropDistance + rnd(-4, 4),
        { ignoreSoftCap: true }
      );
    }
  }

  destroy() {
    if (this.body) this.body.destroy();
  }
}
