export class TextureStore {
  constructor(app) {
    this.app = app;
    this.cache = new Map();
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
}
