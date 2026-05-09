import { hslHex, rnd, rndI } from "../core/utils.js";

const MAX_PARTICLES = 180;
const MAX_FRAGMENTS = 120;

class Particle {
  constructor({
    x,
    y,
    color,
    vx,
    vy,
    life,
    radius,
    layerFX,
    textures,
    drag = 0.92,
    scaleFrom = 1,
    scaleTo = 0.05,
    alphaPower = 2,
    texture = "circle",
    glowAlpha = 0.12,
    stretchX = 1,
    stretchY = 1,
    rotation = 0,
    spin = 0,
  }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.drag = drag;
    this.scaleFrom = scaleFrom;
    this.scaleTo = scaleTo;
    this.alphaPower = alphaPower;
    this.spin = spin;
    this.stretchX = stretchX;
    this.stretchY = stretchY;
    this.sp = layerFX && textures && typeof PIXI !== "undefined"
      ? new PIXI.Sprite(
          texture === "seg"
            ? textures.getSegTex(Math.max(2, radius | 0))
            : texture === "shard"
              ? textures.getShardTex(Math.max(2, radius | 0))
              : textures.getCircleTex(color, Math.max(2, radius | 0), glowAlpha)
        )
      : null;
    if (this.sp) {
      this.sp.anchor.set(0.5);
      this.sp.tint = color;
      this.sp.scale.set(stretchX * scaleFrom, stretchY * scaleFrom);
      this.sp.rotation = rotation;
      layerFX.addChild(this.sp);
    }
  }

  tick() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= this.drag;
    this.vy *= this.drag;
    const t = --this.life / this.maxLife;
    if (this.sp) {
      this.sp.position.set(this.x, this.y);
      const scale = this.scaleTo + (this.scaleFrom - this.scaleTo) * Math.max(0, t);
      this.sp.scale.set(
        Math.max(0.05, this.stretchX * scale),
        Math.max(0.05, this.stretchY * scale)
      );
      this.sp.alpha = Math.pow(Math.max(0, t), this.alphaPower);
      this.sp.rotation += this.spin;
    }
    return this.life > 0;
  }

  destroy() {
    if (this.sp) this.sp.destroy();
  }
}

