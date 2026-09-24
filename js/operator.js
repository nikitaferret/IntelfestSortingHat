import { Bus, loadState } from "./bus.js";
import {
  assignTeams,
  findInTeams,
  hydrate,
  leftoverSplit,
  nextRowStart,
  defaultRows,
  rowNumbers,
  selectedList,
  spreadLeftover,
  teamLabel,
} from "./sort.js";

const bus = new Bus("operator");
const gridEl = document.getElementById("grid");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const toastEl = document.getElementById("toast");
const teamSizeEl = document.getElementById("teamSize");
const pairsEl = document.getElementById("pairs");
const teamsEl = document.getElementById("teams");
const teamsBlock = document.getElementById("teamsBlock");

let state = hydrate(loadState());
let toastTimer = 0;

function toast(msg, danger = false) {
  toastEl.textContent = msg || "";
  toastEl.classList.toggle("is-danger", !!(msg && danger));
  clearTimeout(toastTimer);
  if (msg) toastTimer = setTimeout(() => {
    if (toastEl.textContent === msg) {
      toastEl.textContent = "";
      toastEl.classList.remove("is-danger");
    }
  }, 4200);
}

function peopleWord(n) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "участник";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "участника";
  return "участников";
}

function teamWord(n) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "команда";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "команды";
  return "команд";
}

function afterChange() {
  state.rev = (state.rev || 0) + 1;
  bus.publish(state);
  paint();
}

function publishOnly() {
  state.rev = (state.rev || 0) + 1;
  bus.publish(state);
}

function linkedSet() {
  const s = new Set();
  for (const g of state.pairs || []) for (const n of g) s.add(Number(n));
  return s;
}

function paint() {
  const ids = selectedList(state.selected);
  const linked = linkedSet();
  countEl.textContent = String(ids.length);
  teamSizeEl.value = String(state.teamSize);
  const nTeams = state.teams?.length || 0;
  if (state.phase === "done" && nTeams) {
    statusEl.textContent = `${ids.length} ${peopleWord(ids.length)} · ${nTeams} ${teamWord(nTeams)}`;
  } else {
    statusEl.textContent = `${ids.length} ${peopleWord(ids.length)} · по ${state.teamSize}`;
  }

  const placed = new Set();
  if (state.teams) for (const t of state.teams) for (const n of t.numbers) placed.add(n);
  gridEl.innerHTML = "";
  for (const row of state.rows) {
    const line = document.createElement("div");
    line.className = "row-line";
    const x10 = document.createElement("button");
    x10.type = "button";
    x10.className = "tiny";
    x10.textContent = "x10";
    x10.title = "Весь ряд";
    x10.dataset.row = String(row);
    x10.addEventListener("click", () => toggleRow(row));
    const pads = document.createElement("div");
    pads.className = "pads";
    for (const n of rowNumbers(row)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        "pad" +
        (state.selected[n] ? " is-on" : "") +
        (placed.has(n) ? " is-placed" : "") +
        (linked.has(n) ? " is-linked" : "");
      b.textContent = String(n);
      b.addEventListener("click", () => toggleNum(n));
      pads.appendChild(b);
    }
    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "tiny danger";
    hide.textContent = "скрыть";
    hide.title = "Убрать ряд с пульта";
    hide.addEventListener("click", () => hideRow(row));
    line.append(x10, pads, hide);
    gridEl.appendChild(line);
  }

  pairsEl.innerHTML = "";
  (state.pairs || []).forEach((g, i) => {
    const row = document.createElement("div");
    row.className = "chip-row";
    const lab = document.createElement("span");
    lab.className = "chip";
    lab.textContent = g.join(" + ");
    const x = document.createElement("button");
    x.type = "button";
    x.className = "tiny danger";
    x.textContent = "×";
    x.addEventListener("click", () => {
      state.pairs.splice(i, 1);
      afterChange();
    });
    row.append(lab, x);
    pairsEl.appendChild(row);
  });

  const done = state.phase === "done" && Array.isArray(state.teams);
  teamsBlock.hidden = !done;
  const spreadBtn = document.getElementById("spreadLeft");
  spreadBtn.hidden = !done || !leftoverSplit(state.teams);
  if (done) paintTeams();
}

