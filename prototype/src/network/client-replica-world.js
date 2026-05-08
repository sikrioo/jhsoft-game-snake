import { lerp, lerpA } from "../core/utils.js";
import { NET_CFG } from "./protocol.js";
import { SnakeBody } from "../entities/snake-body.js";

class FoodReplica {
  constructor(food, { layers, textures }) {
    this.id = food.id;
    this.type = food.type;
    this.x = food.x;
    this.y = food.y;
    this.r = food.r;
    this.color = food.color;
    this.tx = food.x;
    this.ty = food.y;
    this.sp = this.type === "star"
      ? new PIXI.Sprite(textures.getStarTex())
      : new PIXI.Sprite(textures.getCircleTex(this.color, Math.ceil(this.r), 0.18));
    this.sp.anchor.set(0.5);
    this.sp.position.set(this.x, this.y);
    layers.food.addChild(this.sp);
    this.ph = Math.random() * Math.PI * 2;
    this.ps = 0.05;
  }

  updateFromSnapshot(food) {
    this.tx = food.x;
    this.ty = food.y;
  }

  tick() {
    this.x = lerp(this.x, this.tx, NET_CFG.FOOD_INTERP_ALPHA);
    this.y = lerp(this.y, this.ty, NET_CFG.FOOD_INTERP_ALPHA);
    this.sp.position.set(this.x, this.y);
    this.ph += this.ps;
    this.sp.scale.set(1 + 0.2 * Math.sin(this.ph));
    if (this.type === "star") this.sp.rotation += 0.025;
  }

  destroy() {
    this.sp.destroy();
  }
}

class SnakeReplica {
  constructor(snapshot, renderContext) {
    this.renderContext = renderContext;
    this.id = snapshot.id;
    this.name = snapshot.name;
    this.skin = snapshot.skin;
    this.isPlayer = snapshot.isPlayer;
    this.dead = snapshot.dead;
    this.speedBuff = snapshot.speedBuff;
    this.boosting = snapshot.boosting;
    this.angle = snapshot.angle;
    this.targetAngle = snapshot.angle;
    this.segs = snapshot.segs.map((seg) => ({ ...seg }));
    this.targetSegs = snapshot.segs.map((seg) => ({ ...seg }));
    this.showNameTag = true;
    this.body = new SnakeBody(this, renderContext);
    if (this.dead && this.body?.setVisible) this.body.setVisible(false);
  }

  get head() {
    return this.segs[0];
  }

  get len() {
    return this.segs.length;
  }

  updateFromSnapshot(snapshot) {
    const wasDead = this.dead;
    this.name = snapshot.name;
    this.skin = snapshot.skin;
    this.isPlayer = snapshot.isPlayer;
    this.dead = snapshot.dead;
    this.speedBuff = snapshot.speedBuff;
    this.boosting = snapshot.boosting;
    this.targetAngle = snapshot.angle;
    if (this.targetSegs.length !== snapshot.segs.length) {
      this.segs = snapshot.segs.map((seg) => ({ ...seg }));
      this.targetSegs = snapshot.segs.map((seg) => ({ ...seg }));
    } else {
      this.targetSegs = snapshot.segs.map((seg) => ({ ...seg }));
    }

    if (!wasDead && this.dead && this.body?.setVisible) {
      this.body.setVisible(false);
    }
    if (wasDead && !this.dead && this.body?.setVisible) {
      this.body.setVisible(true);
    }
  }

  tick(alpha) {
    this.angle = lerpA(this.angle, this.targetAngle, alpha);
    for (let i = 0; i < this.segs.length; i++) {
      this.segs[i].x = lerp(this.segs[i].x, this.targetSegs[i].x, alpha);
      this.segs[i].y = lerp(this.segs[i].y, this.targetSegs[i].y, alpha);
    }
  }

  destroy() {
    this.body.destroy();
  }
}

export class ClientReplicaWorld {
  constructor(renderContext, events = {}) {
    this.renderContext = renderContext;
    this.events = {
      onSnakeDeath: () => {},
      ...events,
    };
    this.snakes = new Map();
    this.foods = new Map();
    this.stars = new Map();
    this.frameId = 0;
  }

  reconcileMap(targetMap, sourceList, createEntity) {
    const incoming = new Set(sourceList.map((item) => item.id));
    for (const [id, entity] of targetMap.entries()) {
      if (!incoming.has(id)) {
        entity.destroy();
        targetMap.delete(id);
      }
    }

    for (const item of sourceList) {
      let entity = targetMap.get(item.id);
      if (!entity) {
        entity = createEntity(item);
        targetMap.set(item.id, entity);
      } else {
        if (!entity.dead && item.dead) this.events.onSnakeDeath(entity, item);
        entity.updateFromSnapshot(item);
      }
    }
  }

  applySnapshot(snapshot) {
    this.reconcileMap(this.snakes, snapshot.snakes, (item) => new SnakeReplica(item, this.renderContext));
    this.reconcileMap(this.foods, snapshot.foods, (item) => new FoodReplica(item, this.renderContext));
    this.reconcileMap(this.stars, snapshot.stars, (item) => new FoodReplica(item, this.renderContext));
  }

  tick(selfId) {
    this.frameId += 1;
    for (const snake of this.snakes.values()) {
      const alpha = snake.id === selfId ? NET_CFG.SELF_INTERP_ALPHA : NET_CFG.REMOTE_INTERP_ALPHA;
      snake.tick(alpha);
    }
    for (const food of this.foods.values()) food.tick(this.frameId);
    for (const star of this.stars.values()) star.tick(this.frameId);
  }

  getSnakeList() {
    return [...this.snakes.values()];
  }

  getFoodList() {
    return [...this.foods.values()];
  }

  getStarList() {
    return [...this.stars.values()];
  }
}
