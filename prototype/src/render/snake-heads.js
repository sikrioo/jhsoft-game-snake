import { hslHex } from "../core/utils.js";

export function drawHeads(headLayer, snakeList, segmentRadius) {
  headLayer.clear();
  const now = Date.now();

  for (const snake of snakeList) {
    if (snake.dead || snake.segs.length < 1) continue;

    const segs = snake.segs;
    const buffed = snake.speedBuff > 0;
    const hue = buffed
      ? 45
      : snake.skin.pattern === "rainbow"
        ? (now * 0.12) % 360
        : snake.skin.pattern === "ghost"
          ? 188
          : snake.skin.pattern === "zebra"
            ? 220
            : snake.skin.hue;
    const baseLight = snake.skin.pattern === "ghost"
      ? 86
      : snake.skin.pattern === "zebra"
        ? 92
        : snake.isPlayer ? 63 : 52;
    const baseSat = snake.skin.pattern === "ghost"
      ? 38
      : snake.skin.pattern === "zebra"
        ? 14
        : 88;
    const shadowLight = snake.skin.pattern === "ghost" ? 18 : snake.skin.pattern === "zebra" ? 8 : 10;
    const headAlpha = snake.skin.pattern === "ghost" ? 0.72 : 1;
    const hx = segs[0].x;
    const hy = segs[0].y;
    const r = segmentRadius;

    if (snake.boosting || buffed) {
      const auraColor = buffed ? 0xffd060 : 0x00ffc8;
      for (let i = 0; i < Math.min(8, segs.length - 1); i++) {
        const alpha = (1 - i / 8) * (snake.boosting ? 0.13 : 0.09);
        headLayer.lineStyle(r * 3.6 * (1 - i * 0.09), auraColor, alpha);
        headLayer.moveTo(segs[i].x, segs[i].y);
        headLayer.lineTo(segs[i + 1].x, segs[i + 1].y);
      }
      headLayer.lineStyle(0);
    }

    headLayer.beginFill(hslHex(hue, snake.skin.pattern === "ghost" ? 24 : 70, shadowLight), snake.skin.pattern === "ghost" ? 0.32 : 0.55);
    headLayer.drawEllipse(hx + 1.5, hy + 1.5, r * 1.7, r * 1.2);
    headLayer.endFill();

    headLayer.beginFill(hslHex(hue, baseSat, baseLight), headAlpha);
    headLayer.drawEllipse(hx, hy, r * 1.7, r * 1.2);
    headLayer.endFill();

    if (snake.skin.pattern === "zebra") {
      headLayer.beginFill(0x0f1118, 0.92);
      headLayer.drawEllipse(hx - r * 0.25, hy, r * 0.18, r * 1.05);
      headLayer.drawEllipse(hx + r * 0.2, hy, r * 0.16, r * 1.02);
      headLayer.drawEllipse(hx + r * 0.62, hy, r * 0.13, r * 0.94);
      headLayer.endFill();
    }

    headLayer.beginFill(0xffffff, snake.skin.pattern === "ghost" ? 0.4 : snake.isPlayer ? 0.27 : 0.16);
    headLayer.drawCircle(hx - r * 0.26, hy - r * 0.28, r * 0.5);
    headLayer.endFill();

    const pp = snake.angle + Math.PI / 2;
    const eyeForward = r * 0.44;
    const eyeOffset = r * 0.54;

    for (let side = -1; side <= 1; side += 2) {
      const ex = hx + Math.cos(snake.angle) * eyeForward + Math.cos(pp) * eyeOffset * side;
      const ey = hy + Math.sin(snake.angle) * eyeForward + Math.sin(pp) * eyeOffset * side;
      headLayer.beginFill(0xffffff, 1);
      headLayer.drawCircle(ex, ey, r * 0.32);
      headLayer.endFill();
      headLayer.beginFill(0x080810, 1);
      headLayer.drawCircle(ex + Math.cos(snake.angle) * r * 0.13, ey + Math.sin(snake.angle) * r * 0.13, r * 0.16);
      headLayer.endFill();
      headLayer.beginFill(0xffffff, 0.92);
      headLayer.drawCircle(ex + Math.cos(snake.angle) * r * 0.04 - r * 0.08, ey + Math.sin(snake.angle) * r * 0.04 - r * 0.09, r * 0.075);
      headLayer.endFill();
    }

    const mood = snake.skin.mood;
    if (mood === "smile" || mood === "angry") {
      const fx = hx + Math.cos(snake.angle) * r * 0.9;
      const fy = hy + Math.sin(snake.angle) * r * 0.9;
      const pp2 = snake.angle + Math.PI / 2;
      headLayer.lineStyle(2, 0x04080f, 0.82);

      if (mood === "smile") {
        headLayer.arc(fx + Math.cos(snake.angle) * r * 0.08, fy + Math.sin(snake.angle) * r * 0.08, r * 0.42, snake.angle + 0.28 * Math.PI, snake.angle + 0.72 * Math.PI);
      } else {
        headLayer.moveTo(fx + Math.cos(pp2) * -r * 0.4, fy + Math.sin(pp2) * -r * 0.4);
        headLayer.lineTo(fx + Math.cos(pp2) * r * 0.4, fy + Math.sin(pp2) * r * 0.4);
      }

      headLayer.lineStyle(0);
    }
  }
}
