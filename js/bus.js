export const CHANNEL = "intelfest-sorting-hat-v1";
export const STORAGE_KEY = "intelfest-sorting-hat-state-v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export class Bus {
  constructor(role) {
    this.role = role;
    this.bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    this.listeners = new Set();
    if (this.bc) this.bc.onmessage = (ev) => this._emit(ev.data);
    window.addEventListener("storage", (ev) => {
      if (ev.key === STORAGE_KEY && ev.newValue) {
        try {
          this._emit({ type: "state", state: JSON.parse(ev.newValue) });
        } catch {
          /* ignore */
        }
      }
    });
  }

  publish(state) {
    saveState(state);
    const msg = { type: "state", state, from: this.role };
    this.bc?.postMessage(msg);
    this._emit(msg);
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => {});
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(msg) {
    for (const fn of this.listeners) fn(msg);
  }
}
