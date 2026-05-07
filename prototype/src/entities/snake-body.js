import { CFG } from "../config/game-config.js";
import { hslHex } from "../core/utils.js";

export class SnakeBody {
  constructor(snake, { layers, textures }) {
    this.snake = snake;
    this.layers = layers;
    this.textures = textures;
    this.sprites = [];
    this.enabled = Boolean(this.layers && this.textures && typeof PIXI !== "undefined");
    this.container = this.enabled ? new PIXI.Container() : null;
    if (this.container) this.layers.bodies.addChild(this.container);
    this.nameText = null;

    if (this.enabled && snake.showNameTag) {
      this.nameText = new PIXI.Text(snake.name, {
        fontFamily: "Share Tech Mono",
        fontSize: 10,
        fill: 0xffffff,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4,
        dropShadowDistance: 0,
      });
      this.nameText.anchor.set(0.5, 1);
      this.layers.names.addChild(this.nameText);
    }
  }

  sync(count) {
    if (!this.enabled) return;
    const texture = this.textures.getSegTex(CFG.SR);
    while (this.sprites.length < count) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      this.container.addChild(sprite);
      this.sprites.push(sprite);
    }
    for (let i = count; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }

  update() {
    if (!this.enabled) return;
    const segs = this.snake.segs;
    const bodyCount = segs.length - 1;
    this.sync(bodyCount);
    const buffed = this.snake.speedBuff > 0;
    const hue = buffed ? 45 : this.snake.skin.hue;

    for (let i = 0; i < bodyCount; i++) {
      const segIdx = segs.length - 1 - i;
      const seg = segs[segIdx];
      const sprite = this.sprites[i];
      const t = i / Math.max(1, bodyCount - 1);
      sprite.visible = true;
      sprite.position.set(seg.x, seg.y);
      sprite.scale.set(0.68 + 0.32 * t);
      sprite.tint = hslHex(hue, this.snake.isPlayer ? 82 : 68, this.snake.isPlayer ? 42 + t * 20 : 32 + t * 18);
      sprite.alpha = 0.6 + t * 0.3;
    }

    if (this.nameText) {
      const head = segs[0];
      this.nameText.position.set(head.x, head.y - CFG.SR * 2.8);
      this.nameText.alpha = buffed ? 0.85 : 0.48;
    }
  }

  destroy() {
    if (this.container) this.container.destroy({ children: true });
    if (this.nameText) this.nameText.destroy();
  }
}
