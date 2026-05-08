export function drawBackground(layer, cfg, cam, viewport) {
  layer.clear();

  const gs = 100;
  const effectiveGs = cam.zoom < 0.55 ? gs * 3 : cam.zoom < 0.8 ? gs * 2 : gs;
  const margin = effectiveGs * 2;
  const x0 = Math.floor((cam.x - viewport.width / (2 * cam.zoom) - margin) / effectiveGs) * effectiveGs;
  const y0 = Math.floor((cam.y - viewport.height / (2 * cam.zoom) - margin) / effectiveGs) * effectiveGs;
  const x1 = cam.x + viewport.width / (2 * cam.zoom) + margin;
  const y1 = cam.y + viewport.height / (2 * cam.zoom) + margin;

  if (cam.zoom > 0.38) {
    layer.beginFill(0x00ffc8, 0.055);
    for (let x = x0; x <= x1; x += effectiveGs) {
      for (let y = y0; y <= y1; y += effectiveGs) layer.drawCircle(x, y, 1.4);
    }
    layer.endFill();
  }

  layer.lineStyle(52 / cam.zoom, 0xff3c5a, 0.05);
  layer.drawCircle(0, 0, cfg.WR + 26);
  layer.lineStyle(2.5 / cam.zoom, 0xff3c5a, 0.46);
  layer.drawCircle(0, 0, cfg.WR);
  layer.lineStyle(1.2 / cam.zoom, 0xff3c5a, 0.18);
  layer.drawCircle(0, 0, cfg.WR + 85);
  layer.lineStyle(0);
}
