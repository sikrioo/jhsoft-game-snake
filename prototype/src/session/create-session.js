import { SESSION_MODES } from "../network/protocol.js";
import { LocalSession } from "./local-session.js";
import { OnlineSession } from "./online-session.js";

export function createSession({ mode = SESSION_MODES.LOCAL, ...options }) {
  if (mode === SESSION_MODES.ONLINE) return new OnlineSession(options);
  return new LocalSession(options);
}
