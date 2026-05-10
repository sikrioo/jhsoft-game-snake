import { CFG } from "../config/game-config.js";
import { hslHex } from "../core/utils.js";

function buildHueRamp(saturation, lightness) {
  return Array.from({ length: 360 }, (_, hue) => hslHex(hue, saturation, lightness));
}

function mixHex(a, b, t) {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const mr = Math.round(ar + (br - ar) * t);
  const mg = Math.round(ag + (bg - ag) * t);
  const mb = Math.round(ab + (bb - ab) * t);
  return (mr << 16) | (mg << 8) | mb;
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
const SHORT_SNAKE_MAX_LEN = CFG.MIN_LEN + 18;
const LONG_SNAKE_MIN_LEN = CFG.MIN_LEN + 36;
const SHORT_SNAKE_TAIL_PORTION = 0.12;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getShortSnakeBlend(length) {
  if (length <= SHORT_SNAKE_MAX_LEN) return 0;
  if (length >= LONG_SNAKE_MIN_LEN) return 1;
  return smoothstep01((length - SHORT_SNAKE_MAX_LEN) / (LONG_SNAKE_MIN_LEN - SHORT_SNAKE_MAX_LEN));
}

function getBodyScaleProfile(length, t) {
  const clampedT = clamp01(t);
  const legacyScale = 0.68 + 0.32 * clampedT;
  const tailT = smoothstep01(clampedT / SHORT_SNAKE_TAIL_PORTION);
  const bodyT = smoothstep01((clampedT - SHORT_SNAKE_TAIL_PORTION) / (1 - SHORT_SNAKE_TAIL_PORTION));
  const shortScale = clampedT <= SHORT_SNAKE_TAIL_PORTION
    ? lerp(0.64, 0.82, tailT)
    : lerp(0.82, 0.87, bodyT);

  return lerp(shortScale, legacyScale, getShortSnakeBlend(length));
}

function getHeadScaleProfile(length) {
  return lerp(0.7, 1, getShortSnakeBlend(length));
}

function getZombieVariant(snake) {
  return snake.botType || "basic";
}

function getHeadFeatureLayout(snake) {
  if (snake.skin.pattern === "jelly") {
    return {
      headScale: 1.04,
      eyeForward: CFG.SR * 0.2,
      eyeOffset: CFG.SR * 0.4,
      pupilForward: CFG.SR * 0.1,
      eyeScale: 0.9,
      pupilScale: 0.8,
      sparkScale: 0.8,
      glossX: -CFG.SR * 0.3,
      glossY: -CFG.SR * 0.34,
      glossScaleX: 1.18,
      glossScaleY: 0.94,
      mouthX: CFG.SR * 0.3,
      mouthY: CFG.SR * 0.62,
      mouthScale: 0.76,
    };
  }

  if (snake.skin.pattern === "worm") {
    return {
      headScale: 0.94,
      eyeForward: CFG.SR * 0.54,
      eyeOffset: CFG.SR * 0.42,
      pupilForward: CFG.SR * 0.12,
      eyeScale: 1.18,
      pupilScale: 0.88,
      sparkScale: 0.7,
      glossX: -CFG.SR * 0.34,
      glossY: -CFG.SR * 0.2,
      glossScaleX: 0.7,
      glossScaleY: 0.58,
      mouthX: CFG.SR * 0.98,
      mouthY: 0,
      mouthScale: 1,
    };
  }

  return {
    headScale: 1,
    eyeForward: CFG.SR * 0.44,
    eyeOffset: CFG.SR * 0.54,
    pupilForward: CFG.SR * 0.13,
    eyeScale: 1,
    pupilScale: 1,
    sparkScale: 1,
    glossX: -CFG.SR * 0.26,
    glossY: -CFG.SR * 0.28,
    glossScaleX: 1,
    glossScaleY: 0.82,
    mouthX: CFG.SR * 0.98,
    mouthY: 0,
    mouthScale: 1,
  };
}

function getMotionProfile(snake) {
  if (snake.skin.pattern === "jelly") {
    return {
      segmentPulseAmp: 0.03,
      segmentPulseFreq: 0.015,
      segmentPulsePhase: 0.45,
      headBounceAmp: 0.045,
      headBounceFreq: 0.018,
      headBobAmp: 0.5,
    };
  }

  return {
    segmentPulseAmp: 0,
    segmentPulseFreq: 0.015,
    segmentPulsePhase: 0.45,
    headBounceAmp: 0,
    headBounceFreq: 0.018,
    headBobAmp: 0,
  };
}

function getSegmentStyle(snake, bodyIndex, t, buffed, rainbowPhase) {
  const baseScale = getBodyScaleProfile(snake.len, t);

  if (buffed) {
    return {
      tint: hslHex(45, snake.isPlayer ? 82 : 68, snake.isPlayer ? 42 + t * 20 : 32 + t * 18),
      alpha: 0.6 + t * 0.3,
      scale: baseScale,
    };
  }

  if (snake.skin.pattern === "rainbow") {
    const wave = (rainbowPhase + bodyIndex * 18) % 360;
    return {
      tint: snake.isPlayer ? RAINBOW_PLAYER_TINTS[wave] : RAINBOW_BOT_TINTS[wave],
      alpha: 0.64 + t * 0.28,
      scale: baseScale,
    };
  }

  if (snake.skin.pattern === "ghost") {
    return {
      tint: hslHex(188, 44, snake.isPlayer ? 80 + t * 8 : 72 + t * 8),
      alpha: snake.isPlayer ? 0.32 + t * 0.16 : 0.24 + t * 0.14,
      scale: baseScale,
    };
  }

  if (snake.skin.pattern === "jelly") {
    const bandOffset = [4, 1, -1, 2][bodyIndex % 4];
    return {
      tint: hslHex(126, snake.isPlayer ? 86 : 72, (snake.isPlayer ? 65 : 57) + bandOffset + t * 3),
      alpha: snake.isPlayer ? 0.9 + t * 0.05 : 0.84 + t * 0.06,
      scale: baseScale * 1.02,
    };
  }

  if (snake.skin.pattern === "worm") {
    const bandOffset = [2, 0, -3, -1][bodyIndex % 4];
    return {
      tint: hslHex(12, snake.isPlayer ? 34 : 28, (snake.isPlayer ? 63 : 56) + bandOffset + t * 2),
      alpha: snake.isPlayer ? 0.84 + t * 0.1 : 0.78 + t * 0.1,
      scale: baseScale,
    };
  }

  if (snake.skin.pattern === "zombie") {
    const variant = getZombieVariant(snake);
    if (variant === "fast") {
      return {
        tint: hslHex(118, 62, 28 + t * 32),
        alpha: 0.58 + t * 0.36,
        scale: baseScale,
      };
    }
    if (variant === "long") {
      const band = bodyIndex % 3 === 1;
      return {
        tint: hslHex(95, band ? 28 : 18, band ? 36 : 24),
        alpha: 0.82 + t * 0.12,
        scale: baseScale,
      };
    }
    if (variant === "elite") {
      return {
        tint: hslHex(92, 48, 30 + t * 18),
        alpha: 0.78 + t * 0.2,
        scale: baseScale,
      };
    }
    return {
      tint: hslHex(108, snake.isPlayer ? 44 : 36, snake.isPlayer ? 38 + t * 14 : 28 + t * 12),
      alpha: 0.72 + t * 0.18,
      scale: baseScale,
    };
  }

  if (snake.skin.pattern === "zebra") {
    return {
      tint: snake.isPlayer ? ZEBRA_PLAYER_TINTS[bodyIndex % 4] : ZEBRA_BOT_TINTS[bodyIndex % 4],
      alpha: 0.68 + t * 0.2,
      scale: baseScale,
    };
  }

  return {
    tint: hslHex(snake.skin.hue, snake.isPlayer ? 82 : 68, snake.isPlayer ? 42 + t * 20 : 32 + t * 18),
    alpha: 0.6 + t * 0.3,
    scale: baseScale,
  };
}

function getHeadStyle(snake, buffed, now) {
  const zombieVariant = snake.skin.pattern === "zombie" ? getZombieVariant(snake) : null;
  const hue = buffed
    ? 45
    : snake.skin.pattern === "rainbow"
      ? Math.floor((now * 0.12) % 360)
      : snake.skin.pattern === "ghost"
        ? 188
        : snake.skin.pattern === "zombie"
          ? 108
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
      stripeTint: 0x0f1118,
      auraColor: 0x00ffc8,
      auraIdleAlpha: 0,
      auraBoostAlpha: 0.13,
      auraBuffAlpha: 0.09,
      auraWidth: CFG.SR * 3.6,
    };
  }

  if (snake.skin.pattern === "zombie") {
    if (zombieVariant === "fast") {
      return {
        shadowTint: hslHex(124, 52, 10),
        shadowAlpha: 0.38,
        baseTint: hslHex(118, 58, 54),
        baseAlpha: 0.94,
        glossAlpha: 0.07,
        stripeVisible: false,
        stripeAlpha: 0,
        stripeTint: 0x14200d,
        mood: snake.skin.mood,
        auraColor: 0x92ff6a,
        auraIdleAlpha: 0,
        auraBoostAlpha: 0.15,
        auraBuffAlpha: 0.11,
        auraWidth: CFG.SR * 3.7,
      };
    }

    if (zombieVariant === "long") {
      return {
        shadowTint: hslHex(92, 20, 8),
        shadowAlpha: 0.46,
        baseTint: hslHex(94, 22, 42),
        baseAlpha: 0.98,
        glossAlpha: 0.06,
        stripeVisible: true,
        stripeAlpha: 0.42,
        stripeTint: 0x253018,
        mood: snake.skin.mood,
        auraColor: 0x7ea15d,
        auraIdleAlpha: 0,
        auraBoostAlpha: 0.1,
        auraBuffAlpha: 0.08,
        auraWidth: CFG.SR * 3.9,
      };
    }

    if (zombieVariant === "elite") {
      return {
        shadowTint: hslHex(78, 52, 9),
        shadowAlpha: 0.54,
        baseTint: hslHex(88, 46, 48),
        baseAlpha: 0.98,
        glossAlpha: 0.28,
        stripeVisible: false,
        stripeAlpha: 0,
        stripeTint: 0x27160d,
        mood: snake.skin.mood,
        auraColor: 0xb4ff50,
        auraIdleAlpha: 0.06,
        auraBoostAlpha: 0.17,
        auraBuffAlpha: 0.12,
        auraWidth: CFG.SR * 4.2,
      };
    }

    return {
      shadowTint: hslHex(108, 70, 10),
      shadowAlpha: 0.42,
      baseTint: hslHex(108, 40, snake.isPlayer ? 58 : 46),
      baseAlpha: 0.96,
      glossAlpha: 0.1,
      stripeVisible: false,
      stripeAlpha: 0,
      stripeTint: 0x0f1118,
      mood: snake.skin.mood,
      auraColor: 0x7ddf5f,
      auraIdleAlpha: 0,
      auraBoostAlpha: 0.13,
      auraBuffAlpha: 0.09,
      auraWidth: CFG.SR * 3.6,
    };
  }

  if (snake.skin.pattern === "worm") {
    return {
      shadowTint: hslHex(12, 26, 24),
      shadowAlpha: 0.34,
      baseTint: hslHex(12, snake.isPlayer ? 40 : 32, snake.isPlayer ? 70 : 62),
      baseAlpha: 0.98,
      glossAlpha: 0.08,
      stripeVisible: false,
      stripeAlpha: 0,
      stripeTint: 0x5e4039,
      mood: null,
      auraColor: 0xf4b5aa,
      auraIdleAlpha: 0,
      auraBoostAlpha: 0.08,
      auraBuffAlpha: 0.06,
      auraWidth: CFG.SR * 3.1,
    };
  }

  if (snake.skin.pattern === "jelly") {
    return {
      shadowTint: hslHex(126, 36, 24),
      shadowAlpha: 0.22,
      baseTint: hslHex(126, snake.isPlayer ? 88 : 74, snake.isPlayer ? 71 : 63),
      baseAlpha: 0.99,
      glossAlpha: 0.24,
      stripeVisible: false,
      stripeAlpha: 0,
      stripeTint: 0x173819,
      mood: "smile",
      eyeMode: "happy_closed",
      eyeTint: 0x1b1b1b,
      mouthMode: "big_smile",
      mouthTint: 0x4b2a1d,
      auraColor: 0x9affb0,
      auraIdleAlpha: 0.035,
      auraBoostAlpha: 0.1,
      auraBuffAlpha: 0.08,
      auraWidth: CFG.SR * 3.4,
    };
  }

  return {
    shadowTint: hslHex(hue, snake.skin.pattern === "ghost" ? 24 : 70, snake.skin.pattern === "ghost" ? 18 : snake.skin.pattern === "zebra" ? 8 : 10),
    shadowAlpha: snake.skin.pattern === "ghost" ? 0.32 : snake.skin.pattern === "zombie" ? 0.42 : 0.55,
    baseTint: hslHex(
      hue,
      snake.skin.pattern === "ghost" ? 38 : snake.skin.pattern === "zebra" ? 14 : snake.skin.pattern === "zombie" ? 40 : 88,
      snake.skin.pattern === "ghost" ? 86 : snake.skin.pattern === "zebra" ? 92 : snake.skin.pattern === "zombie" ? (snake.isPlayer ? 58 : 46) : snake.isPlayer ? 63 : 52
    ),
    baseAlpha: snake.skin.pattern === "ghost" ? 0.72 : snake.skin.pattern === "zombie" ? 0.96 : 1,
    glossAlpha: snake.skin.pattern === "ghost" ? 0.4 : snake.skin.pattern === "zombie" ? 0.1 : snake.isPlayer ? 0.27 : 0.16,
    stripeVisible: snake.skin.pattern === "zebra",
    stripeAlpha: 0.92,
    mood: snake.skin.mood,
    stripeTint: 0x0f1118,
    auraColor: 0x00ffc8,
    auraIdleAlpha: 0,
    auraBoostAlpha: 0.13,
    auraBuffAlpha: 0.09,
    auraWidth: CFG.SR * 3.6,
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
    this.mouthBigSmile = null;
    this.nameText = null;
    this.eyeWhiteTex = null;
    this.eyeClosedTex = null;

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
      const eyeClosedTex = this.textures.getEyeHappyClosedTex(CFG.SR * 0.34);
      const mouthSmileTex = this.textures.getMouthSmileTex(CFG.SR);
      const mouthAngryTex = this.textures.getMouthAngryTex(CFG.SR);
      const mouthBigSmileTex = this.textures.getMouthBigSmileTex(CFG.SR);

      this.eyeWhiteTex = eyeWhiteTex;
      this.eyeClosedTex = eyeClosedTex;

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
      this.mouthBigSmile = new PIXI.Sprite(mouthBigSmileTex);
      this.mouthSmile.anchor.set(0.5);
      this.mouthAngry.anchor.set(0.5);
      this.mouthBigSmile.anchor.set(0.5);
      this.mouthSmile.tint = 0x04080f;
      this.mouthAngry.tint = 0x04080f;
      this.mouthBigSmile.tint = 0x4b2a1d;
      this.mouthSmile.alpha = 0.82;
      this.mouthAngry.alpha = 0.82;
      this.mouthBigSmile.alpha = 0.94;
      this.mouthSmile.position.set(CFG.SR * 0.98, 0);
      this.mouthAngry.position.set(CFG.SR * 0.98, 0);
      this.mouthBigSmile.position.set(CFG.SR * 0.98, 0);
      this.headContainer.addChild(this.mouthSmile, this.mouthAngry, this.mouthBigSmile);

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
    const sizeScale = this.snake.sizeScale ?? 1;
    const headScale = getHeadScaleProfile(this.snake.len);
    const featureLayout = getHeadFeatureLayout(this.snake);
    const motion = getMotionProfile(this.snake);
    const headWave = Math.sin(now * motion.headBounceFreq + this.snake.len * 0.07);
    const headScaleX = sizeScale * headScale * featureLayout.headScale * (1 + headWave * motion.headBounceAmp);
    const headScaleY = sizeScale * headScale * featureLayout.headScale * (1 - headWave * motion.headBounceAmp * 0.7);
    const eyeMode = style.eyeMode || "round";
    const mouthMode = style.mouthMode || (style.mood === "angry" ? "angry" : style.mood === "smile" ? "smile" : "none");
    const eyeTint = style.eyeTint ?? 0xffffff;
    const mouthTint = style.mouthTint ?? 0x04080f;
    const headBob = headWave * motion.headBobAmp;

    this.headContainer.position.set(
      head.x + Math.cos(this.snake.angle) * headBob,
      head.y + Math.sin(this.snake.angle) * headBob
    );
    this.headContainer.rotation = this.snake.angle;
    this.headContainer.scale.set(headScaleX, headScaleY);
    this.headShadow.tint = style.shadowTint;
    this.headShadow.alpha = style.shadowAlpha;
    this.headBase.tint = style.baseTint;
    this.headBase.alpha = style.baseAlpha;
    this.headGloss.alpha = style.glossAlpha;
    this.headGloss.position.set(featureLayout.glossX, featureLayout.glossY);
    this.headGloss.scale.set(featureLayout.glossScaleX, featureLayout.glossScaleY);
    this.headStripes.visible = style.stripeVisible;
    this.headStripes.alpha = style.stripeAlpha;
    this.headStripes.tint = style.stripeTint;
    this.leftEye.texture = eyeMode === "happy_closed" ? this.eyeClosedTex : this.eyeWhiteTex;
    this.rightEye.texture = eyeMode === "happy_closed" ? this.eyeClosedTex : this.eyeWhiteTex;
    this.leftEye.tint = eyeMode === "happy_closed" ? eyeTint : 0xffffff;
    this.rightEye.tint = eyeMode === "happy_closed" ? eyeTint : 0xffffff;
    this.leftEye.position.set(featureLayout.eyeForward, -featureLayout.eyeOffset);
    this.rightEye.position.set(featureLayout.eyeForward, featureLayout.eyeOffset);
    this.leftPupil.position.set(featureLayout.eyeForward + featureLayout.pupilForward, -featureLayout.eyeOffset);
    this.rightPupil.position.set(featureLayout.eyeForward + featureLayout.pupilForward, featureLayout.eyeOffset);
    this.leftEyeSpark.position.set(featureLayout.eyeForward - CFG.SR * 0.04, -featureLayout.eyeOffset - CFG.SR * 0.09);
    this.rightEyeSpark.position.set(featureLayout.eyeForward - CFG.SR * 0.04, featureLayout.eyeOffset - CFG.SR * 0.09);
    this.leftEye.scale.set(featureLayout.eyeScale);
    this.rightEye.scale.set(featureLayout.eyeScale);
    this.leftPupil.scale.set(featureLayout.pupilScale);
    this.rightPupil.scale.set(featureLayout.pupilScale);
    this.leftEyeSpark.scale.set(featureLayout.sparkScale);
    this.rightEyeSpark.scale.set(featureLayout.sparkScale);
    this.leftPupil.visible = eyeMode !== "happy_closed";
    this.rightPupil.visible = eyeMode !== "happy_closed";
    this.leftEyeSpark.visible = eyeMode !== "happy_closed";
    this.rightEyeSpark.visible = eyeMode !== "happy_closed";
    this.mouthSmile.position.set(featureLayout.mouthX, featureLayout.mouthY);
    this.mouthAngry.position.set(featureLayout.mouthX, featureLayout.mouthY);
    this.mouthBigSmile.position.set(featureLayout.mouthX, featureLayout.mouthY);
    this.mouthSmile.scale.set(featureLayout.mouthScale);
    this.mouthAngry.scale.set(featureLayout.mouthScale);
    this.mouthBigSmile.scale.set(featureLayout.mouthScale);
    this.mouthSmile.tint = mouthTint;
    this.mouthAngry.tint = mouthTint;
    this.mouthBigSmile.tint = mouthTint;
    this.mouthSmile.visible = mouthMode === "smile";
    this.mouthAngry.visible = mouthMode === "angry";
    this.mouthBigSmile.visible = mouthMode === "big_smile";

    if (this.snake.boosting || buffed || style.auraIdleAlpha > 0) {
      const auraColor = buffed ? 0xffd060 : style.auraColor;
      const auraAlpha = buffed
        ? style.auraBuffAlpha
        : this.snake.boosting
          ? style.auraBoostAlpha
          : style.auraIdleAlpha;
      this.headAura.visible = true;
      this.headAura.clear();
      for (let i = 0; i < Math.min(8, this.snake.segs.length - 1); i++) {
        const alpha = (1 - i / 8) * auraAlpha;
        this.headAura.lineStyle(style.auraWidth * sizeScale * (1 - i * 0.09), auraColor, alpha);
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
    const hitMix = this.snake.hitFlashTicks > 0 ? Math.min(0.55, this.snake.hitFlashTicks / 12) : 0;
    const sizeScale = this.snake.sizeScale ?? 1;
    const motion = getMotionProfile(this.snake);
    if (this.snake.hitFlashTicks > 0) this.snake.hitFlashTicks--;

    for (let i = 0; i < bodyCount; i++) {
      const segIdx = segs.length - 1 - i;
      const seg = segs[segIdx];
      const sprite = this.sprites[i];
      const t = i * invBodyCount;
      const style = getSegmentStyle(this.snake, i, t, buffed, rainbowPhase);
      const pulse = motion.segmentPulseAmp > 0
        ? Math.sin(now * motion.segmentPulseFreq + i * motion.segmentPulsePhase) * motion.segmentPulseAmp
        : 0;
      sprite.visible = true;
      sprite.position.set(seg.x, seg.y);
      sprite.scale.set(style.scale * sizeScale * (1 + pulse));
      sprite.tint = hitMix > 0 ? mixHex(style.tint, 0xff5a66, hitMix) : style.tint;
      sprite.alpha = style.alpha;
    }

    this.updateHead(buffed, now);

    if (hitMix > 0) {
      this.headBase.tint = mixHex(this.headBase.tint, 0xff6a6a, hitMix);
      this.headShadow.tint = mixHex(this.headShadow.tint, 0x6b1118, Math.min(0.45, hitMix));
    }

    if (this.nameText) {
      const head = segs[0];
      this.nameText.position.set(head.x, head.y - CFG.SR * 2.8 * sizeScale);
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
