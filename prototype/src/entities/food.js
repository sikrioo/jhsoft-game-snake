import { CFG } from "../config/game-config.js";
import { rnd, rndI } from "../core/utils.js";

export class Food {
  constructor({ x, y, type = "normal", layerFood, textures, value, radius, color }) {
    if (x === undefined || y === undefined) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * CFG.WR * 0.95;
      this.x = Math.cos(angle) * distance;
      this.y = Math.sin(angle) * distance;
    } else {
      this.x = x;
      this.y = y;
    }

    this.type = type;
    this.ph = rnd(0, Math.PI * 2);
    this.ps = rnd(0.03, 0.07);
    this.tickStride = type === "star" ? 1 : 3;
    this.tickOffset = rndI(0, this.tickStride);

    const renderEnabled = Boolean(layerFood && textures && typeof PIXI !== "undefined");

    if (type === "star") {
      this.r = 12;
      this.val = 5;
      this.color = 0xffd060;
      this.sp = renderEnabled ? new PIXI.Sprite(textures.getStarTex()) : null;
    } else {
      this.r = radius ?? rnd(3.5, 7);
      this.val = value ?? 1;
      this.color = color ?? CFG.FOOD_COLS[rndI(0, CFG.FOOD_COLS.length)];
      this.sp = renderEnabled ? new PIXI.Sprite(textures.getCircleTex(this.color, Math.ceil(this.r), 0.18)) : null;
    }

    if (this.sp) {
      this.sp.anchor.set(0.5);
      this.sp.position.set(this.x, this.y);
      layerFood.addChild(this.sp);
    }
  }

  tick(frameId = 0) {
    const stride = this.tickStride;
    if (stride > 1 && frameId % stride !== this.tickOffset) return;

    const step = stride > 1 ? stride : 1;
    this.ph += this.ps * step;
    if (!this.sp) return;
    this.sp.scale.set(1 + 0.2 * Math.sin(this.ph));
    if (this.type === "star") this.sp.rotation += 0.025 * step;
  }

  remove() {
    if (this.sp) this.sp.destroy();
  }
}
