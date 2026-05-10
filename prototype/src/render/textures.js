export class TextureStore {
  constructor(app) {
    this.app = app;
    this.cache = new Map();
  }

  quantizeRadius(radius) {
    if (radius <= 4) return 4;
    if (radius <= 6) return 6;
    if (radius <= 8) return 8;
    if (radius <= 10) return 10;
    return 12;
  }

  getCircleTex(color, radius, glowAlpha = 0) {
    const key = `c:${color}:${radius}:${glowAlpha}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = glowAlpha > 0 ? 14 : 4;
    const center = radius + pad;
    const g = new PIXI.Graphics();

    if (glowAlpha > 0) {
      g.beginFill(color, glowAlpha * 0.7);
      g.drawCircle(center, center, radius + 8);
      g.endFill();
    }

    g.beginFill(color, 0.95);
    g.drawCircle(center, center, radius);
    g.endFill();
    g.beginFill(0xffffff, 0.45);
    g.drawCircle(center, center, radius * 0.42);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getStarTex() {
    if (this.cache.has("star")) return this.cache.get("star");

    const radius = 12;
    const pad = 22;
    const center = radius + pad;
    const g = new PIXI.Graphics();
    g.beginFill(0xffd060, 0.2);
    g.drawCircle(center, center, radius + 11);
    g.endFill();
    g.beginFill(0xffd060, 0.96);

    const points = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? radius : radius * 0.44;
      points.push(center + Math.cos(angle) * rr, center + Math.sin(angle) * rr);
    }
    g.drawPolygon(points);
    g.endFill();
    g.beginFill(0xffffff, 0.65);
    g.drawCircle(center, center, radius * 0.36);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set("star", texture);
    return texture;
  }

  getSegTex(radius) {
    const key = `seg:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 4;
    const center = radius + pad;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawCircle(center, center, radius);
    g.endFill();
    g.beginFill(0xffffff, 0.28);
    g.drawCircle(center - radius * 0.24, center - radius * 0.24, radius * 0.38);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getShardTex(radius) {
    const qRadius = this.quantizeRadius(radius);
    const key = `shard:${qRadius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 6;
    const size = qRadius * 2 + pad * 2;
    const cx = size / 2;
    const cy = size / 2;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawPolygon([
      cx - qRadius * 0.95, cy - qRadius * 0.12,
      cx - qRadius * 0.2, cy - qRadius * 0.82,
      cx + qRadius * 0.92, cy - qRadius * 0.18,
      cx + qRadius * 0.28, cy + qRadius * 0.86,
    ]);
    g.endFill();
    g.beginFill(0xffffff, 0.24);
    g.drawPolygon([
      cx - qRadius * 0.2, cy - qRadius * 0.48,
      cx + qRadius * 0.44, cy - qRadius * 0.14,
      cx - qRadius * 0.06, cy + qRadius * 0.28,
    ]);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getHeadShadowTex(radius) {
    const key = `head-shadow:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 8;
    const cx = radius * 1.7 + pad;
    const cy = radius * 1.2 + pad;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawEllipse(cx, cy, radius * 1.7, radius * 1.2);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getHeadBaseTex(radius) {
    const key = `head-base:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 8;
    const cx = radius * 1.7 + pad;
    const cy = radius * 1.2 + pad;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawEllipse(cx, cy, radius * 1.7, radius * 1.2);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getHeadStripeTex(radius) {
    const key = `head-stripes:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 8;
    const cx = radius * 1.7 + pad;
    const cy = radius * 1.2 + pad;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawEllipse(cx - radius * 0.25, cy, radius * 0.18, radius * 1.05);
    g.drawEllipse(cx + radius * 0.2, cy, radius * 0.16, radius * 1.02);
    g.drawEllipse(cx + radius * 0.62, cy, radius * 0.13, radius * 0.94);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getEyeWhiteTex(radius) {
    const key = `eye-white:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 4;
    const center = radius + pad;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawCircle(center, center, radius);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getEyePupilTex(radius) {
    const key = `eye-pupil:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 4;
    const center = radius + pad;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawCircle(center, center, radius);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getEyeHappyClosedTex(radius) {
    const key = `eye-happy-closed:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const size = radius * 2.8 + 8;
    const center = size / 2;
    const g = new PIXI.Graphics();
    g.lineStyle(Math.max(2, radius * 0.42), 0xffffff, 1);
    g.moveTo(center - radius * 0.9, center + radius * 0.1);
    g.quadraticCurveTo(center, center - radius * 0.78, center + radius * 0.9, center + radius * 0.1);
    g.lineStyle(0);

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getMouthSmileTex(radius) {
    const key = `mouth-smile:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const size = radius * 2.2 + 8;
    const center = size / 2;
    const g = new PIXI.Graphics();
    g.lineStyle(2, 0xffffff, 1);
    g.arc(center + radius * 0.1, center + radius * 0.1, radius * 0.42, 0.28 * Math.PI, 0.72 * Math.PI);
    g.lineStyle(0);

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getMouthBigSmileTex(radius) {
    const key = `mouth-big-smile:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const size = radius * 2.9 + 10;
    const center = size / 2;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawEllipse(center + radius * 0.12, center + radius * 0.22, radius * 0.58, radius * 0.4);
    g.endFill();
    g.beginFill(0xffffff, 0.32);
    g.drawEllipse(center + radius * 0.08, center + radius * 0.08, radius * 0.26, radius * 0.1);
    g.endFill();

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }

  getMouthAngryTex(radius) {
    const key = `mouth-angry:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const size = radius * 2.2 + 8;
    const center = size / 2;
    const g = new PIXI.Graphics();
    g.lineStyle(2, 0xffffff, 1);
    g.moveTo(center - radius * 0.4, center);
    g.lineTo(center + radius * 0.4, center);
    g.lineStyle(0);

    const texture = this.app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    this.cache.set(key, texture);
    return texture;
  }
}
