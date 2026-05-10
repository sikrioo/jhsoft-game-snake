export class TextureStore {
  constructor(app) {
    this.app = app;
    this.cache = new Map();
  }

  buildCanvasTexture(key, width, height, draw) {
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    draw(ctx, width, height);

    const texture = PIXI.Texture.from(canvas);
    this.cache.set(key, texture);
    return texture;
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
    const size = radius * 2 + pad * 2;
    const center = size / 2;

    return this.buildCanvasTexture(key, size, size, (ctx) => {
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const bodyGradient = ctx.createLinearGradient(0, center - radius, 0, center + radius);
      bodyGradient.addColorStop(0, "rgba(255,255,255,0.98)");
      bodyGradient.addColorStop(0.38, "rgba(226,226,226,0.96)");
      bodyGradient.addColorStop(0.68, "rgba(196,196,196,0.95)");
      bodyGradient.addColorStop(1, "rgba(156,156,156,0.94)");
      ctx.fillStyle = bodyGradient;
      ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);

      const topGlow = ctx.createRadialGradient(
        center - radius * 0.34,
        center - radius * 0.42,
        radius * 0.08,
        center - radius * 0.34,
        center - radius * 0.42,
        radius * 1.08
      );
      topGlow.addColorStop(0, "rgba(255,255,255,0.42)");
      topGlow.addColorStop(0.5, "rgba(255,255,255,0.12)");
      topGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = topGlow;
      ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);

      const lowerShade = ctx.createLinearGradient(0, center, 0, center + radius);
      lowerShade.addColorStop(0, "rgba(90,90,90,0)");
      lowerShade.addColorStop(1, "rgba(90,90,90,0.18)");
      ctx.fillStyle = lowerShade;
      ctx.fillRect(center - radius, center, radius * 2, radius);

      const sideShade = ctx.createRadialGradient(
        center + radius * 0.38,
        center + radius * 0.12,
        radius * 0.24,
        center + radius * 0.38,
        center + radius * 0.12,
        radius * 1.06
      );
      sideShade.addColorStop(0, "rgba(120,120,120,0)");
      sideShade.addColorStop(1, "rgba(88,88,88,0.16)");
      ctx.fillStyle = sideShade;
      ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);

      ctx.restore();

      ctx.beginPath();
      ctx.arc(center, center, radius - Math.max(0.8, radius * 0.12), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(84,84,84,0.08)";
      ctx.lineWidth = Math.max(1, radius * 0.18);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center, center, radius - Math.max(0.4, radius * 0.05), 0.08 * Math.PI, 0.92 * Math.PI);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = Math.max(0.8, radius * 0.08);
      ctx.stroke();
    });
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
    const size = Math.ceil(radius * 3.4 + pad * 2);
    const cx = size / 2;
    const cy = size / 2;

    return this.buildCanvasTexture(key, size, size, (ctx) => {
      ctx.clearRect(0, 0, size, size);
      const gradient = ctx.createRadialGradient(
        cx - radius * 0.12,
        cy + radius * 0.16,
        radius * 0.18,
        cx,
        cy,
        radius * 1.95
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.94)");
      gradient.addColorStop(0.56, "rgba(188,188,188,0.5)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.9, radius * 1.38, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  getHeadBaseTex(radius) {
    const key = `head-base:${radius}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const pad = 8;
    const size = Math.ceil(radius * 3.4 + pad * 2);
    const cx = size / 2;
    const cy = size / 2;

    return this.buildCanvasTexture(key, size, size, (ctx) => {
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.7, radius * 1.2, 0, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const bodyGradient = ctx.createLinearGradient(0, cy - radius * 1.2, 0, cy + radius * 1.2);
      bodyGradient.addColorStop(0, "rgba(255,255,255,0.98)");
      bodyGradient.addColorStop(0.34, "rgba(230,230,230,0.98)");
      bodyGradient.addColorStop(0.68, "rgba(198,198,198,0.97)");
      bodyGradient.addColorStop(1, "rgba(158,158,158,0.96)");
      ctx.fillStyle = bodyGradient;
      ctx.fillRect(cx - radius * 1.8, cy - radius * 1.3, radius * 3.6, radius * 2.6);

      const foreheadGlow = ctx.createRadialGradient(
        cx - radius * 0.68,
        cy - radius * 0.58,
        radius * 0.14,
        cx - radius * 0.68,
        cy - radius * 0.58,
        radius * 1.5
      );
      foreheadGlow.addColorStop(0, "rgba(255,255,255,0.42)");
      foreheadGlow.addColorStop(0.6, "rgba(255,255,255,0.12)");
      foreheadGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = foreheadGlow;
      ctx.fillRect(cx - radius * 1.8, cy - radius * 1.3, radius * 3.6, radius * 2.6);

      const jawShade = ctx.createLinearGradient(0, cy, 0, cy + radius * 1.24);
      jawShade.addColorStop(0, "rgba(90,90,90,0)");
      jawShade.addColorStop(1, "rgba(90,90,90,0.2)");
      ctx.fillStyle = jawShade;
      ctx.fillRect(cx - radius * 1.8, cy, radius * 3.6, radius * 1.4);

      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.56, radius * 1.08, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(86,86,86,0.08)";
      ctx.lineWidth = Math.max(1, radius * 0.12);
      ctx.stroke();
    });
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

    const size = radius * 2.5 + 10;
    const center = size / 2;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawEllipse(center, center + radius * 0.16, radius * 0.44, radius * 0.3);
    g.endFill();
    g.beginFill(0xffffff, 0.32);
    g.drawEllipse(center, center + radius * 0.02, radius * 0.18, radius * 0.07);
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
