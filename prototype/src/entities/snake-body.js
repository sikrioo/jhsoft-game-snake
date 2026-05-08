import { CFG } from "../config/game-config.js";
import { hslHex } from "../core/utils.js";

function buildHueRamp(saturation, lightness) {
  return Array.from({ length: 360 }, (_, hue) => hslHex(hue, saturation, lightness));
}

const ZEBRA_PLAYER_TINTS = [
  hslHex(220, 18, 92),
  hslHex(220, 18, 92),
  hslHex(220, 8, 12),
  hslHex(220, 8, 12),
];

const ZEBRA_BOT_TINTS = [
  hslHex(220, 18, 84),
  hslHex(220, 18, 84),
  hslHex(220, 8, 12),
  hslHex(220, 8, 12),
];

const RAINBOW_PLAYER_TINTS = buildHueRamp(88, 52);
const RAINBOW_BOT_TINTS = buildHueRamp(72, 46);
const RAINBOW_HEAD_BASE_PLAYER = buildHueRamp(88, 63);
const RAINBOW_HEAD_BASE_BOT = buildHueRamp(88, 52);
const RAINBOW_HEAD_SHADOW = buildHueRamp(70, 10);

function getSegmentStyle(snake, bodyIndex, t, buffed, rainbowPhase) {
  if (buffed) {
    return {
      tint: hslHex(45, snake.isPlayer ? 82 : 68, snake.isPlayer ? 42 + t * 20 : 32 + t * 18),
      alpha: 0.6 + t * 0.3,
    };
  }

  if (snake.skin.pattern === "rainbow") {
    const wave = (rainbowPhase + bodyIndex * 18) % 360;
    return {
      tint: snake.isPlayer ? RAINBOW_PLAYER_TINTS[wave] : RAINBOW_BOT_TINTS[wave],
      alpha: 0.64 + t * 0.28,
    };
  }

  if (snake.skin.pattern === "ghost") {
    return {
      tint: hslHex(188, 44, snake.isPlayer ? 80 + t * 8 : 72 + t * 8),
      alpha: snake.isPlayer ? 0.32 + t * 0.16 : 0.24 + t * 0.14,
    };
  }

  if (snake.skin.pattern === "zebra") {
    return {
      tint: snake.isPlayer ? ZEBRA_PLAYER_TINTS[bodyIndex % 4] : ZEBRA_BOT_TINTS[bodyIndex % 4],
      alpha: 0.68 + t * 0.2,
    };
  }

  return {
    tint: hslHex(snake.skin.hue, snake.isPlayer ? 82 : 68, snake.isPlayer ? 42 + t * 20 : 32 + t * 18),
    alpha: 0.6 + t * 0.3,
  };
}

function getHeadStyle(snake, buffed, now) {
  const hue = buffed
    ? 45
    : snake.skin.pattern === "rainbow"
      ? Math.floor((now * 0.12) % 360)
      : snake.skin.pattern === "ghost"
        ? 188
        : snake.skin.pattern === "zebra"
          ? 220
          : snake.skin.hue;

  if (snake.skin.pattern === "rainbow") {
    return {
      shadowTint: RAINBOW_HEAD_SHADOW[hue],
      shadowAlpha: 0.55,
      baseTint: snake.isPlayer ? RAINBOW_HEAD_BASE_PLAYER[hue] : RAINBOW_HEAD_BASE_BOT[hue],
      baseAlpha: 1,
      glossAlpha: snake.isPlayer ? 0.27 : 0.16,
      stripeVisible: false,
      stripeAlpha: 0.92,
      mood: snake.skin.mood,
    };
  }

  return {
    shadowTint: hslHex(hue, snake.skin.pattern === "ghost" ? 24 : 70, snake.skin.pattern === "ghost" ? 18 : snake.skin.pattern === "zebra" ? 8 : 10),
    shadowAlpha: snake.skin.pattern === "ghost" ? 0.32 : 0.55,
    baseTint: hslHex(
      hue,
      snake.skin.pattern === "ghost" ? 38 : snake.skin.pattern === "zebra" ? 14 : 88,
      snake.skin.pattern === "ghost" ? 86 : snake.skin.pattern === "zebra" ? 92 : snake.isPlayer ? 63 : 52
    ),
    baseAlpha: snake.skin.pattern === "ghost" ? 0.72 : 1,
    glossAlpha: snake.skin.pattern === "ghost" ? 0.4 : snake.isPlayer ? 0.27 : 0.16,
    stripeVisible: snake.skin.pattern === "zebra",
    stripeAlpha: 0.92,
    mood: snake.skin.mood,
  };
}

