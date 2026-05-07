export class GameUI {
  constructor(doc) {
    this.doc = doc;
    this.dom = {
      cur: doc.getElementById("cur"),
      flash: doc.getElementById("flash"),
      mblur: doc.getElementById("mblur"),
      sbuff: doc.getElementById("sbuff"),
      hLen: doc.getElementById("hLen"),
      hScr: doc.getElementById("hScr"),
      bpct: doc.getElementById("bpct"),
      bfil: doc.getElementById("bfil"),
      sbtrk: doc.getElementById("sbtrk"),
      sbfil: doc.getElementById("sbfil"),
      lbr: doc.getElementById("lbr"),
      mmc: doc.getElementById("mmc"),
      kf: doc.getElementById("kf"),
      ss: doc.getElementById("ss"),
      ds: doc.getElementById("ds"),
      dLen: doc.getElementById("dLen"),
      dScr: doc.getElementById("dScr"),
      dKil: doc.getElementById("dKil"),
      skinGrid: doc.getElementById("skinGrid"),
      nameInput: doc.getElementById("nameInput"),
      startBtn: doc.getElementById("startBtn"),
      retryBtn: doc.getElementById("retryBtn"),
    };
    this.mmx = this.dom.mmc.getContext("2d");
    this.flashTO = null;
    this.speedBuffTO = null;
  }

  moveCursor(x, y) {
    this.dom.cur.style.left = `${x}px`;
    this.dom.cur.style.top = `${y}px`;
  }

  updateHUD({ player, score, boostE, boostDuration }) {
    if (!player || player.dead) return;
    this.dom.hLen.textContent = player.len;
    this.dom.hScr.textContent = score;

    const boostPct = Math.round(boostE);
    this.dom.bpct.textContent = `${boostPct}%`;
    this.dom.bfil.style.width = `${boostPct}%`;
    this.dom.bfil.classList.toggle("low", boostE < 30);

    if (player.speedBuff > 0) {
      this.dom.sbtrk.style.display = "block";
      this.dom.sbfil.style.width = `${(player.speedBuff / boostDuration) * 100}%`;
    } else {
      this.dom.sbtrk.style.display = "none";
    }

    this.dom.cur.classList.toggle("b", player.boosting);
    this.dom.cur.classList.toggle("s", player.speedBuff > 0 && !player.boosting);
  }

  updateLeaderboard(player, bots) {
    const all = [
      { name: player?.name || "YOU", len: player ? player.len : 0, me: true },
      ...bots.filter((bot) => !bot.dead).map((bot) => ({ name: bot.name, len: bot.len, me: false })),
    ];
    all.sort((a, b) => b.len - a.len);
    this.dom.lbr.innerHTML = all.slice(0, 8).map((entry, index) => (
      `<div class="lr${entry.me ? " me" : ""}"><span class="lrk">#${index + 1}</span><span class="lrn">${entry.name}</span><span class="lrs">${entry.len}</span></div>`
    )).join("");
  }

  drawMinimap({ cfg, foods, stars, bots, player, cam, viewport }) {
    const mw = this.dom.mmc.width;
    const mh = this.dom.mmc.height;
    this.mmx.clearRect(0, 0, mw, mh);
    this.mmx.fillStyle = "rgba(4,8,15,.94)";
    this.mmx.fillRect(0, 0, mw, mh);
    this.mmx.save();
    this.mmx.beginPath();
    this.mmx.arc(mw / 2, mh / 2, mw / 2 - 1, 0, Math.PI * 2);
    this.mmx.clip();

    const scale = mw / (cfg.WR * 2);
    const tx = (v) => mw / 2 + v * scale;
    const ty = (v) => mh / 2 + v * scale;

    this.mmx.strokeStyle = "rgba(0,255,200,.06)";
    this.mmx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      this.mmx.beginPath();
      this.mmx.arc(mw / 2, mh / 2, (mw / 2) * (i / 4), 0, Math.PI * 2);
      this.mmx.stroke();
    }

    this.mmx.fillStyle = "rgba(0,255,200,.18)";
    for (let i = 0; i < foods.length; i += 3) this.mmx.fillRect(tx(foods[i].x) - 0.5, ty(foods[i].y) - 0.5, 1, 1);

    for (const star of stars) {
      this.mmx.beginPath();
      this.mmx.arc(tx(star.x), ty(star.y), 3, 0, Math.PI * 2);
      this.mmx.fillStyle = "#ffd060";
      this.mmx.shadowColor = "#ffd060";
      this.mmx.shadowBlur = 6;
      this.mmx.fill();
      this.mmx.shadowBlur = 0;
    }

    for (const bot of bots) {
      if (bot.dead) continue;
      this.mmx.beginPath();
      this.mmx.arc(tx(bot.head.x), ty(bot.head.y), 2.8, 0, Math.PI * 2);
      this.mmx.fillStyle = `hsl(${bot.skin.hue},70%,55%)`;
      this.mmx.fill();
    }

    if (player) {
      this.mmx.beginPath();
      this.mmx.arc(tx(player.head.x), ty(player.head.y), player.dead ? 3.5 : 5, 0, Math.PI * 2);
      this.mmx.fillStyle = player.dead ? "#ff3c5a" : "#fff";
      this.mmx.shadowColor = player.dead ? "#ff3c5a" : "#00ffc8";
      this.mmx.shadowBlur = 9;
      this.mmx.fill();
      this.mmx.shadowBlur = 0;

      const vw = (viewport.width / cam.zoom) * scale;
      const vh = (viewport.height / cam.zoom) * scale;
      this.mmx.strokeStyle = "rgba(255,255,255,.44)";
      this.mmx.lineWidth = 1;
      this.mmx.strokeRect(tx(cam.x) - vw / 2, ty(cam.y) - vh / 2, vw, vh);
    }

    this.mmx.restore();
    this.mmx.beginPath();
    this.mmx.arc(mw / 2, mh / 2, mw / 2 - 1, 0, Math.PI * 2);
    this.mmx.strokeStyle = "rgba(0,255,200,.28)";
    this.mmx.lineWidth = 1;
    this.mmx.stroke();
  }

  flash(color = "rgba(0,255,200,0.13)") {
    this.dom.flash.style.background = `radial-gradient(ellipse at center,rgba(0,0,0,0) 28%,${color} 100%)`;
    this.dom.flash.classList.add("on");
    clearTimeout(this.flashTO);
    this.flashTO = setTimeout(() => this.dom.flash.classList.remove("on"), 90);
  }

  setMotionBlur(active) {
    this.dom.mblur.classList.toggle("on", active);
  }

  showSpeedBuff() {
    this.dom.sbuff.classList.add("on");
    clearTimeout(this.speedBuffTO);
    this.speedBuffTO = setTimeout(() => this.dom.sbuff.classList.remove("on"), 900);
  }

  addKillFeed(killer, victim, type = "normal") {
    const el = this.doc.createElement("div");
    el.className = `ki${type === "pk" ? " pk" : type === "sk" ? " sk" : ""}`;
    el.textContent = `${killer} -> ${victim}`;
    this.dom.kf.appendChild(el);
    setTimeout(() => el.remove(), 2900);
  }

  showDeathScreen({ player, score, kills }) {
    this.dom.dLen.textContent = player?.len || 0;
    this.dom.dScr.textContent = score;
    this.dom.dKil.textContent = kills;
    this.dom.ds.classList.remove("h");
  }

  hideStartScreen() {
    this.dom.ss.classList.add("h");
  }

  focusNameInput() {
    if (!this.dom.nameInput) return;
    setTimeout(() => {
      this.dom.nameInput.focus();
      this.dom.nameInput.select();
    }, 0);
  }

  hideDeathScreen() {
    this.dom.ds.classList.add("h");
  }

  resetTransientUI() {
    this.dom.sbtrk.style.display = "none";
    this.setMotionBlur(false);
  }

  clearKillFeed() {
    this.dom.kf.innerHTML = "";
  }

  renderSkins(skins, selectedSkin, onSelect) {
    this.dom.skinGrid.innerHTML = skins.map((skin) => `
      <div class="skinCard${skin.id === selectedSkin.id ? " on" : ""}" data-id="${skin.id}" style="--sc:${skin.css};--sp:${skin.sp}">
        <div class="skinPreview"></div>
        <div class="skinName">${skin.name}</div>
        <div class="skinDesc">${skin.desc}</div>
      </div>
    `).join("");

    this.dom.skinGrid.querySelectorAll(".skinCard").forEach((card) => {
      card.addEventListener("click", () => onSelect(card.dataset.id));
    });
  }
}
