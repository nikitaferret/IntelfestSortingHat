import { Bus, loadState } from "./bus.js";
import { hydrate, teamLabel } from "./sort.js";

const bus = new Bus("display");
const stage = document.getElementById("stage");
const panel = document.getElementById("panel");
let state = hydrate(loadState());

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paint() {
  const st = hydrate(state);
  const done = st.phase === "done" && Array.isArray(st.teams) && st.teams.length;
  if (!done) {
    panel.innerHTML = `<div class="splash-name">Intelfest Sorting Hat</div>`;
    fit();
    return;
  }
  const n = st.teams.length;
  const cols = n <= 4 ? n : n <= 8 ? 4 : n <= 12 ? 4 : n <= 18 ? 5 : 6;
  const title = escapeHtml(st.title || "Intelfest Sorting Hat");
  const cards = st.teams
    .map((t) => {
      const name = escapeHtml(teamLabel(t));
      const extra = new Set((t.extras || []).map(Number));
      const nums = t.numbers
        .map((x) => `<span class="num-big${extra.has(Number(x)) ? " is-extra" : ""}">${escapeHtml(x)}</span>`)
        .join("");
      return `<article class="team-card${t.leftover ? " is-left" : ""}"><h2>${name}</h2><div class="nums">${nums}</div></article>`;
    })
    .join("");
  panel.innerHTML = `<div class="plaque">${title}</div><div class="teams" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr))">${cards}</div>`;
  fit();
}

function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const s = Math.min(w / 1920, h / 1080);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}

function accept(next) {
  if (!next) return;
  state = hydrate(next);
  paint();
}

bus.on((msg) => {
  if (msg?.type === "state") accept(msg.state);
});
accept(loadState());

let lastRev = state?.rev ?? -1;
let lastReload = Number(sessionStorage.getItem("hallReload") || 0);
async function pullServer() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const n = Number(data.hallReload || 0);
    if (sessionStorage.getItem("hallReload") != null && n > lastReload) {
      sessionStorage.setItem("hallReload", String(n));
      location.reload();
      return;
    }
    lastReload = n;
    sessionStorage.setItem("hallReload", String(n));
    const next = data.state;
    if (!next) return;
    if ((next.rev ?? 0) !== lastRev) {
      lastRev = next.rev ?? 0;
      accept(next);
    }
  } catch {
    /* ignore */
  }
}
setInterval(pullServer, 250);
pullServer();

window.addEventListener("resize", fit);
document.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
});
document.addEventListener("dblclick", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
});
paint();
