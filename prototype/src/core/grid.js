export class Grid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.map = new Map();
  }

  key(x, y) {
    const cx = (x / this.cellSize) | 0;
    const cy = (y / this.cellSize) | 0;
    return (cx + 4096) * 8192 + (cy + 4096);
  }

  add(x, y, data) {
    const key = this.key(x, y);
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(data);
  }

  near(x, y, radius) {
    const range = Math.ceil(radius / this.cellSize);
    const cx = (x / this.cellSize) | 0;
    const cy = (y / this.cellSize) | 0;
    const results = [];

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const bucket = this.map.get((cx + dx + 4096) * 8192 + (cy + dy + 4096));
        if (!bucket) continue;
        for (const item of bucket) results.push(item);
      }
    }

    return results;
  }

  clear() {
    this.map.clear();
  }
}
