import { SKINS } from "./config/skins.js";
import { SESSION_MODES } from "./network/protocol.js";
import { createScene } from "./render/scene.js";
import { TextureStore } from "./render/textures.js";
import { createSession } from "./session/create-session.js";
import { GameUI } from "./ui/game-ui.js";

const MODES = [
  {
    id: SESSION_MODES.LOCAL,
    name: "SINGLE",
    desc: "Classic solo freeplay with bots and food across the full arena.",
    tag: "Available now",
  },
  {
    id: SESSION_MODES.SURVIVAL,
    name: "SURVIVAL",
    desc: "Wave-based endurance mode. Stronger snakes keep coming until the timer ends.",
    tag: "Available now",
  },
  {
    id: SESSION_MODES.ONLINE,
    name: "ONLINE",
    desc: "Join the live arena and compete against connected players in real time.",
    tag: "Available now",
  },
];

const MODE_LABELS = {
  [SESSION_MODES.LOCAL]: "Single Mode",
  [SESSION_MODES.SURVIVAL]: "Single Mode · Survival",
  [SESSION_MODES.ONLINE]: "Online Mode",
};

const scene = createScene();
const textures = new TextureStore(scene.app);
const ui = new GameUI(document);
const params = new URLSearchParams(location.search);
const requestedMode = params.get("mode");

let selectedSkin = SKINS[0];
let selectedMode = MODES.some((mode) => mode.id === requestedMode) ? requestedMode : SESSION_MODES.LOCAL;
let session = null;
let sessionAttached = false;

function getPlayerName() {
  const raw = ui.dom.nameInput?.value?.trim() || "";
  return raw.slice(0, 16) || "PLAYER";
}

function isModeAvailable(modeId) {
  return true;
}

function updateModeCopy() {
  const selected = MODES.find((mode) => mode.id === selectedMode) || MODES[0];
  if (selectedMode === SESSION_MODES.SURVIVAL) {
    ui.setModeNote("Survive 10 minutes across 5 escalating waves. Gate warnings show where the next snakes will emerge.", "warn");
  } else {
    ui.setModeNote(selected.id === SESSION_MODES.ONLINE
      ? "Online mode connects through the local server and uses your selected nickname and skin."
      : "Single mode starts instantly with local bots and your selected skin.");
  }

  ui.setSetupMeta(`${MODE_LABELS[selectedMode]} · ${getPlayerName()}`);
  ui.setStartButtonState({
    label: "START",
    disabled: false,
  });
}

function ensureSession() {
  if (session && session.mode === selectedMode) return session;

  session = createSession({
    mode: selectedMode,
    scene,
    textures,
    ui,
    selectedSkinRef: () => selectedSkin,
    playerNameRef: () => getPlayerName(),
  });

  if (!sessionAttached) {
    session.attach();
    sessionAttached = true;
  }

  return session;
}

function renderModes() {
  ui.renderModes(MODES, selectedMode, (modeId) => {
    selectedMode = modeId;
    renderModes();
    updateModeCopy();
  });
}

function renderSkins() {
  ui.renderSkins(SKINS, selectedSkin, (skinId) => {
    selectedSkin = SKINS.find((skin) => skin.id === skinId) || SKINS[0];
    renderSkins();
  });
}

function goToIntroStep() {
  ui.showStartScreen();
  ui.setSetupStep("intro");
  ui.setSetupSubtitle("CHOOSE MODE AND NICKNAME");
  updateModeCopy();
  ui.focusNameInput();
}

function goToSkinStep() {
  ui.setSetupStep("skin");
  ui.setSetupSubtitle("SELECT SNAKE AND START");
  updateModeCopy();
}

function handleNext() {
  goToSkinStep();
}

function handleBack() {
  goToIntroStep();
}

function handleStart() {
  if (!isModeAvailable(selectedMode)) {
    updateModeCopy();
    return;
  }

  const activeSession = ensureSession();
  activeSession.start();
}

if (ui.dom.nameInput) {
  ui.dom.nameInput.value = "PLAYER";
  ui.dom.nameInput.addEventListener("input", () => updateModeCopy());
  ui.dom.nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (ui.dom.introStep && !ui.dom.introStep.classList.contains("h")) handleNext();
      else if (!ui.dom.startBtn.disabled) handleStart();
    }
  });
}

ui.dom.nextBtn?.addEventListener("click", handleNext);
ui.dom.backBtn?.addEventListener("click", handleBack);
ui.dom.startBtn?.addEventListener("click", handleStart);

renderModes();
renderSkins();
goToIntroStep();
