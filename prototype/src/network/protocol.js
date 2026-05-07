export const SESSION_MODES = {
  LOCAL: "local",
  ONLINE: "online",
};

export const MESSAGE_TYPES = {
  JOIN: "join",
  INPUT: "input",
  SNAPSHOT: "snapshot",
  ERROR: "error",
};

export const NET_CFG = {
  TICK_RATE: 60,
  WS_PATH: "/ws",
  SELF_INTERP_ALPHA: 0.55,
  REMOTE_INTERP_ALPHA: 0.35,
  FOOD_INTERP_ALPHA: 0.4,
};

export function createPlayerCommand({ targetAngle = 0, boosting = false } = {}) {
  return { targetAngle, boosting };
}

export function serializeSnake(snake, extras = {}) {
  return {
    id: extras.id ?? null,
    name: snake.name,
    skin: snake.skin,
    isPlayer: snake.isPlayer,
    dead: snake.dead,
    speedBuff: snake.speedBuff,
    boosting: snake.boosting,
    angle: snake.angle,
    segs: snake.segs.map((seg) => ({ x: seg.x, y: seg.y })),
    len: snake.len,
    ...extras,
  };
}

export function serializeFood(food, extras = {}) {
  return {
    id: extras.id ?? null,
    x: food.x,
    y: food.y,
    type: food.type,
    r: food.r,
    val: food.val,
    color: food.color,
    ...extras,
  };
}

export function getPlayerViewState(playerState) {
  if (!playerState) {
    return { score: 0, kills: 0, boostE: 0, respawnTicks: 0 };
  }

  return {
    score: playerState.score,
    kills: playerState.kills,
    boostE: playerState.boostE,
    respawnTicks: playerState.respawnTicks ?? 0,
  };
}

export function serializeSimulationSnapshot(simulation) {
  return {
    state: simulation.state,
    score: simulation.score,
    kills: simulation.kills,
    boostE: simulation.boostE,
    player: simulation.player,
    bots: simulation.bots,
    foods: simulation.foods,
    stars: simulation.stars,
  };
}

export function encodeMessage(type, payload = {}) {
  return JSON.stringify({ type, ...payload });
}

export function decodeMessage(raw) {
  return JSON.parse(raw.toString());
}
