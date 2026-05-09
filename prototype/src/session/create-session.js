import { SESSION_MODES } from "../network/protocol.js";
import { LocalSession } from "./local-session.js";
import { OnlineSession } from "./online-session.js";
import { SurvivalSession } from "./survival-session.js";

export function createSession({ mode = SESSION_MODES.LOCAL, ...options }) {
  if (mode === SESSION_MODES.ONLINE) return new OnlineSession(options);
  if (mode === SESSION_MODES.SURVIVAL) return new SurvivalSession(options);
  return new LocalSession(options);
}
