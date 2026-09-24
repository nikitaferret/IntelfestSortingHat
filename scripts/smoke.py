# Remainder + packing checks (mirrors js/sort.js rules).
# Run: runtime\python\python.exe scripts\smoke.py
from __future__ import annotations

import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def make_caps(n: int, s: int, rng: random.Random):
    if s < 1:
        return {"error": "size"}
    if n < 1:
        return {"error": "empty"}
    full, rem = divmod(n, s)
    if rem == 0:
        return {"caps": [s] * full, "leftover": False}
    if rem > s * 0.5:
        if full == 0:
            return {"caps": [n], "leftover": True}
        return {"caps": [s] * full + [rem], "leftover": True}
    if full == 0:
        return {"caps": [n], "leftover": True}
    caps = [s] * full
    idxs = list(range(full))
    rng.shuffle(idxs)
    for i in range(rem):
        caps[idxs[i]] += 1
    return {"caps": caps, "leftover": False}


def union_groups(ids, pairs):
    parent = {i: i for i in ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def uni(a, b):
        pa, pb = find(a), find(b)
        if pa != pb:
            parent[pa] = pb

    idset = set(ids)
    for g in pairs:
        nums = [x for x in g if x in idset]
        for i in range(1, len(nums)):
            uni(nums[0], nums[i])
    buckets = {}
    for i in ids:
        buckets.setdefault(find(i), []).append(i)
    return list(buckets.values())


def assign(ids, size, pairs, rng):
    planned = make_caps(len(ids), size, rng)
    if planned.get("error"):
        return planned
    caps, leftover = planned["caps"], planned["leftover"]
    groups = union_groups(ids, pairs)
    max_cap = max(caps)
    for g in groups:
        if len(g) > max_cap:
            return {"error": "too big"}
    for _ in range(400):
        bins = [{"cap": c, "nums": []} for c in caps]
        ok = True
        gs = groups[:]
        rng.shuffle(gs)
        for g in gs:
            fit = [b for b in bins if b["cap"] - len(b["nums"]) >= len(g)]
            rng.shuffle(fit)
            if not fit:
                ok = False
                break
            fit[0]["nums"].extend(g)
        if ok:
            return {"teams": bins, "leftover": leftover, "caps": caps}
    return {"error": "pack"}


def main() -> int:
    rng = random.Random(1)
    # 47 people, team of 4 → rem 3 > 50% of 4 → leftover team of 3
    p = make_caps(47, 4, rng)
    assert p["leftover"] is True and p["caps"][-1] == 3 and p["caps"].count(4) == 11, p
    # 46 people, team of 4 → rem 2 == 50% → fill, no leftover
    p = make_caps(46, 4, rng)
    assert p["leftover"] is False and sum(p["caps"]) == 46 and max(p["caps"]) == 5, p
    # 2 people, team of 4 → no full teams, one incomplete
    p = make_caps(2, 4, rng)
    assert p["caps"] == [2] and p["leftover"] is True, p
    # packing with pair
    ids = list(range(1, 13))
    res = assign(ids, 4, [[1, 2, 3]], rng)
    assert "error" not in res
    homes = {n: i for i, t in enumerate(res["teams"]) for n in t["nums"]}
    assert homes[1] == homes[2] == homes[3]
    assert all(len(t["nums"]) == 4 for t in res["teams"])
    print("smoke ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
