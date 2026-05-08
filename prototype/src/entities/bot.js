import { CFG } from "../config/game-config.js";
import { SKINS } from "../config/skins.js";
import { dist, rnd, rndI } from "../core/utils.js";
import { Snake } from "./snake.js";

export class Bot extends Snake {
  constructor({ renderContext, spawnFood }) {
    const angle = Math.random() * Math.PI * 2;
    const distance = rnd(200, CFG.WR * 0.75);
    super({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      len: rndI(18, 52),
      skin: SKINS[rndI(0, SKINS.length)],
      name: CFG.BOT_NAMES[rndI(0, CFG.BOT_NAMES.length)],
      isPlayer: false,
      renderContext,
      spawnFood,
    });
    this.ta = this.angle;
    this.thinkT = 0;
    this.pers = Math.random();
  }

  think(context) {
    if (--this.thinkT > 0) return;
    this.thinkT = rndI(12, 28);

    const { x, y } = this.head;
    const { foodsGrid, stars, player } = context;

    if (Math.hypot(x, y) > CFG.WR - 220) {
      this.ta = Math.atan2(-y, -x);
      this.boosting = this.len > CFG.MIN_LEN + 10 && Math.random() < 0.5;
      return;
    }

    if (stars.length && Math.random() < 0.28) {
      let best = null;
      let bestDist = 1e9;
      for (const star of stars) {
        const d = dist(x, y, star.x, star.y);
        if (d < bestDist) {
          bestDist = d;
          best = star;
        }
      }
      if (best && bestDist < 380) {
        this.ta = Math.atan2(best.y - y, best.x - x);
        return;
      }
    }

    if (player && !player.dead && this.pers > 0.58) {
      const d = dist(x, y, player.head.x, player.head.y);
      if (d < 380) {
        this.ta = Math.atan2(player.head.y - y, player.head.x - x);
        this.boosting = d < 180 && this.len > CFG.MIN_LEN + 5;
        return;
      }
    }

    const nearbyFood = foodsGrid.near(x, y, 300);
    let bestFood = null;
    let bestFoodDist = 1e9;
    for (const food of nearbyFood) {
      const d = dist(x, y, food.x, food.y);
      if (d < bestFoodDist) {
        bestFoodDist = d;
        bestFood = food;
      }
    }

    if (bestFood) this.ta = Math.atan2(bestFood.y - y, bestFood.x - x);
    else this.ta += rnd(-0.6, 0.6);

    this.boosting = this.len > CFG.MIN_LEN + 8 && Math.random() < 0.08;
  }

  update(context) {
    if (this.dead) return;
    this.think(context);
    this.steer(this.ta, 0.07 + this.pers * 0.04);
    if (this.boosting) this.shrink(1, { compactDrops: true });
    else this.flushCompactDropCarry();
    this.move();
  }
}
