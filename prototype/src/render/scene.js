export function createScene() {
  let width = innerWidth;
  let height = innerHeight;
  let resizeHandler = null;

  const app = new PIXI.Application({
    width,
    height,
    backgroundColor: 0x030609,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(devicePixelRatio || 1, 2),
    powerPreference: "high-performance",
  });

  app.view.id = "pixi-canvas";
  document.body.appendChild(app.view);

  const world = new PIXI.Container();
  app.stage.addChild(world);

  const layers = {
    background: new PIXI.Graphics(),
    food: new PIXI.Container(),
    bodies: new PIXI.Container(),
    fx: new PIXI.Container(),
    heads: new PIXI.Container(),
    names: new PIXI.Container(),
  };

  world.addChild(layers.background, layers.food, layers.bodies, layers.fx, layers.heads, layers.names);

  addEventListener("resize", () => {
    width = innerWidth;
    height = innerHeight;
    app.renderer.resize(width, height);
    if (resizeHandler) resizeHandler({ width, height });
  });

  return {
    app,
    world,
    layers,
    get size() {
      return { width, height };
    },
    setResizeHandler(handler) {
      resizeHandler = handler;
    },
  };
}
