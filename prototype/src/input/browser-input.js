export class BrowserInputController {
  constructor({ onPointerMove }) {
    this.onPointerMove = onPointerMove;
    this.state = {
      pointerX: innerWidth / 2,
      pointerY: innerHeight / 2,
      boostHeld: false,
      boostToggle: false,
    };
  }

  attach() {
    addEventListener("mousemove", (event) => {
      this.state.pointerX = event.clientX;
      this.state.pointerY = event.clientY;
      if (this.onPointerMove) this.onPointerMove(event.clientX, event.clientY);
    });

    addEventListener("mousedown", (event) => {
      if (event.button === 0) this.state.boostHeld = true;
    });

    addEventListener("mouseup", (event) => {
      if (event.button === 0) this.state.boostHeld = false;
    });

    addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        this.state.boostHeld = true;
        event.preventDefault();
      }
      if (event.code === "KeyQ") this.state.boostToggle = !this.state.boostToggle;
    });

    addEventListener("keyup", (event) => {
      if (event.code === "Space") this.state.boostHeld = false;
    });
  }

  getState() {
    return { ...this.state };
  }

  reset() {
    this.state.pointerX = innerWidth / 2;
    this.state.pointerY = innerHeight / 2;
    this.state.boostHeld = false;
    this.state.boostToggle = false;
    if (this.onPointerMove) this.onPointerMove(this.state.pointerX, this.state.pointerY);
  }
}
