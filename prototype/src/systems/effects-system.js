import { hslHex, rnd, rndI } from "../core/utils.js";

class Particle {
  constructor({ x, y, color, vx, vy, life, radius, layerFX, textures }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.sp = layerFX && textures && typeof PIXI !== "undefined"
      ? new PIXI.Sprite(textures.getCircleTex(color, Math.max(2, radius | 0), 0.12))
      : null;
    if (this.sp) {
      this.sp.anchor.set(0.5);
      this.sp.tint = color;
      layerFX.addChild(this.sp);
    }
  }

  tick() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.92;
    this.vy *= 0.92;
    const t = --this.life / this.maxLife;
    if (this.sp) {
      this.sp.position.set(this.x, this.y);
      this.sp.scale.set(Math.max(0.05, t));
      this.sp.alpha = t * t;
    }
    return this.life > 0;
  }

  destroy() {
    if (this.sp) this.sp.destroy();
  }
}

class DeathFrag {
  constructor({ x, y, hue, layerFX, textures, spawnFood }) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rnd(2, 7);
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rndI(15, 27);
    this.maxLife = this.life;
    this.foodDropped = false;
    this.spawnFood = spawnFood;
    this.sp = layerFX && textures && typeof PIXI !== "undefined"
      ? new PIXI.Sprite(textures.getSegTex(rndI(4, 10)))
      : null;
    if (this.sp) {
      this.sp.anchor.set(0.5);
      this.sp.tint = hslHex(hue, 85, 58);
      layerFX.addChild(this.sp);
    }
  }

  tick() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.955;
    this.vy *= 0.955;
    const t = --this.life / this.maxLife;

    if (!this.foodDropped && t < 0.45) {
      this.foodDropped = true;
      if (Math.random() < 0.7) this.spawnFood(this.x + rnd(-5, 5), this.y + rnd(-5, 5));
    }

    if (this.sp) {
      this.sp.position.set(this.x, this.y);
      this.sp.scale.set(Math.max(0.05, t * 1.1));
      this.sp.alpha = Math.min(1, t * 1.4);
    }
    return this.life > 0;
  }

  destroy() {
    if (this.sp) this.sp.destroy();
  }
}

export class EffectsSystem {
  constructor({ layerFX, textures, spawnFood }) {
    this.layerFX = layerFX;
    this.textures = textures;
    this.spawnFood = spawnFood;
    this.parts = [];
    this.frags = [];
  }

  burst(x, y, color, count = 14, speed = 4, life = 38, radius = 4) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rnd(0, 0.5);
      const velocity = speed * (0.5 + Math.random());
      this.parts.push(new Particle({
        x,
        y,
        color,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        radius,
        layerFX: this.layerFX,
        textures: this.textures,
      }));
    }
  }

  spark(x, y, angle, color) {
    const spread = angle + Math.PI + rnd(-0.75, 0.75);
    const speed = rnd(2, 5);
    this.parts.push(new Particle({
      x,
      y,
      color,
      vx: Math.cos(spread) * speed,
      vy: Math.sin(spread) * speed,
      life: rndI(10, 22),
      radius: rnd(1.5, 3),
      layerFX: this.layerFX,
      textures: this.textures,
    }));
  }

  starBurst(x, y) {
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + rnd(0, 0.3);
      const speed = rnd(2, 6);
      this.parts.push(new Particle({
        x,
        y,
        color: 0xffd060,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rndI(30, 60),
        radius: rnd(2, 5),
        layerFX: this.layerFX,
        textures: this.textures,
      }));
    }
  }

  spawnDeathFragments(snake) {
    const stride = snake.segs.length > 120 ? 3 : snake.segs.length > 60 ? 2 : 1;
    for (let i = 0; i < snake.segs.length; i += stride) {
      this.frags.push(new DeathFrag({
        x: snake.segs[i].x,
        y: snake.segs[i].y,
        hue: snake.skin.hue,
        layerFX: this.layerFX,
        textures: this.textures,
        spawnFood: this.spawnFood,
      }));
    }
  }

  tick() {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      if (!this.parts[i].tick()) {
        this.parts[i].destroy();
        this.parts.splice(i, 1);
      }
    }

    for (let i = this.frags.length - 1; i >= 0; i--) {
      if (!this.frags[i].tick()) {
        this.frags[i].destroy();
        this.frags.splice(i, 1);
      }
    }
  }

  clear() {
    for (const particle of this.parts) particle.destroy();
    for (const frag of this.frags) frag.destroy();
    this.parts.length = 0;
    this.frags.length = 0;
  }
}