function paintTeams() {
  teamsEl.innerHTML = "";
  for (const t of state.teams) {
    const box = document.createElement("div");
    box.className = "team-box" + (t.leftover ? " is-left" : "");
    const head = document.createElement("header");
    const nameInp = document.createElement("input");
    nameInp.className = "team-name";
    nameInp.type = "text";
    nameInp.value = t.name || "";
    nameInp.placeholder = t.leftover ? "Остаток" : `Команда ${t.id}`;
    nameInp.addEventListener("input", () => {
      t.name = nameInp.value;
      publishOnly();
    });
    const nEl = document.createElement("span");
    nEl.className = "n";
    nEl.textContent = String(t.numbers.length);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "tiny danger";
    del.textContent = "×";
    del.title = "Удалить команду";
    del.addEventListener("click", () => {
      state.teams = state.teams.filter((x) => x.id !== t.id);
      afterChange();
    });
    head.append(nameInp, nEl, del);
    const chips = document.createElement("div");
    chips.className = "chip-row";
    for (const n of t.numbers) {
      const chip = document.createElement("span");
      chip.className = "chip" + ((t.extras || []).includes(n) ? " is-extra" : "");
      chip.append(String(n));
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "×";
      rm.title = "Убрать из команды";
      rm.addEventListener("click", () => removeFromTeam(t.id, n));
      chip.appendChild(rm);
      chips.appendChild(chip);
    }
    const add = document.createElement("div");
    add.className = "inline";
    const inp = document.createElement("input");
    inp.className = "num";
    inp.type = "number";
    inp.min = "1";
    inp.placeholder = "№";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "Добавить";
    btn.addEventListener("click", () => addToTeam(t.id, inp.value));
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addToTeam(t.id, inp.value);
    });
    add.append(inp, btn);
    box.append(head, chips, add);
    teamsEl.appendChild(box);
  }
}

function toggleNum(n) {
  if (state.selected[n]) {
    if (state.phase === "done") {
      const t = findInTeams(state.teams, n);
      if (t) {
        toast(`Сначала уберите №${n} из «${teamLabel(t)}»`, true);
        return;
      }
    }
    delete state.selected[n];
  } else {
    state.selected[n] = true;
  }
  afterChange();
}

function toggleRow(row) {
  const nums = rowNumbers(row);
  const allOn = nums.every((n) => state.selected[n]);
  for (const n of nums) {
    if (allOn) {
      if (state.phase === "done" && findInTeams(state.teams, n)) continue;
      delete state.selected[n];
    } else {
      state.selected[n] = true;
    }
  }
  afterChange();
}

function hideRow(row) {
  const nums = rowNumbers(row);
  if (state.phase === "done") {
    for (const n of nums) {
      const t = findInTeams(state.teams, n);
      if (t) {
        toast(`В ряде есть №${n} в «${teamLabel(t)}». Сначала уберите его из команды.`, true);
        return;
      }
    }
  }
  for (const n of nums) delete state.selected[n];
  state.pairs = (state.pairs || [])
    .map((g) => g.filter((n) => !nums.includes(n)))
    .filter((g) => g.length >= 2);
  state.rows = state.rows.filter((r) => r !== row);
  afterChange();
}

function addToTeam(teamId, raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    toast("Введите номер участника", true);
    return;
  }
  const other = findInTeams(state.teams, n);
  if (other) {
    if (other.id === teamId) {
      toast(`№${n} уже в этой команде`, true);
      return;
    }
    toast(`Этот номер уже зарегистрирован в «${teamLabel(other)}»`, true);
    return;
  }
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return;
  team.numbers.push(n);
  team.numbers.sort((a, b) => a - b);
  state.selected[n] = true;
  afterChange();
}

function removeFromTeam(teamId, n) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return;
  team.numbers = team.numbers.filter((x) => x !== n);
  team.extras = (team.extras || []).filter((x) => x !== n);
  afterChange();
}

document.getElementById("deal").addEventListener("click", () => {
  state.teamSize = Math.max(1, Number(teamSizeEl.value) || 4);
  const ids = selectedList(state.selected);
  const res = assignTeams(ids, state.teamSize, state.pairs);
  if (res.error) {
    toast(res.error, true);
    return;
  }
  state.teams = res.teams;
  state.phase = "done";
  afterChange();
  const extra = res.leftover ? " · остаток отдельной командой" : "";
  toast(`Готово: ${res.teams.length} ${teamWord(res.teams.length)}${extra}`);
});

