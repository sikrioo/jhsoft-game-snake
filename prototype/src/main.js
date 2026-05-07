import { SKINS } from "./config/skins.js";
import { SESSION_MODES } from "./network/protocol.js";
import { createScene } from "./render/scene.js";
import { TextureStore } from "./render/textures.js";
import { createSession } from "./session/create-session.js";
import { GameUI } from "./ui/game-ui.js";

const scene = createScene();
const textures = new TextureStore(scene.app);
const ui = new GameUI(document);
const params = new URLSearchParams(location.search);
const mode = params.get("mode") === SESSION_MODES.ONLINE ? SESSION_MODES.ONLINE : SESSION_MODES.LOCAL;

let selectedSkin = SKINS[0];

function getPlayerName() {
  const raw = ui.dom.nameInput?.value?.trim() || "";
  return raw.slice(0, 16) || "PLAYER";
}

const session = createSession({
  mode,
  scene,
  textures,
  ui,
  selectedSkinRef: () => selectedSkin,
  playerNameRef: () => getPlayerName(),
});

if (ui.dom.nameInput) ui.dom.nameInput.value = "PLAYER";
ui.focusNameInput();

function renderSkins() {
  ui.renderSkins(SKINS, selectedSkin, (skinId) => {
    selectedSkin = SKINS.find((skin) => skin.id === skinId) || SKINS[0];
    renderSkins();
  });
}

renderSkins();
session.attach();