export class SnakeBody {
  constructor(snake, { layers, textures }) {
    this.snake = snake;
    this.layers = layers;
    this.textures = textures;
    this.sprites = [];
    this.enabled = Boolean(this.layers && this.textures && typeof PIXI !== "undefined");
    this.container = this.enabled ? new PIXI.Container() : null;
    if (this.container) this.layers.bodies.addChild(this.container);
    this.headContainer = null;
    this.headAura = null;
    this.headShadow = null;
    this.headBase = null;
    this.headGloss = null;
    this.headStripes = null;
    this.leftEye = null;
    this.rightEye = null;
    this.leftPupil = null;
    this.rightPupil = null;
    this.leftEyeSpark = null;
    this.rightEyeSpark = null;
    this.mouthSmile = null;
    this.mouthAngry = null;
    this.nameText = null;

    if (this.enabled) {
      this.headAura = new PIXI.Graphics();
      this.layers.heads.addChild(this.headAura);

      this.headContainer = new PIXI.Container();
      this.layers.heads.addChild(this.headContainer);

      const headShadowTex = this.textures.getHeadShadowTex(CFG.SR);
      const headBaseTex = this.textures.getHeadBaseTex(CFG.SR);
      const stripeTex = this.textures.getHeadStripeTex(CFG.SR);
      const eyeWhiteTex = this.textures.getEyeWhiteTex(CFG.SR * 0.32);
      const eyePupilTex = this.textures.getEyePupilTex(CFG.SR * 0.16);
      const eyeSparkTex = this.textures.getEyeWhiteTex(CFG.SR * 0.075);
      const mouthSmileTex = this.textures.getMouthSmileTex(CFG.SR);
      const mouthAngryTex = this.textures.getMouthAngryTex(CFG.SR);

      this.headShadow = new PIXI.Sprite(headShadowTex);
      this.headShadow.anchor.set(0.5);
      this.headShadow.position.set(1.5, 1.5);
      this.headContainer.addChild(this.headShadow);

      this.headBase = new PIXI.Sprite(headBaseTex);
      this.headBase.anchor.set(0.5);
      this.headContainer.addChild(this.headBase);

      this.headStripes = new PIXI.Sprite(stripeTex);
      this.headStripes.anchor.set(0.5);
      this.headStripes.tint = 0x0f1118;
      this.headContainer.addChild(this.headStripes);

      this.headGloss = new PIXI.Sprite(this.textures.getCircleTex(0xffffff, Math.ceil(CFG.SR * 0.5), 0));
      this.headGloss.anchor.set(0.5);
      this.headGloss.position.set(-CFG.SR * 0.26, -CFG.SR * 0.28);
      this.headGloss.scale.set(1, 0.82);
      this.headContainer.addChild(this.headGloss);

      this.leftEye = new PIXI.Sprite(eyeWhiteTex);
      this.rightEye = new PIXI.Sprite(eyeWhiteTex);
      this.leftPupil = new PIXI.Sprite(eyePupilTex);
      this.rightPupil = new PIXI.Sprite(eyePupilTex);
      this.leftEyeSpark = new PIXI.Sprite(eyeSparkTex);
      this.rightEyeSpark = new PIXI.Sprite(eyeSparkTex);

      for (const sprite of [this.leftEye, this.rightEye, this.leftPupil, this.rightPupil, this.leftEyeSpark, this.rightEyeSpark]) {
        sprite.anchor.set(0.5);
        this.headContainer.addChild(sprite);
      }

      this.leftPupil.tint = 0x080810;
      this.rightPupil.tint = 0x080810;

      this.mouthSmile = new PIXI.Sprite(mouthSmileTex);
      this.mouthAngry = new PIXI.Sprite(mouthAngryTex);
      this.mouthSmile.anchor.set(0.5);
      this.mouthAngry.anchor.set(0.5);
      this.mouthSmile.tint = 0x04080f;
      this.mouthAngry.tint = 0x04080f;
      this.mouthSmile.alpha = 0.82;
      this.mouthAngry.alpha = 0.82;
      this.mouthSmile.position.set(CFG.SR * 0.98, 0);
      this.mouthAngry.position.set(CFG.SR * 0.98, 0);
      this.headContainer.addChild(this.mouthSmile, this.mouthAngry);

      const eyeForward = CFG.SR * 0.44;
      const eyeOffset = CFG.SR * 0.54;
      this.leftEye.position.set(eyeForward, -eyeOffset);
      this.rightEye.position.set(eyeForward, eyeOffset);
      this.leftPupil.position.set(eyeForward + CFG.SR * 0.13, -eyeOffset);
      this.rightPupil.position.set(eyeForward + CFG.SR * 0.13, eyeOffset);
      this.leftEyeSpark.position.set(eyeForward - CFG.SR * 0.04, -eyeOffset - CFG.SR * 0.09);
      this.rightEyeSpark.position.set(eyeForward - CFG.SR * 0.04, eyeOffset - CFG.SR * 0.09);
    }

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

  setVisible(visible) {
    if (!this.enabled) return;
    for (const sprite of this.sprites) sprite.visible = visible;
    if (this.headContainer) this.headContainer.visible = visible;
    if (this.headAura) this.headAura.visible = visible;
    if (this.nameText) this.nameText.visible = visible;
  }

  updateHead(buffed, now) {
    const head = this.snake.segs[0];
    const style = getHeadStyle(this.snake, buffed, now);

    this.headContainer.position.set(head.x, head.y);
    this.headContainer.rotation = this.snake.angle;
    this.headShadow.tint = style.shadowTint;
    this.headShadow.alpha = style.shadowAlpha;
    this.headBase.tint = style.baseTint;
    this.headBase.alpha = style.baseAlpha;
    this.headGloss.alpha = style.glossAlpha;
    this.headStripes.visible = style.stripeVisible;
    this.headStripes.alpha = style.stripeAlpha;
    this.mouthSmile.visible = style.mood === "smile";
    this.mouthAngry.visible = style.mood === "angry";

    if (this.snake.boosting || buffed) {
      const auraColor = buffed ? 0xffd060 : 0x00ffc8;
      this.headAura.visible = true;
      this.headAura.clear();
      for (let i = 0; i < Math.min(8, this.snake.segs.length - 1); i++) {
        const alpha = (1 - i / 8) * (this.snake.boosting ? 0.13 : 0.09);
        this.headAura.lineStyle(CFG.SR * 3.6 * (1 - i * 0.09), auraColor, alpha);
        this.headAura.moveTo(this.snake.segs[i].x, this.snake.segs[i].y);
        this.headAura.lineTo(this.snake.segs[i + 1].x, this.snake.segs[i + 1].y);
      }
      this.headAura.lineStyle(0);
    } else {
      this.headAura.clear();
      this.headAura.visible = false;
    }
  }

  update() {
    if (!this.enabled) return;
    this.setVisible(true);
    const segs = this.snake.segs;
    const bodyCount = segs.length - 1;
    if (bodyCount <= 0) return;
    this.sync(bodyCount);
    const buffed = this.snake.speedBuff > 0;
    const invBodyCount = 1 / Math.max(1, bodyCount - 1);
    const now = Date.now();
    const rainbowPhase = Math.floor((now * 0.08) % 360);

    for (let i = 0; i < bodyCount; i++) {
      const segIdx = segs.length - 1 - i;
      const seg = segs[segIdx];
      const sprite = this.sprites[i];
      const t = i * invBodyCount;
      const style = getSegmentStyle(this.snake, i, t, buffed, rainbowPhase);
      sprite.visible = true;
      sprite.position.set(seg.x, seg.y);
      sprite.scale.set(0.68 + 0.32 * t);
      sprite.tint = style.tint;
      sprite.alpha = style.alpha;
    }

    this.updateHead(buffed, now);

    if (this.nameText) {
      const head = segs[0];
      this.nameText.position.set(head.x, head.y - CFG.SR * 2.8);
      this.nameText.alpha = buffed ? 0.85 : 0.48;
    }
  }

  destroy() {
    if (this.container) this.container.destroy({ children: true });
    if (this.headAura) this.headAura.destroy();
    if (this.headContainer) this.headContainer.destroy({ children: true });
    if (this.nameText) this.nameText.destroy();
  }
}