document.getElementById("addRow").addEventListener("click", () => {
  state.rows.push(nextRowStart(state.rows));
  afterChange();
});

document.getElementById("resetRows").addEventListener("click", () => {
  state.rows = defaultRows();
  const onGrid = new Set();
  for (const start of state.rows) for (const n of rowNumbers(start)) onGrid.add(n);
  for (const key of Object.keys(state.selected)) {
    const n = Number(key);
    if (!onGrid.has(n) && !findInTeams(state.teams, n)) delete state.selected[n];
  }
  afterChange();
});

document.getElementById("pairAdd").addEventListener("click", () => {
  const a = Number(document.getElementById("pairA").value);
  const b = Number(document.getElementById("pairB").value);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a === b) {
    toast("Нужны два разных номера", true);
    return;
  }
  state.selected[a] = true;
  state.selected[b] = true;
  const hit = (state.pairs || []).find((g) => g.includes(a) || g.includes(b));
  if (hit) {
    if (!hit.includes(a)) hit.push(a);
    if (!hit.includes(b)) hit.push(b);
    hit.sort((x, y) => x - y);
  } else {
    state.pairs.push([a, b].sort((x, y) => x - y));
  }
  document.getElementById("pairA").value = "";
  document.getElementById("pairB").value = "";
  afterChange();
});

document.getElementById("resetTeams").addEventListener("click", () => {
  state.teams = null;
  state.phase = "pick";
  afterChange();
});

document.getElementById("addTeam").addEventListener("click", () => {
  if (!Array.isArray(state.teams)) state.teams = [];
  const id = state.teams.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) + 1;
  state.teams.push({
    id,
    cap: state.teamSize,
    numbers: [],
    extras: [],
    leftover: false,
    name: `Команда ${id}`,
  });
  state.phase = "done";
  afterChange();
});

document.getElementById("spreadLeft").addEventListener("click", () => {
  const res = spreadLeftover(state.teams);
  if (res.error) {
    toast(res.error, true);
    return;
  }
  state.teams = res.teams;
  afterChange();
  toast("Остаток раскидан по командам поровну");
});

teamSizeEl.addEventListener("change", () => {
  state.teamSize = Math.max(1, Number(teamSizeEl.value) || 4);
  afterChange();
});

function hallToast(info) {
  const n = info.monitors?.length || "?";
  const m = (info.monitor ?? 0) + 1;
  const size = info.bounds ? ` · ${info.bounds.width}×${info.bounds.height}` : "";
  if (info.moved) {
    toast(`Зал переключён на монитор ${m}`);
    return;
  }
  if (n === 1) {
    toast(`Виден только один монитор. Зал открыт в браузере по умолчанию.${size} Esc закрывает. Ещё раз — другой монитор.`);
    return;
  }
  const placed = info.placed === false ? " Не удалось перенести автоматически — перетащите." : "";
  toast(`Зал: браузер по умолчанию, монитор ${m} из ${n}${size}. Esc закрывает.${placed} Ещё раз — другой монитор.`);
}

async function showHall() {
  toast("Открываю зал…");
  try {
    const st = await fetch("/api/status", { cache: "no-store" }).then((r) => r.json());
    const path = st.display_alive ? "/api/cycle-display" : "/api/open-display";
    const info = await fetch(path, { cache: "no-store" }).then((r) => r.json());
    if (info.ok) {
      hallToast(info);
      bus.publish(state);
      setTimeout(() => bus.publish(state), 400);
      setTimeout(() => bus.publish(state), 1200);
      return;
    }
    toast(info.error || "Не удалось открыть экран зала.");
  } catch {
    toast("Нет лаунчера. Запустите IntelfestSortingHat.bat.");
  }
}

document.getElementById("openDisplay").addEventListener("click", showHall);

bus.on((msg) => {
  if (msg?.type === "state" && msg.from !== "operator" && msg.state) {
    state = hydrate(msg.state);
    paint();
  }
});

paint();
bus.publish(state);
