import { CFG } from "../config/game-config.js";
import { lerpA, rnd } from "../core/utils.js";
import { SnakeBody } from "./snake-body.js";

export function enrichSkin(skin) {
  const enriched = { ...skin };
  if (enriched.id === "rainbow") {
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
  constructor({ x, y, len, skin, name = "", isPlayer = false, showNameTag, renderContext, spawnFood }) {
    this.name = name;
    this.skin = enrichSkin(skin);
    this.isPlayer = isPlayer;
    this.showNameTag = showNameTag ?? !isPlayer;
    this.spawnFood = spawnFood;
    this.dead = false;
    this.speedBuff = 0;
    this.boosting = false;
    this.angle = rnd(0, Math.PI * 2);
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

  shrink(n = 1) {
    for (let i = 0; i < n && this.segs.length > CFG.MIN_LEN; i++) {
      const tail = this.segs.pop();
      this.spawnFood(tail.x + rnd(-5, 5), tail.y + rnd(-5, 5));
    }
  }

  destroy() {
    if (this.body) this.body.destroy();
  }
}
