export function selectedList(selected) {
  return Object.keys(selected || {})
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0 && selected[n])
    .sort((a, b) => a - b);
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** rem > 50% of team size → own incomplete team; 50% and below → fill existing. */
export function makeCaps(n, s, rng = Math.random) {
  if (s < 1) return { error: "В команде должно быть хотя бы 1 место" };
  if (n < 1) return { error: "Нет выбранных участников" };
  const full = Math.floor(n / s);
  const rem = n % s;
  if (rem === 0) return { caps: Array(full).fill(s), leftover: false };
  if (rem > s * 0.5) {
    if (full === 0) return { caps: [n], leftover: true };
    return { caps: [...Array(full).fill(s), rem], leftover: true };
  }
  if (full === 0) return { caps: [n], leftover: true };
  const caps = Array(full).fill(s);
  const idxs = shuffle([...Array(full).keys()], rng);
  for (let i = 0; i < rem; i++) caps[idxs[i]] += 1;
  return { caps, leftover: false };
}

export function unionGroups(ids, pairs) {
  const idSet = new Set(ids);
  const parent = new Map();
  for (const id of ids) parent.set(id, id);

  function find(x) {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  }
  function uni(a, b) {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  }

  for (const g of pairs || []) {
    const nums = (g || []).map(Number).filter((n) => idSet.has(n));
    for (let i = 1; i < nums.length; i++) uni(nums[0], nums[i]);
  }

  const buckets = new Map();
  for (const id of ids) {
    const r = find(id);
    if (!buckets.has(r)) buckets.set(r, []);
    buckets.get(r).push(id);
  }
  return [...buckets.values()].map((g) => g.sort((a, b) => a - b));
}

export function assignTeams(ids, teamSize, pairs, rng = Math.random) {
  const planned = makeCaps(ids.length, teamSize, rng);
  if (planned.error) return planned;
  const { caps, leftover } = planned;
  const groups = unionGroups(ids, pairs);
  const maxCap = Math.max(...caps);
  for (const g of groups) {
    if (g.length > maxCap) {
      return {
        error: `Связка ${g.join(", ")} не помещается в команду из ${teamSize}`,
      };
    }
  }
  for (let attempt = 0; attempt < 400; attempt++) {
    const bins = caps.map((c, i) => {
      const isLeft = leftover && caps.length > 1 && i === caps.length - 1;
      return {
        id: i + 1,
        cap: c,
        numbers: [],
        extras: [],
        leftover: isLeft,
        name: isLeft ? "Остаток" : `Команда ${i + 1}`,
      };
    });
    let ok = true;
    for (const g of shuffle(groups, rng)) {
      const fit = shuffle(
        bins.filter((b) => b.cap - b.numbers.length >= g.length),
        rng
      );
      if (!fit.length) {
        ok = false;
        break;
      }
      const b = fit[0];
      if (!b.leftover) {
        const room = Math.max(0, teamSize - b.numbers.length);
        if (g.length > room) b.extras.push(...g.slice(room));
      }
      b.numbers.push(...g);
    }
    if (ok) {
      for (const b of bins) b.numbers.sort((a, c) => a - c);
      return { teams: bins, leftover };
    }
  }
  return { error: "Не удалось рассадить связки. Уменьшите группы или размер команды." };
}

export function leftoverSplit(teams) {
  const list = teams || [];
  const left = list.find((t) => t.leftover);
  const mains = list.filter((t) => !t.leftover);
  if (!left || !mains.length) return null;
  const n = (left.numbers || []).length;
  if (n < 1 || n % mains.length !== 0) return null;
  return { per: n / mains.length, left, mains };
}

export function spreadLeftover(teams, rng = Math.random) {
  const info = leftoverSplit(teams);
  if (!info) return { error: "Остаток не делится поровну на команды" };
  const pool = shuffle(info.left.numbers.slice(), rng);
  const mains = info.mains.map((t) => ({
    ...t,
    numbers: t.numbers.slice(),
    extras: Array.isArray(t.extras) ? t.extras.slice() : [],
  }));
  pool.forEach((num, i) => {
    const t = mains[i % mains.length];
    t.numbers.push(num);
    t.extras.push(num);
  });
  for (const t of mains) t.numbers.sort((a, b) => a - b);
  return { teams: mains };
}

export function findInTeams(teams, num) {
  if (!teams) return null;
  const n = Number(num);
  for (const t of teams) {
    if (t.numbers.includes(n)) return t;
  }
  return null;
}

export function rowNumbers(start) {
  return Array.from({ length: 10 }, (_, i) => start + i);
}

export function nextRowStart(rows) {
  if (!rows || !rows.length) return 1;
  let max = 0;
  for (const start of rows) max = Math.max(max, start + 9);
  return max + 1;
}

export function teamLabel(t) {
  const n = String(t?.name || "").trim();
  if (n) return n;
  return t?.leftover ? "Остаток" : `Команда ${t?.id ?? ""}`;
}

export function defaultRows() {
  return [1, 11, 21, 31, 41, 51, 61, 71, 81, 91];
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return defaultRows();
  const nums = rows.map(Number).filter((n) => Number.isInteger(n) && n >= 0);
  if (nums.includes(0)) return nums.map((i) => i * 10 + 1);
  return nums;
}

export function defaultState() {
  return {
    rev: 0,
    title: "Intelfest Sorting Hat",
    teamSize: 4,
    rows: defaultRows(),
    selected: {},
    pairs: [],
    teams: null,
    phase: "pick",
  };
}

export function hydrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const oldTitle = raw.title === "Intelfest" || raw.title === "IntelfestSortingHat" || !raw.title;
  return {
    ...base,
    ...raw,
    selected: raw.selected && typeof raw.selected === "object" ? raw.selected : {},
    rows: normalizeRows(raw.rows),
    pairs: Array.isArray(raw.pairs) ? raw.pairs : [],
    teams: Array.isArray(raw.teams)
      ? raw.teams.map((t) => ({
          ...t,
          extras: Array.isArray(t.extras) ? t.extras.map(Number) : [],
          name: typeof t.name === "string" ? t.name : "",
        }))
      : null,
    teamSize: Math.max(1, Number(raw.teamSize) || 4),
    title: oldTitle ? "Intelfest Sorting Hat" : raw.title,
  };
}
