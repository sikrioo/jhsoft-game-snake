export class Gate {
  constructor({ id, x, y, isCenter = false, renderContext }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.isCenter = isCenter;
    this.renderContext = renderContext;
    this.enabled = Boolean(renderContext?.layers?.gates && typeof PIXI !== "undefined");
    this.container = null;
    this.outer = null;
    this.inner = null;
    this.rift = null;
    this.rays = null;
    this.text = null;
    this.phase = Math.random() * Math.PI * 2;

    if (!this.enabled) return;

    this.container = new PIXI.Container();
    this.container.position.set(x, y);
    renderContext.layers.gates.addChild(this.container);

    this.outer = new PIXI.Graphics();
    this.outer.lineStyle(3, isCenter ? 0xff4e66 : 0x00ffc8, 0.32);
    this.outer.drawCircle(0, 0, isCenter ? 86 : 62);
    this.outer.lineStyle(0);
    this.container.addChild(this.outer);

    this.inner = new PIXI.Graphics();
    this.inner.beginFill(isCenter ? 0xff4e66 : 0x00ffc8, 0.09);
    this.inner.drawCircle(0, 0, isCenter ? 62 : 44);
    this.inner.endFill();
    this.container.addChild(this.inner);

    this.rift = new PIXI.Graphics();
    this.rift.beginFill(0x04060d, 0.9);
    this.rift.drawEllipse(0, 0, isCenter ? 48 : 34, isCenter ? 38 : 26);
    this.rift.endFill();
    this.container.addChild(this.rift);

    this.rays = new PIXI.Graphics();
    this.container.addChild(this.rays);

    this.text = new PIXI.Text(id.toUpperCase(), {
      fontFamily: "Orbitron",
      fontSize: isCenter ? 10 : 8,
      fontWeight: "700",
      fill: isCenter ? 0xff8e9c : 0x8dfdea,
      letterSpacing: 3,
      align: "center",
    });
    this.text.anchor.set(0.5, 0.5);
    this.text.position.set(0, isCenter ? -86 : -64);
    this.container.addChild(this.text);
  }

  update(view) {
    if (!this.enabled || !this.container) return;
    if (!view?.active) {
      this.container.visible = false;
      return;
    }

    this.container.visible = true;
    this.phase += 0.05;
    const pulse = 1 + Math.sin(this.phase) * 0.05;
    const ringBase = view.kind === "danger" ? 0xff4e66 : 0x00ffc8;
    const warn = view.state === "warning";
    const spawn = view.state === "spawn";
    const scale = warn ? 1.15 + Math.sin(this.phase * 2.4) * 0.08 : spawn ? 0.92 : pulse;
    const alpha = warn ? 0.95 : spawn ? 1 : 0.72;

    this.container.scale.set(scale);
    this.outer.tint = ringBase;
    this.outer.alpha = alpha;
    this.inner.tint = ringBase;
    this.inner.alpha = warn ? 0.24 : 0.14;
    this.rift.alpha = this.isCenter ? 0.92 : 0.82;
    this.container.rotation += this.isCenter ? 0.012 : 0.006;

    this.rays.clear();
    if (warn || spawn) {
      const rayColor = view.kind === "danger" ? 0xff7d6e : 0xffd060;
      const rayCount = this.isCenter ? 10 : 6;
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2 + this.phase * 0.35;
        const inner = this.isCenter ? 54 : 36;
        const outer = this.isCenter ? 104 : 74;
        this.rays.lineStyle(this.isCenter ? 3 : 2, rayColor, warn ? 0.34 : 0.5);
        this.rays.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        this.rays.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      }
      this.rays.lineStyle(0);
    }

    this.text.alpha = warn ? 0.94 : 0.48;
  }

  destroy() {
    if (this.container) this.container.destroy({ children: true });
  }
}