class DeathFrag {
  constructor({
    x,
    y,
    hue,
    layerFX,
    textures,
    spawnFood,
    foodDropChance = 0.7,
    speedMin = 2,
    speedMax = 7,
    drag = 0.955,
    lifeMin = 15,
    lifeMax = 27,
    scaleMin = 0.75,
    scaleMax = 1.15,
    spinMin = -0.12,
    spinMax = 0.12,
    tintSat = 85,
    tintLight = 58,
  }) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rnd(speedMin, speedMax);
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.drag = drag;
    this.life = rndI(lifeMin, lifeMax);
    this.maxLife = this.life;
    this.foodDropped = false;
    this.spawnFood = spawnFood;
    this.foodDropChance = foodDropChance;
    this.spin = rnd(spinMin, spinMax);
    this.sp = layerFX && textures && typeof PIXI !== "undefined"
      ? new PIXI.Sprite(textures.getSegTex(rndI(4, 10)))
      : null;
    if (this.sp) {
      this.sp.anchor.set(0.5);
      this.sp.tint = hslHex(hue, tintSat, tintLight);
      this.sp.rotation = angle;
      const baseScale = rnd(scaleMin, scaleMax);
      this.sp.scale.set(baseScale, baseScale * rnd(0.65, 1.2));
      layerFX.addChild(this.sp);
    }
  }

  tick() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= this.drag;
    this.vy *= this.drag;
    const t = --this.life / this.maxLife;

    if (!this.foodDropped && t < 0.45) {
      this.foodDropped = true;
      if (this.foodDropChance > 0 && Math.random() < this.foodDropChance) {
        this.spawnFood(this.x + rnd(-5, 5), this.y + rnd(-5, 5), { ignoreSoftCap: true });
      }
    }

    if (this.sp) {
      this.sp.position.set(this.x, this.y);
      this.sp.rotation += this.spin;
      this.sp.scale.set(Math.max(0.05, t * 1.18), Math.max(0.05, t * 0.92));
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

  trimEffects(list, maxCount) {
    while (list.length >= maxCount) {
      const effect = list.shift();
      effect?.destroy?.();
    }
  }

  addParticle(particle) {
    this.trimEffects(this.parts, MAX_PARTICLES);
    this.parts.push(particle);
  }

  addFragment(fragment) {
    this.trimEffects(this.frags, MAX_FRAGMENTS);
    this.frags.push(fragment);
  }

  burst(x, y, color, count = 14, speed = 4, life = 38, radius = 4) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rnd(0, 0.5);
      const velocity = speed * (0.5 + Math.random());
      this.addParticle(new Particle({
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

  shardBurst(x, y, color, count = 10, speed = 7, life = 14, radius = 6) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rnd(-0.35, 0.35);
      const velocity = speed * rnd(0.8, 1.45);
      const stretch = rnd(1.2, 2.2);
      this.addParticle(new Particle({
        x,
        y,
        color,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: rndI(Math.max(4, life - 4), life + 3),
        radius: rnd(radius * 0.7, radius * 1.15),
        layerFX: this.layerFX,
        textures: this.textures,
        texture: "shard",
        drag: 0.885,
        scaleFrom: stretch,
        scaleTo: 0.18,
        alphaPower: 1.2,
        glowAlpha: 0,
        stretchX: stretch,
        stretchY: rnd(0.45, 0.8),
        rotation: angle,
        spin: rnd(-0.22, 0.22),
      }));
    }
  }

  spark(x, y, angle, color) {
    const spread = angle + Math.PI + rnd(-0.6, 0.6);
    const speed = rnd(1.6, 3.8);
    this.addParticle(new Particle({
      x,
      y,
      color,
      vx: Math.cos(spread) * speed,
      vy: Math.sin(spread) * speed,
      life: rndI(8, 16),
      radius: rnd(1.2, 2.1),
      layerFX: this.layerFX,
      textures: this.textures,
    }));
  }

  starBurst(x, y) {
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + rnd(0, 0.3);
      const speed = rnd(2, 6);
      this.addParticle(new Particle({
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

  collisionBurst(x, y, color) {
    this.shardBurst(x, y, color, 8, 9.4, 10, 6);
    this.shardBurst(x, y, 0xfff1c2, 4, 7.2, 8, 4.2);
    this.burst(x, y, color, 4, 3.6, 7, 2.8);
  }

  zombieCollisionBurst(x, y, color) {
    this.shardBurst(x, y, color, 9, 8.8, 11, 6.2);
    this.shardBurst(x, y, 0xfff1c2, 4, 6.9, 8, 4.2);
    this.burst(x, y, color, 5, 3.9, 7, 2.8);
  }

  spawnDeathFragments(snake, options = {}) {
    const foodDropChance = options.foodDropChance ?? 0.7;
    const baseStride = snake.segs.length > 120 ? 3 : snake.segs.length > 60 ? 2 : 1;
    const strideMultiplier = Math.max(1, options.strideMultiplier ?? 1);
    const pressure = Math.max(0, this.frags.length - 40);
    const adaptiveStride = baseStride + Math.floor(pressure / 20);
    const stride = Math.max(1, adaptiveStride * strideMultiplier);
    const remainingSlots = Math.max(0, MAX_FRAGMENTS - this.frags.length);
    if (remainingSlots <= 0) return;
    let created = 0;
    for (let i = 0; i < snake.segs.length && created < remainingSlots; i += stride) {
      this.addFragment(new DeathFrag({
        x: snake.segs[i].x,
        y: snake.segs[i].y,
        hue: snake.skin.hue,
        layerFX: this.layerFX,
        textures: this.textures,
        spawnFood: this.spawnFood,
        foodDropChance,
        speedMin: options.speedMin,
        speedMax: options.speedMax,
        drag: options.drag,
        lifeMin: options.lifeMin,
        lifeMax: options.lifeMax,
        scaleMin: options.scaleMin,
        scaleMax: options.scaleMax,
        spinMin: options.spinMin,
        spinMax: options.spinMax,
        tintSat: options.tintSat,
        tintLight: options.tintLight,
      }));
      created++;
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
